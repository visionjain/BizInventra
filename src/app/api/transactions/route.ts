// Sales/Transactions API - GET all transactions and POST new transaction
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findMany, insertOne, updateOne, findOne } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

// export const dynamic = 'force-dynamic'; // Commented for static export

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
    
    // Check for customerId filter in query params
    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get('customerId');
    
    const query: any = { userId: decoded.userId, isDeleted: { $ne: true } };
    
    // Add customerId filter if provided (match both ObjectId and string formats)
    if (customerIdParam) {
      query.$or = [
        { customerId: new ObjectId(customerIdParam) },
        { customerId: customerIdParam }
      ];
    }
    
    // Get transactions with populated customer and item details
    const transactions = await findMany('transactions', query);
    
    // Populate customer and item names
    for (const transaction of transactions) {
      if (transaction.customerId) {
        const customer = await findOne('customers', { _id: new ObjectId(transaction.customerId) });
        transaction.customerName = customer?.name || 'Unknown';
      }
      
      if (transaction.items && transaction.items.length > 0) {
        for (const item of transaction.items) {
          const itemDoc = await findOne('items', { _id: new ObjectId(item.itemId) });
          item.itemName = itemDoc?.name || 'Unknown';
        }
      }
    }

    return NextResponse.json({ success: true, transactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

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
    const { customerId, items, paymentReceived, paymentMethod, notes, transactionDate, additionalCharges } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Items are required' }, { status: 400 });
    }
    
    // Use custom transaction date if provided, otherwise use current date
    const txDate = transactionDate ? new Date(transactionDate) : new Date();

    await connectToMongoDB();

    // Calculate total additional charges (excluded from P&L)
    const totalAdditionalCharges = (additionalCharges || []).reduce((sum: number, charge: any) => 
      sum + (charge.amount || 0), 0
    );

    // Get customer name if customerId is provided
    let customerName = 'Walk-in Customer';
    if (customerId) {
      const customer = await findOne('customers', { _id: new ObjectId(customerId) });
      customerName = customer?.name || 'Unknown Customer';
    }

    // Calculate total amount and P&L, and add buyPrice to each item
    let totalAmount = 0;
    let totalProfit = 0;
    const enrichedItems = [];
    
    for (const item of items) {
      // Get item details to fetch buy price and name
      const itemDoc = await findOne('items', { _id: new ObjectId(item.itemId) });
      const buyPrice = itemDoc?.buyPrice || 0;
      const itemName = itemDoc?.name || 'Unknown Item';
      
      const sellPrice = item.pricePerUnit;
      const quantity = item.quantity;
      const itemTotal = quantity * sellPrice;
      const itemProfit = (sellPrice - buyPrice) * quantity;
      
      totalAmount += itemTotal;
      totalProfit += itemProfit;
      
      // Store item with buyPrice and name for historical record
      enrichedItems.push({
        ...item,
        name: itemName,
        buyPrice: buyPrice,
        profit: itemProfit,
      });
      
      // Update item stock
      await updateOne(
        'items',
        { _id: new ObjectId(item.itemId) },
        { $inc: { quantity: -item.quantity } }
      );
      
      // Record stock transaction for sale with customer name
      await insertOne('stockTransactions', {
        userId: decoded.userId,
        itemId: item.itemId,
        quantity: -item.quantity,
        transactionType: 'sale',
        notes: `Sold to: ${customerName}`,
        transactionDate: txDate,
        createdAt: new Date(),
      });
    }

    const newTransaction = {
      userId: decoded.userId,
      customerId: customerId || null,
      items: enrichedItems,
      totalAmount,
      totalProfit,
      additionalCharges: additionalCharges || [],
      totalAdditionalCharges,
      grandTotal: totalAmount + totalAdditionalCharges,
      paymentReceived: paymentReceived || 0,
      balanceAmount: (totalAmount + totalAdditionalCharges) - (paymentReceived || 0),
      paymentMethod: paymentMethod || 'cash',
      notes: notes || '',
      transactionDate: txDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      lastModifiedAt: new Date(),
    };

    const result = await insertOne('transactions', newTransaction);

    // Update customer outstanding balance only if customer is provided
    // Balance includes both items total and additional charges
    // Allow negative balance (customer credit/advance payment)
    if (customerId) {
      // Get current customer to check for existing credit (negative outstanding)
      const customer = await findOne('customers', { _id: new ObjectId(customerId) });
      const currentOutstanding = customer?.outstandingBalance || 0;
      
      // If customer has credit (negative outstanding), apply it to this transaction
      if (currentOutstanding < 0) {
        const creditAvailable = Math.abs(currentOutstanding);
        const transactionBalance = newTransaction.balanceAmount;
        
        if (creditAvailable >= transactionBalance) {
          // Credit covers the entire balance
          newTransaction.balanceAmount = 0;
          newTransaction.paymentReceived = newTransaction.grandTotal;
          
          // Update the transaction
          await updateOne(
            'transactions',
            { _id: new ObjectId(result) },
            { 
              $set: { 
                paymentReceived: newTransaction.paymentReceived,
                balanceAmount: 0,
                notes: newTransaction.notes + ' (Paid from customer credit)'
              } 
            }
          );
          
          // Update customer outstanding (reduce credit by transaction balance)
          await updateOne(
            'customers',
            { _id: new ObjectId(customerId) },
            { $set: { outstandingBalance: currentOutstanding + transactionBalance } }
          );
        } else {
          // Credit partially covers the balance
          const remainingBalance = transactionBalance - creditAvailable;
          newTransaction.balanceAmount = remainingBalance;
          newTransaction.paymentReceived = newTransaction.paymentReceived + creditAvailable;
          
          // Update the transaction
          await updateOne(
            'transactions',
            { _id: new ObjectId(result) },
            { 
              $set: { 
                paymentReceived: newTransaction.paymentReceived,
                balanceAmount: remainingBalance,
                notes: newTransaction.notes + ` (₹${creditAvailable.toFixed(2)} paid from customer credit)`
              } 
            }
          );
          
          // Update customer outstanding (credit becomes zero, add remaining balance)
          await updateOne(
            'customers',
            { _id: new ObjectId(customerId) },
            { $set: { outstandingBalance: remainingBalance } }
          );
        }
      } else {
        // No credit, just add the balance normally
        await updateOne(
          'customers',
          { _id: new ObjectId(customerId) },
          { $inc: { outstandingBalance: newTransaction.balanceAmount } }
        );
      }
    }

    return NextResponse.json({
      success: true,
      transaction: { ...newTransaction, _id: result, id: result },
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
