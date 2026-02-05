export const dynamic = 'force-static';

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToMongoDB, findMany, updateOne, findOne } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';

// export const dynamic = 'force-static'; // Commented for static export

// This endpoint fixes transaction balances for customers
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
    const { customerId } = body;

    if (!customerId) {
      return NextResponse.json(
        { message: 'Customer ID is required' },
        { status: 400 }
      );
    }

    await connectToMongoDB();

    // Get customer
    const customer = await findOne('customers', { _id: new ObjectId(customerId) });
    if (!customer) {
      return NextResponse.json(
        { message: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get all non-deleted transactions for this customer
    const transactions = await findMany('transactions', {
      customerId: new ObjectId(customerId),
      isDeleted: { $ne: true }
    });

    let fixedCount = 0;
    let totalOutstanding = 0;
    const transactionDetails = [];

    // Fix each transaction's balanceAmount
    for (const tx of transactions) {
      const grandTotal = tx.grandTotal || tx.totalAmount || 0;
      const paymentReceived = tx.paymentReceived || 0;
      const calculatedBalance = grandTotal - paymentReceived;

      transactionDetails.push({
        id: tx._id.toString(),
        date: tx.transactionDate,
        grandTotal,
        totalAmount: tx.totalAmount,
        paymentReceived,
        calculatedBalance,
        oldBalance: tx.balanceAmount,
        isDeleted: tx.isDeleted || false
      });

      // Only update if balanceAmount is missing or incorrect
      if (tx.balanceAmount === undefined || tx.balanceAmount === null || Math.abs(tx.balanceAmount - calculatedBalance) > 0.01) {
        await updateOne(
          'transactions',
          { _id: tx._id },
          {
            balanceAmount: calculatedBalance,
            updatedAt: new Date()
          }
        );
        fixedCount++;
      }

      totalOutstanding += calculatedBalance;
    }

    // Update customer's outstanding balance
    await updateOne(
      'customers',
      { _id: new ObjectId(customerId) },
      {
        outstandingBalance: totalOutstanding,
        updatedAt: new Date()
      }
    );

    return NextResponse.json({
      message: 'Balances fixed successfully',
      transactionsFixed: fixedCount,
      totalTransactions: transactions.length,
      newOutstandingBalance: totalOutstanding,
      oldOutstandingBalance: customer.outstandingBalance,
      transactionDetails
    });

  } catch (error: any) {
    console.error('Error fixing balances:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}
