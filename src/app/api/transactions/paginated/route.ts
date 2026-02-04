// Optimized Transactions API with pagination
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = await connectToMongoDB();

    // Build filter
    const filter: any = {
      userId: decoded.userId,
      isDeleted: { $ne: true }
    };

    if (startDate && endDate) {
      filter.transactionDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get transactions with pagination
    const transactions = await db.collection('transactions')
      .find(filter)
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const totalCount = await db.collection('transactions').countDocuments(filter);

    // Enrich with customer names
    const customerIds = [...new Set(transactions.map(tx => tx.customerId).filter(Boolean))];
    const customers = customerIds.length > 0
      ? await db.collection('customers').find({
          _id: { $in: customerIds.map(id => new ObjectId(id as string)) }
        }).toArray()
      : [];

    const customerMap = new Map(customers.map(c => [c._id.toString(), c.name]));

    const enrichedTransactions = transactions.map(tx => ({
      ...tx,
      id: tx._id.toString(),
      customerName: tx.customerId ? customerMap.get(tx.customerId.toString()) || 'Unknown' : 'Walk-in'
    }));

    return NextResponse.json({
      success: true,
      transactions: enrichedTransactions,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// Keep existing POST endpoint
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

    if (paymentReceived === undefined || paymentReceived < 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    const db = await connectToMongoDB();

    // Validate and calculate
    let totalAmount = 0;
    let totalProfit = 0;
    const enrichedItems = [];

    for (const item of items) {
      const itemDoc = await db.collection('items').findOne({ _id: new ObjectId(item.itemId) });
      if (!itemDoc) {
        return NextResponse.json(
          { error: `Item not found: ${item.itemId}` },
          { status: 404 }
        );
      }

      if (itemDoc.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${itemDoc.name}. Available: ${itemDoc.quantity}` },
          { status: 400 }
        );
      }

      const itemTotal = item.quantity * item.pricePerUnit;
      const itemProfit = item.quantity * (item.pricePerUnit - (itemDoc.buyPrice || 0));
      
      totalAmount += itemTotal;
      totalProfit += itemProfit;

      enrichedItems.push({
        itemId: item.itemId,
        name: itemDoc.name,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        sellPrice: itemDoc.sellPrice,
        buyPrice: itemDoc.buyPrice,
        total: itemTotal,
      });

      // Reduce stock
      await db.collection('items').updateOne(
        { _id: new ObjectId(item.itemId) },
        { 
          $inc: { quantity: -item.quantity },
          $set: { updatedAt: new Date() }
        }
      );

      // Record stock transaction
      await db.collection('stockTransactions').insertOne({
        userId: decoded.userId,
        itemId: item.itemId,
        quantity: -item.quantity,
        transactionType: 'sale',
        notes: `Sale transaction`,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        createdAt: new Date(),
      });
    }

    // Add additional charges
    if (additionalCharges && additionalCharges.length > 0) {
      const chargesTotal = additionalCharges.reduce((sum: number, charge: any) => sum + (charge.amount || 0), 0);
      totalAmount += chargesTotal;
    }

    // Check if customer has credit/advance
    let customerCredit = 0;
    if (customerId) {
      const customer = await db.collection('customers').findOne({ _id: new ObjectId(customerId) });
      if (customer && customer.outstandingBalance < 0) {
        customerCredit = Math.abs(customer.outstandingBalance);
      }
    }

    // Create transaction
    const transaction = {
      userId: decoded.userId,
      customerId: customerId ? new ObjectId(customerId) : null,
      items: enrichedItems,
      totalAmount,
      totalProfit,
      paymentReceived: parseFloat(paymentReceived),
      paymentMethod: paymentMethod || 'cash',
      notes: notes || '',
      additionalCharges: additionalCharges || [],
      customerCreditUsed: customerCredit > 0 ? Math.min(customerCredit, totalAmount) : 0,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      createdAt: new Date(),
      isDeleted: false,
    };

    const result = await db.collection('transactions').insertOne(transaction);

    // Update customer balance
    if (customerId) {
      const customer = await db.collection('customers').findOne({ _id: new ObjectId(customerId) });
      let currentBalance = customer?.outstandingBalance || 0;
      
      // Apply credit if available
      let creditToApply = 0;
      if (currentBalance < 0) {
        creditToApply = Math.min(Math.abs(currentBalance), totalAmount);
        currentBalance += creditToApply;
      }

      const balanceChange = totalAmount - creditToApply - parseFloat(paymentReceived);
      
      await db.collection('customers').updateOne(
        { _id: new ObjectId(customerId) },
        { 
          $inc: { outstandingBalance: balanceChange },
          $set: { updatedAt: new Date() }
        }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: { ...transaction, _id: result.insertedId, id: result.insertedId.toString() },
      message: 'Transaction created successfully'
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
