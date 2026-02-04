// Optimized Dashboard Stats API - Server-side aggregation
import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/db/mongodb';
import { verifyToken } from '@/lib/auth/utils';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { MongoClient } from 'mongodb';

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

    const db = await connectToMongoDB();

    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Parallel aggregation for better performance
    const [
      weeklyStats,
      monthlyStats,
      yearlyStats,
      inventoryStats,
      customerStats,
      salesTrend,
      topItems,
      weeklyReturns,
      monthlyReturns,
      yearlyReturns,
      weeklyCharges,
      monthlyCharges,
      yearlyCharges
    ] = await Promise.all([
      // Weekly transactions stats
      db.collection('transactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true },
            transactionDate: { $gte: weekStart }
          }
        },
        {
          $addFields: {
            itemsOnlyTotal: {
              $cond: {
                if: { $and: [
                  { $isArray: '$items' },
                  { $gt: [{ $size: '$items' }, 0] }
                ]},
                then: {
                  $reduce: {
                    input: '$items',
                    initialValue: 0,
                    in: { $add: ['$$value', { $multiply: ['$$this.quantity', '$$this.pricePerUnit'] }] }
                  }
                },
                else: { $subtract: ['$totalAmount', { $ifNull: ['$totalAdditionalCharges', 0] }] }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$itemsOnlyTotal' },
            totalProfit: { $sum: '$totalProfit' },
            count: { $sum: 1 },
            totalItems: { 
              $sum: { 
                $sum: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: '$$item.quantity'
                  }
                }
              }
            }
          }
        }
      ]).toArray(),

      // Monthly transactions stats
      db.collection('transactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true },
            transactionDate: { $gte: monthStart }
          }
        },
        {
          $addFields: {
            itemsOnlyTotal: {
              $cond: {
                if: { $and: [
                  { $isArray: '$items' },
                  { $gt: [{ $size: '$items' }, 0] }
                ]},
                then: {
                  $reduce: {
                    input: '$items',
                    initialValue: 0,
                    in: { $add: ['$$value', { $multiply: ['$$this.quantity', '$$this.pricePerUnit'] }] }
                  }
                },
                else: { $subtract: ['$totalAmount', { $ifNull: ['$totalAdditionalCharges', 0] }] }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$itemsOnlyTotal' },
            totalProfit: { $sum: '$totalProfit' },
            count: { $sum: 1 },
            totalItems: { 
              $sum: { 
                $sum: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: '$$item.quantity'
                  }
                }
              }
            }
          }
        }
      ]).toArray(),

      // Yearly transactions stats
      db.collection('transactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true },
            transactionDate: { $gte: yearStart }
          }
        },
        {
          $addFields: {
            itemsOnlyTotal: {
              $cond: {
                if: { $and: [
                  { $isArray: '$items' },
                  { $gt: [{ $size: '$items' }, 0] }
                ]},
                then: {
                  $reduce: {
                    input: '$items',
                    initialValue: 0,
                    in: { $add: ['$$value', { $multiply: ['$$this.quantity', '$$this.pricePerUnit'] }] }
                  }
                },
                else: { $subtract: ['$totalAmount', { $ifNull: ['$totalAdditionalCharges', 0] }] }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$itemsOnlyTotal' },
            totalProfit: { $sum: '$totalProfit' },
            count: { $sum: 1 },
            totalItems: { 
              $sum: { 
                $sum: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: '$$item.quantity'
                  }
                }
              }
            }
          }
        }
      ]).toArray(),

      // Inventory stats
      db.collection('items').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            lowStock: {
              $sum: {
                $cond: [{ $lt: ['$quantity', 10] }, 1, 0]
              }
            },
            totalValue: {
              $sum: { $multiply: ['$sellPrice', '$quantity'] }
            }
          }
        }
      ]).toArray(),

      // Customer stats
      db.collection('customers').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            outstanding: { $sum: '$outstandingBalance' }
          }
        }
      ]).toArray(),

      // Last 7 days sales trend
      db.collection('transactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true },
            transactionDate: { $gte: weekStart }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$transactionDate' }
            },
            sales: { $sum: '$totalAmount' },
            profit: {
              $sum: {
                $multiply: [
                  { $divide: ['$paymentReceived', { $ifNull: ['$totalAmount', 1] }] },
                  '$totalProfit'
                ]
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray(),

      // Top 5 selling items
      db.collection('transactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true }
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.itemId',
            name: { $first: '$items.name' },
            quantity: { $sum: '$items.quantity' },
            revenue: {
              $sum: {
                $multiply: ['$items.quantity', '$items.pricePerUnit']
              }
            }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ]).toArray(),

      // Weekly returns
      db.collection('returnTransactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true },
            transactionDate: { $gte: weekStart }
          }
        },
        {
          $group: {
            _id: null,
            totalReturnValue: { $sum: '$totalReturnValue' },
            totalProfitLost: { $sum: '$totalProfitLost' }
          }
        }
      ]).toArray(),

      // Monthly returns
      db.collection('returnTransactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true },
            transactionDate: { $gte: monthStart }
          }
        },
        {
          $group: {
            _id: null,
            totalReturnValue: { $sum: '$totalReturnValue' },
            totalProfitLost: { $sum: '$totalProfitLost' }
          }
        }
      ]).toArray(),

      // Yearly returns
      db.collection('returnTransactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true },
            transactionDate: { $gte: yearStart }
          }
        },
        {
          $group: {
            _id: null,
            totalReturnValue: { $sum: '$totalReturnValue' },
            totalProfitLost: { $sum: '$totalProfitLost' }
          }
        }
      ]).toArray(),

      // Weekly additional charges
      db.collection('transactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true },
            transactionDate: { $gte: weekStart }
          }
        },
        {
          $group: {
            _id: null,
            totalCharges: { $sum: { $ifNull: ['$totalAdditionalCharges', 0] } }
          }
        }
      ]).toArray(),

      // Monthly additional charges
      db.collection('transactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true },
            transactionDate: { $gte: monthStart }
          }
        },
        {
          $group: {
            _id: null,
            totalCharges: { $sum: { $ifNull: ['$totalAdditionalCharges', 0] } }
          }
        }
      ]).toArray(),

      // Yearly additional charges
      db.collection('transactions').aggregate([
        {
          $match: {
            userId: decoded.userId,
            isDeleted: { $ne: true },
            transactionDate: { $gte: yearStart }
          }
        },
        {
          $group: {
            _id: null,
            totalCharges: { $sum: { $ifNull: ['$totalAdditionalCharges', 0] } }
          }
        }
      ]).toArray()
    ]);

    // Format response
    const weekly = weeklyStats[0] || { totalSales: 0, totalProfit: 0, count: 0, totalItems: 0 };
    const monthly = monthlyStats[0] || { totalSales: 0, totalProfit: 0, count: 0, totalItems: 0 };
    const yearly = yearlyStats[0] || { totalSales: 0, totalProfit: 0, count: 0, totalItems: 0 };
    const inventory = inventoryStats[0] || { totalItems: 0, lowStock: 0, totalValue: 0 };
    const customers = customerStats[0] || { total: 0, outstanding: 0 };
    const wReturns = weeklyReturns[0] || { totalReturnValue: 0, totalProfitLost: 0 };
    const mReturns = monthlyReturns[0] || { totalReturnValue: 0, totalProfitLost: 0 };
    const yReturns = yearlyReturns[0] || { totalReturnValue: 0, totalProfitLost: 0 };
    const wCharges = weeklyCharges[0] || { totalCharges: 0 };
    const mCharges = monthlyCharges[0] || { totalCharges: 0 };
    const yCharges = yearlyCharges[0] || { totalCharges: 0 };

    return NextResponse.json({
      success: true,
      stats: {
        weekly: {
          sales: weekly.totalSales,
          profit: weekly.totalProfit,
          transactions: weekly.count,
          itemsSold: weekly.totalItems,
          additionalCharges: wCharges.totalCharges,
          returns: wReturns.totalReturnValue,
          returnsProfit: wReturns.totalProfitLost
        },
        monthly: {
          sales: monthly.totalSales,
          profit: monthly.totalProfit,
          transactions: monthly.count,
          itemsSold: monthly.totalItems,
          additionalCharges: mCharges.totalCharges,
          returns: mReturns.totalReturnValue,
          returnsProfit: mReturns.totalProfitLost
        },
        yearly: {
          sales: yearly.totalSales,
          profit: yearly.totalProfit,
          transactions: yearly.count,
          itemsSold: yearly.totalItems,
          additionalCharges: yCharges.totalCharges,
          returns: yReturns.totalReturnValue,
          returnsProfit: yReturns.totalProfitLost
        },
        inventory: {
          totalItems: inventory.totalItems,
          lowStock: inventory.lowStock,
          totalValue: inventory.totalValue
        },
        customers: {
          total: customers.total,
          outstanding: customers.outstanding
        }
      },
      chartData: {
        salesTrend: salesTrend.map((day: any) => ({
          date: new Date(day._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sales: parseFloat((day.sales || 0).toFixed(2)),
          profit: parseFloat((day.profit || 0).toFixed(2))
        })),
        topItems: topItems.map((item: any) => ({
          name: item.name && item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name || 'Unknown',
          quantity: item.quantity,
          revenue: parseFloat((item.revenue || 0).toFixed(2))
        }))
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
