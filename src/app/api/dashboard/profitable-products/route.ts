export const dynamic = 'force-static';

import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'weekly';

    const db = await connectToMongoDB();

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'weekly':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    // Aggregate transactions to calculate profit per product
    const transactions = await db.collection('transactions').aggregate([
      {
        $match: {
          userId: decoded.userId,
          createdAt: { $gte: startDate },
          isDeleted: { $ne: true }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $addFields: {
          'items.itemIdObj': { $toObjectId: '$items.itemId' }
        }
      },
      {
        $lookup: {
          from: 'items',
          localField: 'items.itemIdObj',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      {
        $unwind: {
          path: '$itemDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$items.itemId',
          name: { 
            $first: { 
              $ifNull: [
                '$items.name',
                { $ifNull: ['$items.itemName', '$itemDetails.name'] }
              ]
            }
          },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.pricePerUnit'] } },
          totalCost: { 
            $sum: { 
              $multiply: [
                '$items.quantity', 
                { $ifNull: ['$items.buyPrice', 0] }
              ] 
            } 
          }
        }
      },
      {
        $project: {
          name: 1,
          quantity: '$totalQuantity',
          revenue: '$totalRevenue',
          profit: { $subtract: ['$totalRevenue', '$totalCost'] }
        }
      },
      {
        $sort: { profit: -1 }
      },
      {
        $limit: 10
      }
    ]).toArray();

    const products = transactions.map((item: any) => ({
      name: item.name || 'Unknown Product',
      quantity: item.quantity || 0,
      revenue: Math.round((item.revenue || 0) * 100) / 100,
      profit: Math.round((item.profit || 0) * 100) / 100
    }));

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching profitable products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profitable products' },
      { status: 500 }
    );
  }
}
