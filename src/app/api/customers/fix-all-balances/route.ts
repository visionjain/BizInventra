// Fix all customer balances by recalculating from transactions
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findMany, updateOne } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

// export const dynamic = 'force-dynamic'; // Commented for static export

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

    await connectToMongoDB();

    // Get all customers for this user
    const customers = await findMany('customers', { userId: decoded.userId });
    
    let totalCustomersFixed = 0;
    let totalTransactionsFixed = 0;
    const customerSummary: any[] = [];

    for (const customer of customers) {
      const customerId = customer._id;
      
      // Get all non-deleted transactions for this customer (match both ObjectId and string formats)
      const transactions = await findMany('transactions', {
        $or: [
          { customerId: new ObjectId(customerId) },
          { customerId: customerId.toString() }
        ],
        isDeleted: { $ne: true }
      });

      let customerOutstanding = 0;
      let transactionsUpdated = 0;

      // Fix each transaction's balanceAmount
      for (const tx of transactions) {
        const total = tx.grandTotal || tx.totalAmount || 0;
        const paid = tx.paymentReceived || 0;
        const correctBalance = total - paid;
        
        // Update if balance is incorrect or missing
        if (tx.balanceAmount !== correctBalance) {
          await updateOne(
            'transactions',
            { _id: new ObjectId(tx._id) },
            { 
              $set: { 
                balanceAmount: correctBalance,
                lastModifiedAt: new Date()
              }
            }
          );
          transactionsUpdated++;
        }
        
        customerOutstanding += correctBalance;
      }

      // Update customer's outstanding balance
      await updateOne(
        'customers',
        { _id: new ObjectId(customerId) },
        { 
          $set: { 
            outstandingBalance: customerOutstanding,
            lastModifiedAt: new Date()
          }
        }
      );

      if (transactionsUpdated > 0 || customer.outstandingBalance !== customerOutstanding) {
        totalCustomersFixed++;
        totalTransactionsFixed += transactionsUpdated;
        customerSummary.push({
          name: customer.name,
          transactionsFixed: transactionsUpdated,
          oldBalance: customer.outstandingBalance,
          newBalance: customerOutstanding
        });
      }
    }

    return NextResponse.json({ 
      success: true,
      totalCustomers: customers.length,
      customersFixed: totalCustomersFixed,
      transactionsFixed: totalTransactionsFixed,
      summary: customerSummary
    });
  } catch (error) {
    console.error('Fix all balances error:', error);
    return NextResponse.json({ 
      error: 'Failed to fix balances',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
