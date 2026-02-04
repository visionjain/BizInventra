// Customers API - UPDATE and DELETE customer by ID
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findOne, updateOne, deleteOne, findMany } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

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
    const { name, phoneNumber } = body;
    // Note: outstandingBalance is intentionally excluded from updates
    // It should only be managed through transactions

    if (!name || !phoneNumber) {
      return NextResponse.json({ error: 'Name and phone number are required' }, { status: 400 });
    }

    await connectToMongoDB();

    const updateData = {
      name,
      phoneNumber,
      updatedAt: new Date(),
      lastModifiedAt: new Date(),
    };

    await updateOne('customers', { _id: new ObjectId(id), userId: decoded.userId }, updateData);

    return NextResponse.json({
      success: true,
      customer: { ...updateData, id },
    });
  } catch (error) {
    console.error('Update customer error:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
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

    // Count transactions before deletion
    const transactions = await findMany('transactions', {
      $or: [
        { customerId: new ObjectId(id) },
        { customerId: id }
      ],
      isDeleted: { $ne: true }
    });

    // Soft delete customer
    await updateOne(
      'customers',
      { _id: new ObjectId(id), userId: decoded.userId },
      { isDeleted: true, lastModifiedAt: new Date() }
    );

    // Soft delete all related transactions
    for (const tx of transactions) {
      await updateOne(
        'transactions',
        { _id: new ObjectId(tx._id) },
        { isDeleted: true, lastModifiedAt: new Date() }
      );
    }

    return NextResponse.json({ 
      success: true,
      transactionsDeleted: transactions.length 
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
