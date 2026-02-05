export const dynamic = 'force-static';

// Stock Transactions API - GET all stock transactions and POST new stock addition
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findMany, insertOne, updateOne, findOne } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

// export const dynamic = 'force-static'; // Commented for static export

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

    const url = new URL(request.url);
    const itemId = url.searchParams.get('itemId');

    await connectToMongoDB();
    
    const query: any = { userId: decoded.userId };
    if (itemId) {
      query.itemId = itemId;
    }

    const stockTransactions = await findMany('stockTransactions', query);
    
    // Populate item names
    for (const transaction of stockTransactions) {
      if (transaction.itemId) {
        const item = await findOne('items', { _id: new ObjectId(transaction.itemId) });
        transaction.itemName = item?.name || 'Unknown';
      }
    }

    return NextResponse.json({ success: true, stockTransactions });
  } catch (error) {
    console.error('Get stock transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock transactions' }, { status: 500 });
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
    const { itemId, quantity, notes, transactionType, transactionDate } = body;

    console.log('Stock transaction request:', { itemId, quantity, notes, transactionType, transactionDate });

    if (!itemId || !quantity) {
      return NextResponse.json({ error: 'Item ID and quantity are required' }, { status: 400 });
    }

    await connectToMongoDB();

    // Verify item exists
    const item = await findOne('items', { _id: new ObjectId(itemId), userId: decoded.userId });
    if (!item) {
      console.error('Item not found:', itemId);
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Update item stock
    const updateResult = await updateOne(
      'items',
      { _id: new ObjectId(itemId) },
      { $inc: { quantity: parseFloat(quantity) } }
    );

    console.log('Item stock updated:', updateResult);

    const newStockTransaction = {
      userId: decoded.userId,
      itemId: itemId,
      quantity: parseFloat(quantity),
      transactionType: transactionType || 'addition',
      notes: notes || '',
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      createdAt: new Date(),
    };

    const result = await insertOne('stockTransactions', newStockTransaction);

    console.log('Stock transaction created:', result);

    return NextResponse.json({
      success: true,
      stockTransaction: { ...newStockTransaction, _id: result, id: result },
    });
  } catch (error: any) {
    console.error('Create stock transaction error:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json({ error: `Failed to create stock transaction: ${error.message}` }, { status: 500 });
  }
}
