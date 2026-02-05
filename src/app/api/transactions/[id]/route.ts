// Transactions API - DELETE transaction by ID
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, updateOne, findOne, insertOne } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-static';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { customerId, items, paymentReceived, paymentMethod, notes, transactionDate, additionalCharges } = body;

    await connectToMongoDB();
    
    // Use custom transaction date if provided, otherwise keep existing or use current
    const txDate = transactionDate ? new Date(transactionDate) : new Date();

    // Calculate total additional charges (excluded from P&L)
    const totalAdditionalCharges = (additionalCharges || []).reduce((sum: number, charge: any) => 
      sum + (charge.amount || 0), 0
    );

    // Get existing transaction to revert changes
    const existingTransaction: any = await findOne('transactions', { _id: new ObjectId(id), userId: decoded.userId });
    
    if (!existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Revert stock changes from old transaction
    for (const item of existingTransaction.items) {
      await updateOne(
        'items',
        { _id: new ObjectId(item.itemId) },
        { $inc: { quantity: item.quantity } }
      );
    }

    // Revert customer balance from old transaction
    if (existingTransaction.customerId) {
      await updateOne(
        'customers',
        { _id: new ObjectId(existingTransaction.customerId) },
        { $inc: { outstandingBalance: -existingTransaction.balanceAmount } }
      );
    }

    // Calculate new totals and validate stock
    let totalAmount = 0;
    const enrichedItems = [];

    for (const item of items) {
      const itemDoc: any = await findOne('items', { _id: new ObjectId(item.itemId) });
      
      if (!itemDoc) {
        return NextResponse.json({ error: `Item not found: ${item.itemId}` }, { status: 400 });
      }

      // Check stock availability
      if (itemDoc.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${itemDoc.name}. Available: ${itemDoc.quantity}` },
          { status: 400 }
        );
      }

      const itemTotal = item.quantity * item.pricePerUnit;
      totalAmount += itemTotal;

      // Preserve original buyPrice if it exists (for historical accuracy)
      // Only use current buyPrice if not provided
      const buyPrice = item.buyPrice !== undefined ? item.buyPrice : (itemDoc?.buyPrice || 0);
      const itemProfit = (item.pricePerUnit - buyPrice) * item.quantity;
      
      // Preserve original name if it exists
      const itemName = item.name || item.itemName || itemDoc.name;

      enrichedItems.push({
        itemId: item.itemId,
        name: itemName,
        itemName: itemName,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        buyPrice,
        profit: itemProfit,
      });

      // Apply new stock changes
      await updateOne(
        'items',
        { _id: new ObjectId(item.itemId) },
        { $inc: { quantity: -item.quantity } }
      );

      // Record stock transaction
      await insertOne('stockTransactions', {
        userId: decoded.userId,
        itemId: item.itemId,
        quantity: -item.quantity,
        transactionType: 'sale',
        notes: `Sale updated - Transaction #${id}`,
        transactionDate: txDate,
        createdAt: new Date(),
      });
    }

    const grandTotal = totalAmount + totalAdditionalCharges;
    const balanceAmount = grandTotal - paymentReceived;
    const totalProfit = enrichedItems.reduce((sum, item) => sum + item.profit, 0);

    // Get customer name
    let customerName = null;
    if (customerId) {
      const customer: any = await findOne('customers', { _id: new ObjectId(customerId) });
      customerName = customer?.name || null;

      // Update customer balance (includes additional charges)
      await updateOne(
        'customers',
        { _id: new ObjectId(customerId) },
        { $inc: { outstandingBalance: balanceAmount } }
      );
    }

    // Update transaction
    const updatedData = {
      customerId: customerId ? new ObjectId(customerId) : null,
      customerName,
      items: enrichedItems,
      totalAmount,
      additionalCharges: additionalCharges || [],
      totalAdditionalCharges,
      grandTotal,
      paymentReceived,
      balanceAmount,
      totalProfit,
      paymentMethod,
      notes,
      transactionDate: txDate,
      lastModifiedAt: new Date(),
    };

    await updateOne(
      'transactions',
      { _id: new ObjectId(id), userId: decoded.userId },
      updatedData
    );

    const transaction = await findOne('transactions', { _id: new ObjectId(id) });

    return NextResponse.json({
      message: 'Transaction updated successfully',
      transaction,
    });
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    await connectToMongoDB();

    // Get transaction before deleting to revert stock and balance
    const transaction: any = await findOne('transactions', { _id: new ObjectId(id), userId: decoded.userId });
    
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Revert item stock
    for (const item of transaction.items) {
      await updateOne(
        'items',
        { _id: new ObjectId(item.itemId) },
        { $inc: { quantity: item.quantity } }
      );
      
      // Record stock transaction for reversal
      await insertOne('stockTransactions', {
        userId: decoded.userId,
        itemId: item.itemId,
        quantity: item.quantity,
        transactionType: 'adjustment',
        notes: `Reversal of deleted sale transaction`,
        transactionDate: new Date(),
        createdAt: new Date(),
      });
    }

    // Revert customer outstanding balance only if customer exists
    if (transaction.customerId) {
      await updateOne(
        'customers',
        { _id: new ObjectId(transaction.customerId) },
        { $inc: { outstandingBalance: -transaction.balanceAmount } }
      );
    }

    // Soft delete
    await updateOne(
      'transactions',
      { _id: new ObjectId(id), userId: decoded.userId },
      { isDeleted: true, lastModifiedAt: new Date() }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete transaction error:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
