// Customers API - GET all customers and POST new customer
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findMany, insertOne } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';

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
    
    const customers = await findMany('customers', { userId: decoded.userId, isDeleted: false });

    return NextResponse.json({ success: true, customers });
  } catch (error) {
    console.error('Get customers error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
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
    const { name, phoneNumber, outstandingBalance } = body;

    if (!name || !phoneNumber) {
      return NextResponse.json({ error: 'Name and phone number are required' }, { status: 400 });
    }

    await connectToMongoDB();

    const newCustomer = {
      userId: decoded.userId,
      name,
      phoneNumber,
      outstandingBalance: outstandingBalance || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      lastModifiedAt: new Date(),
    };

    const result = await insertOne('customers', newCustomer);

    return NextResponse.json({
      success: true,
      customer: { ...newCustomer, _id: result, id: result },
    });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}
