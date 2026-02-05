// Get payment history for a specific customer
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findMany } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-static';

export async function GET(
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

    await connectToMongoDB();
    
    const { id } = await params;

    // Get all payment records for this customer, sorted by date (newest first)
    const payments = await findMany(
      'payments',
      {
        customerId: new ObjectId(id),
        userId: decoded.userId
      },
      { sort: { paymentDate: -1 } }
    );

    return NextResponse.json({
      success: true,
      payments
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    );
  }
}
