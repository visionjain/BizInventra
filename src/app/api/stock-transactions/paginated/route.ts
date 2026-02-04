// Optimized Stock Transactions API with pagination and date filtering
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    const itemId = searchParams.get('itemId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = await connectToMongoDB();

    // Build filter
    const filter: any = {
      userId: decoded.userId
    };

    if (itemId) {
      filter.itemId = itemId;
    }

    if (startDate && endDate) {
      // Parse dates as strings in YYYY-MM-DD format to avoid timezone issues
      // MongoDB will compare the stored date's local date components
      filter.$expr = {
        $and: [
          {
            $gte: [
              { $dateToString: { format: "%Y-%m-%d", date: "$transactionDate" } },
              startDate
            ]
          },
          {
            $lte: [
              { $dateToString: { format: "%Y-%m-%d", date: "$transactionDate" } },
              endDate
            ]
          }
        ]
      };
    }

    // Get total count
    const totalCount = await db.collection('stockTransactions').countDocuments(filter);

    // Get paginated stock transactions with item names
    const stockTransactions = await db.collection('stockTransactions').aggregate([
      { $match: filter },
      { $sort: { transactionDate: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'items',
          let: { itemIdStr: '$itemId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: '$_id' }, '$$itemIdStr']
                }
              }
            }
          ],
          as: 'itemInfo'
        }
      },
      {
        $addFields: {
          itemName: { $arrayElemAt: ['$itemInfo.name', 0] },
          id: { $toString: '$_id' }
        }
      },
      {
        $project: {
          itemInfo: 0
        }
      }
    ]).toArray();

    return NextResponse.json({
      success: true,
      stockTransactions,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Get stock transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock transactions' }, { status: 500 });
  }
}
