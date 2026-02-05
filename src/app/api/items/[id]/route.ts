// Items API - UPDATE and DELETE specific item
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findOne, updateOne, deleteOne, insertOne } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

export const dynamic = 'force-static';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { name, buyPrice, sellPrice, quantity, unit, imageUrl } = body;

    await connectToMongoDB();

    // Get the current item to compare quantity and prices
    const currentItem = await findOne('items', { _id: new ObjectId(id), userId: decoded.userId });
    
    if (!currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check if name is being changed to a duplicate
    if (name && name !== currentItem.name) {
      const existingItem = await findOne('items', { 
        userId: decoded.userId, 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: new ObjectId(id) }
      });
      
      if (existingItem) {
        return NextResponse.json({ error: 'An item with this name already exists' }, { status: 400 });
      }
    }

    // Prepare update operations
    const updateOperations: any = {};
    
    // Regular field updates
    const setFields: any = { updatedAt: new Date() };
    if (name) setFields.name = name;
    if (buyPrice != null) setFields.buyPrice = parseFloat(buyPrice);
    if (sellPrice != null) setFields.sellPrice = parseFloat(sellPrice);
    if (quantity != null) setFields.quantity = parseFloat(quantity);
    if (unit) setFields.unit = unit;
    if (imageUrl !== undefined) setFields.imageUrl = imageUrl || null;
    
    updateOperations.$set = setFields;

    // Track price changes in price history
    const priceChanged = (buyPrice != null && parseFloat(buyPrice) !== currentItem.buyPrice) || 
                        (sellPrice != null && parseFloat(sellPrice) !== currentItem.sellPrice);
    
    if (priceChanged) {
      const priceHistoryEntry = {
        buyPrice: buyPrice != null ? parseFloat(buyPrice) : currentItem.buyPrice,
        sellPrice: sellPrice != null ? parseFloat(sellPrice) : currentItem.sellPrice,
        changedAt: new Date(),
        notes: `Price updated from Buy: ₹${currentItem.buyPrice} / Sell: ₹${currentItem.sellPrice} to Buy: ₹${buyPrice != null ? buyPrice : currentItem.buyPrice} / Sell: ₹${sellPrice != null ? sellPrice : currentItem.sellPrice}`,
      };
      
      updateOperations.$push = { priceHistory: priceHistoryEntry };
    }

    // Track stock adjustment if quantity changed
    if (quantity != null && parseFloat(quantity) !== currentItem.quantity) {
      const oldQuantity = currentItem.quantity || 0;
      const newQuantity = parseFloat(quantity);
      const difference = newQuantity - oldQuantity;
      
      // Record stock adjustment transaction
      await insertOne('stockTransactions', {
        userId: decoded.userId,
        itemId: id,
        quantity: difference,
        transactionType: 'adjustment',
        notes: `Stock adjusted from ${oldQuantity} to ${newQuantity} (${difference > 0 ? '+' : ''}${difference})`,
        transactionDate: new Date(),
        createdAt: new Date(),
      });
    }

    await updateOne('items', { _id: new ObjectId(id), userId: decoded.userId }, updateOperations);

    return NextResponse.json({ success: true, item: setFields });
  } catch (error) {
    console.error('Update item error:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get the item before deleting to record final stock
    const item = await findOne('items', { _id: new ObjectId(id), userId: decoded.userId });
    
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Record deletion in stock history with item value
    const totalValue = item.quantity * item.buyPrice;
    await insertOne('stockTransactions', {
      userId: decoded.userId,
      itemId: id,
      quantity: -item.quantity,
      transactionType: 'adjustment',
      notes: `Item deleted: ${item.name} (${item.quantity} ${item.unit}) - Value: ₹${totalValue.toFixed(2)}`,
      transactionDate: new Date(),
      createdAt: new Date(),
    });

    await deleteOne('items', { _id: new ObjectId(id), userId: decoded.userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete item error:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
