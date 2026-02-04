// Items API - GET all items
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findMany, insertOne } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';

// export const dynamic = 'force-dynamic'; // Commented for static export

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    console.log('GET /api/items - Token from cookie:', token ? 'exists' : 'missing');
    
    if (!token) {
      console.log('GET /api/items - No token, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    console.log('GET /api/items - Token decoded:', decoded ? 'valid' : 'invalid');
    
    if (!decoded) {
      console.log('GET /api/items - Invalid token, returning 401');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    await connectToMongoDB();
    
    const items = await findMany('items', { userId: decoded.userId });
    console.log('GET /api/items - Found items:', items.length);

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Get items error:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
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
    const { name, buyPrice, sellPrice, quantity, unit, imageUrl } = body;

    if (!name || buyPrice == null || sellPrice == null || quantity == null || !unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectToMongoDB();

    // Check if item with same name already exists for this user
    const existingItem = await findMany('items', { 
      userId: decoded.userId, 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingItem && existingItem.length > 0) {
      return NextResponse.json({ error: 'An item with this name already exists' }, { status: 400 });
    }

    const newItem = {
      userId: decoded.userId,
      name,
      buyPrice: parseFloat(buyPrice),
      sellPrice: parseFloat(sellPrice),
      quantity: parseFloat(quantity),
      unit,
      imageUrl: imageUrl || undefined,
      priceHistory: [{
        buyPrice: parseFloat(buyPrice),
        sellPrice: parseFloat(sellPrice),
        changedAt: new Date(),
        notes: 'Initial price',
      }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await insertOne('items', newItem);
    const itemId = (result as any).insertedId?.toString() || (result as any).toString();

    // Record initial stock transaction
    await insertOne('stockTransactions', {
      userId: decoded.userId,
      itemId: itemId,
      quantity: parseFloat(quantity),
      transactionType: 'addition',
      notes: 'Initial stock',
      transactionDate: new Date(),
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      item: { ...newItem, id: itemId, _id: itemId },
    });
  } catch (error) {
    console.error('Create item error:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
