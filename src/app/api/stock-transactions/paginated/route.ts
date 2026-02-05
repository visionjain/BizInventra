// Optimized Stock Transactions API with pagination and date filtering
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-static';

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
      // Adjust for IST timezone (UTC+5:30)
      // IST day starts at 18:30 UTC previous day and ends at 18:30 UTC same day
      const startParts = startDate.split('-').map(Number);
      const endParts = endDate.split('-').map(Number);
      
      // Start: previous day at 18:30 UTC (midnight IST)
      const startDateTime = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2] - 1, 18, 30, 0, 0));
      // End: same day at 18:29:59.999 UTC (23:59:59.999 IST)
      const endDateTime = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2], 18, 29, 59, 999));
      
      filter.transactionDate = {
        $gte: startDateTime,
        $lte: endDateTime
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
