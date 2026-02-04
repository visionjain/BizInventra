import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToMongoDB, findOne, findMany, updateOne, insertOne } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';

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

    const body = await request.json();
    const { customerId, paymentAmount, mode, transactionIds } = body;

    if (!customerId || !paymentAmount || !mode) {
      return NextResponse.json(
        { message: 'Missing required fields: customerId, paymentAmount, mode' },
        { status: 400 }
      );
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { message: 'Invalid payment amount' },
        { status: 400 }
      );
    }

    if (mode !== 'fifo' && mode !== 'manual') {
      return NextResponse.json(
        { message: 'Mode must be either "fifo" or "manual"' },
        { status: 400 }
      );
    }

    if (mode === 'manual' && (!transactionIds || transactionIds.length === 0)) {
      return NextResponse.json(
        { message: 'Transaction IDs are required for manual mode' },
        { status: 400 }
      );
    }

    await connectToMongoDB();

    // Verify customer exists
    const customer = await findOne('customers', { _id: new ObjectId(customerId) });
    if (!customer) {
      return NextResponse.json(
        { message: 'Customer not found' },
        { status: 404 }
      );
    }

    // Fetch outstanding transactions
    let outstandingTransactions;
    
    if (mode === 'fifo') {
      // FIFO: Get all outstanding transactions sorted by date (oldest first)
      // Match both ObjectId and string formats for customerId
      outstandingTransactions = await findMany('transactions', {
        $or: [
          { customerId: new ObjectId(customerId) },
          { customerId: customerId }
        ],
        balanceAmount: { $gt: 0 },
        isDeleted: { $ne: true }
      }, { sort: { transactionDate: 1 } }); // Oldest first
    } else {
      // Manual: Get only selected transactions
      // Match both ObjectId and string formats for customerId
      outstandingTransactions = await findMany('transactions', {
        _id: { $in: transactionIds.map((id: string) => new ObjectId(id)) },
        $or: [
          { customerId: new ObjectId(customerId) },
          { customerId: customerId }
        ],
        balanceAmount: { $gt: 0 }
      }, { sort: { transactionDate: 1 } });
    }

    // Apply payment to transactions
    let remainingPayment = amount;
    const updatedTransactions = [];

    for (const transaction of outstandingTransactions) {
      if (remainingPayment <= 0) break;

      const outstandingBalance = transaction.balanceAmount;
      const paymentToApply = Math.min(remainingPayment, outstandingBalance);

      const newPaymentReceived = (transaction.paymentReceived || 0) + paymentToApply;
      const newBalanceAmount = (transaction.totalAmount || transaction.grandTotal || 0) - newPaymentReceived;

      // Update transaction
      await updateOne(
        'transactions',
        { _id: transaction._id },
        {
          paymentReceived: newPaymentReceived,
          balanceAmount: Math.max(0, newBalanceAmount), // Ensure no negative balance
          updatedAt: new Date()
        }
      );

      updatedTransactions.push({
        transactionId: transaction._id.toString(),
        previousBalance: outstandingBalance,
        paymentApplied: paymentToApply,
        newBalance: Math.max(0, newBalanceAmount)
      });

      remainingPayment -= paymentToApply;
    }

    // Recalculate customer's total outstanding balance
    // Match both ObjectId and string formats for customerId
    const allTransactions = await findMany('transactions', { 
      $or: [
        { customerId: new ObjectId(customerId) },
        { customerId: customerId }
      ],
      isDeleted: { $ne: true }
    });

    const totalOutstanding = allTransactions.reduce(
      (sum: number, tx: any) => sum + (tx.balanceAmount || 0),
      0
    );

    // If payment exceeded outstanding, store excess as negative balance (customer credit/advance)
    const finalBalance = totalOutstanding - remainingPayment;

    // Update customer's outstanding balance (negative means customer has advance credit)
    await updateOne(
      'customers',
      { _id: new ObjectId(customerId) },
      {
        outstandingBalance: finalBalance,
        updatedAt: new Date()
      }
    );

    // Create payment record for history tracking
    await insertOne('payments', {
      userId: decoded.userId,
      customerId: new ObjectId(customerId),
      paymentAmount: amount,
      amountApplied: amount - remainingPayment,
      remainingAmount: remainingPayment,
      mode,
      transactionsAffected: updatedTransactions.map(tx => tx.transactionId),
      paymentDate: new Date(),
      createdAt: new Date()
    });

    return NextResponse.json({
      message: outstandingTransactions.length === 0 
        ? 'Advance payment accepted successfully'
        : 'Bulk payment applied successfully',
      paymentAmount: amount,
      amountApplied: amount - remainingPayment,
      remainingAmount: remainingPayment,
      transactionsUpdated: updatedTransactions.length,
      updatedTransactions,
      newCustomerOutstanding: finalBalance,
      customerCredit: finalBalance < 0 ? Math.abs(finalBalance) : 0,
      note: finalBalance < 0 
        ? `Customer has ₹${Math.abs(finalBalance).toFixed(2)} advance credit for future purchases` 
        : remainingPayment > 0 
          ? `₹${remainingPayment} excess payment stored as advance` 
          : 'All outstanding cleared'
    });

  } catch (error: any) {
    console.error('Error applying bulk payment:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}
