// Customer-Specific Pricing API
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findOne, updateOne } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-static';

// GET customer prices for an item
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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

    const { id } = await context.params;

    await connectToMongoDB();
    
    const item = await findOne('items', {
      _id: new ObjectId(id),
      userId: decoded.userId,
      isDeleted: { $ne: true }
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      customerPrices: item.customerPrices || []
    });
  } catch (error) {
    console.error('Get customer prices error:', error);
    return NextResponse.json({ error: 'Failed to fetch customer prices' }, { status: 500 });
  }
}

// PUT - Add or update customer-specific price
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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

    const { id } = await context.params;
    const body = await request.json();
    const { customerId, price } = body;

    if (!customerId || price === undefined || price < 0) {
      return NextResponse.json(
        { error: 'Valid customerId and price are required' },
        { status: 400 }
      );
    }

    await connectToMongoDB();
    
    // Verify item exists and belongs to user
    const item = await findOne('items', {
      _id: new ObjectId(id),
      userId: decoded.userId,
      isDeleted: { $ne: true }
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Get current customer prices
    const customerPrices = item.customerPrices || [];
    const existingIndex = customerPrices.findIndex(
      (cp: any) => cp.customerId.toString() === customerId.toString()
    );

    // Update or add new price
    if (existingIndex >= 0) {
      customerPrices[existingIndex].price = parseFloat(price);
    } else {
      customerPrices.push({
        customerId: new ObjectId(customerId),
        price: parseFloat(price)
      });
    }

    // Update item
    await updateOne(
      'items',
      { _id: new ObjectId(id) },
      {
        $set: {
          customerPrices,
          updatedAt: new Date(),
          lastModifiedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Customer price updated successfully',
      customerPrices
    });
  } catch (error) {
    console.error('Update customer price error:', error);
    return NextResponse.json({ error: 'Failed to update customer price' }, { status: 500 });
  }
}

// DELETE - Remove customer-specific price
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    await connectToMongoDB();
    
    // Verify item exists and belongs to user
    const item = await findOne('items', {
      _id: new ObjectId(id),
      userId: decoded.userId,
      isDeleted: { $ne: true }
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Remove customer price
    const customerPrices = (item.customerPrices || []).filter(
      (cp: any) => cp.customerId.toString() !== customerId.toString()
    );

    // Update item
    await updateOne(
      'items',
      { _id: new ObjectId(id) },
      {
        $set: {
          customerPrices,
          updatedAt: new Date(),
          lastModifiedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Customer price removed successfully',
      customerPrices
    });
  } catch (error) {
    console.error('Delete customer price error:', error);
    return NextResponse.json({ error: 'Failed to delete customer price' }, { status: 500 });
  }
}
