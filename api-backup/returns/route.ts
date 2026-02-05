export const dynamic = 'force-dynamic';

// Return Transaction API - Create return/refund
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findOne, insertOne, updateOne, findMany } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

// export const dynamic = 'force-static'; // Commented for static export

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { originalTransactionId, items, refundAmount, notes } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Items are required' }, { status: 400 });
    }

    if (!refundAmount || refundAmount <= 0) {
      return NextResponse.json({ error: 'Valid refund amount is required' }, { status: 400 });
    }

    await connectToMongoDB();

    // Get original transaction if provided
    let originalTransaction = null;
    let customerId = null;
    if (originalTransactionId) {
      originalTransaction = await findOne('transactions', { 
        _id: new ObjectId(originalTransactionId) 
      });
      customerId = originalTransaction?.customerId;
    }

    // Calculate totals for returned items
    let totalReturnValue = 0;
    let totalProfitLost = 0;
    const enrichedItems = [];

    for (const item of items) {
      const itemDoc = await findOne('items', { _id: new ObjectId(item.itemId) });
      if (!itemDoc) {
        return NextResponse.json(
          { error: `Item not found: ${item.itemId}` },
          { status: 404 }
        );
      }

      const itemValue = item.quantity * item.pricePerUnit;
      const costPrice = itemDoc.costPrice || 0;
      const profitLost = item.quantity * (item.pricePerUnit - costPrice);

      totalReturnValue += itemValue;
      totalProfitLost += profitLost;

      enrichedItems.push({
        itemId: item.itemId,
        itemName: itemDoc.name,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        costPrice: costPrice,
        total: itemValue,
        profitLost: profitLost
      });

      // Add items back to stock
      await updateOne(
        'items',
        { _id: new ObjectId(item.itemId) },
        { $inc: { quantity: item.quantity } }
      );

      // Create stock transaction for return
      await insertOne('stockTransactions', {
        userId: decoded.userId,
        itemId: item.itemId,
        quantity: item.quantity,
        transactionType: 'return',
        notes: `Return: ${notes || 'Item returned'}`,
        transactionDate: new Date(),
        createdAt: new Date(),
      });
    }

    // Create return transaction record
    const returnTransaction = {
      userId: decoded.userId,
      transactionType: 'return',
      originalTransactionId: originalTransactionId ? new ObjectId(originalTransactionId) : null,
      customerId: customerId ? new ObjectId(customerId) : null,
      items: enrichedItems,
      totalReturnValue,
      totalProfitLost,
      refundAmount: parseFloat(refundAmount),
      notes: notes || '',
      transactionDate: new Date(),
      createdAt: new Date(),
      isDeleted: false,
    };

    const result = await insertOne('returnTransactions', returnTransaction);

    // If customer exists, adjust their outstanding balance
    if (customerId) {
      // If they paid for this and we're refunding, reduce their outstanding (or give them credit)
      await updateOne(
        'customers',
        { _id: new ObjectId(customerId) },
        { $inc: { outstandingBalance: -parseFloat(refundAmount) } }
      );
    }

    return NextResponse.json({
      success: true,
      returnTransaction: { ...returnTransaction, _id: result, id: result },
      message: 'Return processed successfully'
    });
  } catch (error) {
    console.error('Create return transaction error:', error);
    return NextResponse.json({ error: 'Failed to process return' }, { status: 500 });
  }
}

// GET all return transactions
export async function GET(request: NextRequest) {
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

    await connectToMongoDB();
    
    const returns = await findMany('returnTransactions', {
      userId: decoded.userId,
      isDeleted: { $ne: true }
    }, { sort: { transactionDate: -1 } });

    // Populate customer names
    for (const returnTx of returns) {
      if (returnTx.customerId) {
        const customer = await findOne('customers', { _id: new ObjectId(returnTx.customerId) });
        returnTx.customerName = customer?.name || 'Unknown';
      } else {
        returnTx.customerName = 'Walk-in';
      }
    }

    return NextResponse.json({ success: true, returns });
  } catch (error) {
    console.error('Get return transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch returns' }, { status: 500 });
  }
}
