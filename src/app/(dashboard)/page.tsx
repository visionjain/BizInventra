'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { PullToRefresh } from '@/components/PullToRefresh';
import { LogOut, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users, Calendar, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface DashboardStats {
  weekly: {
    sales: number;
    profit: number;
    realizedProfit: number;
    unrealizedProfit: number;
    outstanding: number;
    transactions: number;
    itemsSold: number;
    additionalCharges: number;
    returns: number;
    returnsProfit: number;
  };
  monthly: {
    sales: number;
    profit: number;
    realizedProfit: number;
    unrealizedProfit: number;
    outstanding: number;
    transactions: number;
    itemsSold: number;
    additionalCharges: number;
    returns: number;
    returnsProfit: number;
  };
  yearly: {
    sales: number;
    profit: number;
    realizedProfit: number;
    unrealizedProfit: number;
    outstanding: number;
    transactions: number;
    itemsSold: number;
    additionalCharges: number;
    returns: number;
    returnsProfit: number;
  };
  today: {
    outstanding: number;
  };
  inventory: {
    totalItems: number;
    lowStock: number;
    totalValue: number;
  };
  customers: {
    total: number;
    outstanding: number;
  };
}

interface ChartData {
  salesTrend: Array<{ date: string; sales: number; profit: number; }>;
  profitableProducts: Array<{ name: string; quantity: number; revenue: number; profit: number; }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, checkAuth } = useAuthStore();
  const [loading, setLoading] = useState(true);
  
  // Get today's date
  const getTodayDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [timePeriod, setTimePeriod] = useState<'weekly' | 'monthly' | 'yearly' | 'custom'>('custom');
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [stats, setStats] = useState<DashboardStats>({
    weekly: { sales: 0, profit: 0, realizedProfit: 0, unrealizedProfit: 0, outstanding: 0, transactions: 0, itemsSold: 0, additionalCharges: 0, returns: 0, returnsProfit: 0 },
    monthly: { sales: 0, profit: 0, realizedProfit: 0, unrealizedProfit: 0, outstanding: 0, transactions: 0, itemsSold: 0, additionalCharges: 0, returns: 0, returnsProfit: 0 },
    yearly: { sales: 0, profit: 0, realizedProfit: 0, unrealizedProfit: 0, outstanding: 0, transactions: 0, itemsSold: 0, additionalCharges: 0, returns: 0, returnsProfit: 0 },
    today: { outstanding: 0 },
    inventory: { totalItems: 0, lowStock: 0, totalValue: 0 },
    customers: { total: 0, outstanding: 0 },
  });
  const [customStats, setCustomStats] = useState({ sales: 0, profit: 0, realizedProfit: 0, unrealizedProfit: 0, outstanding: 0, transactions: 0, itemsSold: 0, additionalCharges: 0, returns: 0, returnsProfit: 0 });
  const [profitPeriod, setProfitPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [isUpdating, setIsUpdating] = useState(false);
  const [chartData, setChartData] = useState<ChartData>({
    salesTrend: [],
    profitableProducts: [],
  });

  useEffect(() => {
    console.log('Dashboard mounted, checking auth...');
    const token = localStorage.getItem('auth_token');
    console.log('Token:', token ? 'exists' : 'missing');
    
    if (!token) {
      console.log('No token, redirecting to login...');
      // Redirect to login page
      window.location.href = '/login/';
      return;
    }
    
    console.log('Token found, loading dashboard...');
    checkAuth();
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, startDate, endDate, timePeriod, profitPeriod]);

  const loadDashboardData = async () => {
    console.log('Dashboard: loadDashboardData started');
    setLoading(true);
    
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      const isNative = platform === 'android' || platform === 'ios';
      
      // Helper function for HTTP requests
      const apiRequest = async (url: string) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://bizinventra.vercel.app';
        const fullUrl = isNative ? `${apiUrl}${url}` : url;
        
        console.log('API Request:', fullUrl, 'isNative:', isNative);
        
        if (isNative) {
          const { CapacitorHttp } = await import('@capacitor/core');
          const token = localStorage.getItem('auth_token');
          const response = await CapacitorHttp.get({
            url: fullUrl,
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          console.log('Capacitor HTTP response:', response.status, response.data);
          return { ok: response.status === 200, json: async () => response.data };
        } else {
          const token = localStorage.getItem('auth_token');
          const response = await fetch(fullUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          return { ok: response.ok, json: async () => response.json() };
        }
      };
      
      // Helper function for calculating stats from transactions
      const calculatePeriodStats = (txs: any[]) => {
        return {
          sales: txs.reduce((sum, tx) => sum + (tx.totalAmount - (tx.totalAdditionalCharges || 0)), 0),
          profit: txs.reduce((sum, tx) => sum + (tx.totalProfit || 0), 0),
          realizedProfit: txs.filter(tx => tx.balanceAmount === 0).reduce((sum, tx) => sum + (tx.totalProfit || 0), 0),
          unrealizedProfit: txs.filter(tx => tx.balanceAmount > 0).reduce((sum, tx) => sum + (tx.totalProfit || 0), 0),
          outstanding: txs.reduce((sum, tx) => sum + tx.balanceAmount, 0),
          transactions: txs.length,
          itemsSold: txs.reduce((sum, tx) => sum + (tx.items?.length || 0), 0),
          additionalCharges: txs.reduce((sum, tx) => sum + (tx.totalAdditionalCharges || 0), 0),
          returns: 0,
          returnsProfit: 0
        };
      };
      
      // Step 1: Load from cache immediately (native only)
      if (isNative && user) {
        const { getTransactionsOffline, getItemsOffline, getCustomersOffline } = await import('@/lib/db/sqlite');
        
        const [transactions, items, customers] = await Promise.all([
          getTransactionsOffline(user.id),
          getItemsOffline(user.id),
          getCustomersOffline(user.id)
        ]);
        
        // Calculate stats from cached data
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        
        const weeklyTxs = transactions.filter(tx => new Date(tx.transactionDate) >= weekAgo);
        const monthlyTxs = transactions.filter(tx => new Date(tx.transactionDate) >= monthAgo);
        const yearlyTxs = transactions.filter(tx => new Date(tx.transactionDate) >= yearAgo);
        
        setStats({
          weekly: calculatePeriodStats(weeklyTxs),
          monthly: calculatePeriodStats(monthlyTxs),
          yearly: calculatePeriodStats(yearlyTxs),
          today: { outstanding: transactions.reduce((sum, tx) => sum + tx.balanceAmount, 0) },
          inventory: {
            totalItems: items.length,
            lowStock: items.filter(i => i.quantity < 10).length,
            totalValue: items.reduce((sum, i) => sum + (i.quantity * i.buyPrice), 0)
          },
          customers: {
            total: customers.length,
            outstanding: customers.reduce((sum, c) => sum + (c.balance || 0), 0)
          }
        });
        
        // Calculate custom stats if needed
        if (timePeriod === 'custom' && startDate && endDate) {
          const customTxs = transactions.filter(tx => {
            const txDate = new Date(tx.transactionDate);
            return txDate >= new Date(startDate) && txDate <= new Date(endDate);
          });
          setCustomStats(calculatePeriodStats(customTxs));
        }
        
        // Use empty chart data for cache
        setChartData({
          salesTrend: [],
          profitableProducts: []
        });
        
        console.log('Dashboard: Displayed cache immediately');
      }
      
      // Remove loading spinner after cache display
      setLoading(false);
      
      // Step 2: Check connectivity
      let isOnline = navigator.onLine;
      if (isNative) {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        isOnline = status.connected;
      }
      
      // Step 3: Background sync if online
      if (isOnline) {
        setIsUpdating(true);
        
        try {
          console.log('Dashboard: Background sync started');
          
          // Fetch custom period stats if needed
          if (timePeriod === 'custom' && startDate && endDate) {
            const customResponse = await apiRequest(`/api/transactions/paginated?startDate=${startDate}&endDate=${endDate}&limit=1000`);
            if (customResponse.ok) {
              const customData = await customResponse.json();
              const transactions = customData.transactions || [];
              
              // Calculate custom stats
              let totalSales = 0;
              let totalProfit = 0;
              let totalRealizedProfit = 0;
              let totalUnrealizedProfit = 0;
              let totalOutstanding = 0;
              let totalCharges = 0;
              let totalReturns = 0;
              let totalReturnsProfit = 0;
              
              transactions.forEach((tx: any) => {
                const itemsTotal = tx.items?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.pricePerUnit || 0)), 0) || 0;
                totalSales += itemsTotal;
                totalProfit += tx.totalProfit || 0;
                totalCharges += tx.totalAdditionalCharges || 0;
                totalOutstanding += tx.balanceAmount || 0;
                
                // Calculate realized vs unrealized profit
                if (tx.balanceAmount === 0) {
                  totalRealizedProfit += tx.totalProfit || 0;
                } else if (tx.balanceAmount > 0) {
                  totalUnrealizedProfit += tx.totalProfit || 0;
                }
              });
              
              setCustomStats({
                sales: totalSales,
                profit: totalProfit,
                realizedProfit: totalRealizedProfit,
                unrealizedProfit: totalUnrealizedProfit,
                outstanding: totalOutstanding,
                transactions: transactions.length,
                itemsSold: transactions.reduce((sum: number, tx: any) => sum + (tx.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0), 0),
                additionalCharges: totalCharges,
                returns: totalReturns,
                returnsProfit: totalReturnsProfit
              });
            }
          }
          
          // Fetch predefined period stats
          const response = await apiRequest('/api/dashboard/stats');
          if (response.ok) {
            const data = await response.json();
            
            // Update stats from server
            setStats({
              weekly: data.stats.weekly,
              monthly: data.stats.monthly,
              yearly: data.stats.yearly,
              today: data.stats.today,
              inventory: data.stats.inventory,
              customers: data.stats.customers
            });
            
            // Fetch profitable products
            const profitResponse = await apiRequest(`/api/dashboard/profitable-products?period=${profitPeriod}`);
            const profitData = profitResponse.ok ? await profitResponse.json() : { products: [] };
            
            // Update chart data
            setChartData({
              salesTrend: data.chartData.salesTrend,
              profitableProducts: profitData.products || [],
            });
            
            console.log('Dashboard: Background sync completed');
          }
        } catch (error) {
          console.log('Dashboard: Background sync failed', error);
        } finally {
          setIsUpdating(false);
        }
      }
    } catch (error) {
      console.error('Dashboard: Failed to load data', error);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login/';
  };

  if (!user) {
    return null;
  }

  return (
    <PullToRefresh onRefresh={loadDashboardData}>
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Bizinventra" className="h-12 w-12" />
              <img src="/titlelogo.png" alt="Bizinventra" className="h-10 hidden md:block" />
            </div>
            <div className="flex items-center gap-4">
              <ConnectionStatus onRefresh={loadDashboardData} isUpdating={isUpdating} />
              <div className="text-right">
                <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
                <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
              </div>
              <Button onClick={handleLogout} variant="outline">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b fixed left-0 right-0 z-30" style={{ top: 'calc(92px + env(safe-area-inset-top))' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <button
              className="px-4 py-3 text-blue-600 border-b-2 border-blue-600 font-medium"
            >
              Dashboard
            </button>
            <button
              onClick={() => { const url = new URL('items/index.html', window.location.href); window.location.href = url.href; }}
              className="px-4 py-3 text-gray-600 hover:text-blue-600 hover:border-b-2 hover:border-blue-600"
            >
              Items
            </button>
            <button
              onClick={() => { const url = new URL('customers/index.html', window.location.href); window.location.href = url.href; }}
              className="px-4 py-3 text-gray-600 hover:text-blue-600 hover:border-b-2 hover:border-blue-600"
            >
              Customers
            </button>
            <button
              onClick={() => { const url = new URL('sales/index.html', window.location.href); window.location.href = url.href; }}
              className="px-4 py-3 text-gray-600 hover:text-blue-600 hover:border-b-2 hover:border-blue-600"
            >
              Sales
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8" style={{ paddingTop: 'calc(152px + env(safe-area-inset-top))' }}>
        {loading ? (
          <div className="space-y-6">
            {/* Loading Skeleton */}
            <div className="flex items-center justify-center gap-2 text-blue-600 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-lg font-medium">Loading dashboard data...</p>
            </div>
            
            {/* Skeleton Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Skeleton Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>

            {/* Skeleton Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-64 bg-gray-100 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Time Period Selector */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setTimePeriod('weekly')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        timePeriod === 'weekly'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setTimePeriod('monthly')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        timePeriod === 'monthly'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setTimePeriod('yearly')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        timePeriod === 'yearly'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Yearly
                    </button>
                    <button
                      onClick={() => setTimePeriod('custom')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        timePeriod === 'custom'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Custom Range
                    </button>
                  </div>
                </div>
                
                {/* Custom Date Range Selector */}
                {timePeriod === 'custom' && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-gray-200">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">From Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">To Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => {
                          const now = new Date();
                          const year = now.getFullYear();
                          const month = String(now.getMonth() + 1).padStart(2, '0');
                          const day = String(now.getDate()).padStart(2, '0');
                          const today = `${year}-${month}-${day}`;
                          setStartDate(today);
                          setEndDate(today);
                        }}
                        variant="secondary"
                        className="whitespace-nowrap"
                      >
                        Today
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Stats Based on Selected Period */}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {timePeriod === 'custom' ? 'Sales (Custom Range)' : timePeriod === 'weekly' ? 'Sales (Last 7 Days)' : timePeriod === 'monthly' ? 'Sales This Month' : 'Sales This Year'}
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        ₹{(timePeriod === 'custom' ? customStats.sales : stats[timePeriod].sales).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{timePeriod === 'custom' ? customStats.transactions : stats[timePeriod].transactions} transactions • Gross sales</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {timePeriod === 'custom' ? 'Profit (Custom Range)' : timePeriod === 'weekly' ? 'Profit (Last 7 Days)' : timePeriod === 'monthly' ? 'Profit This Month' : 'Profit This Year'}
                      </p>
                      <p className="text-3xl font-bold text-green-600 mt-2">
                        ₹{(timePeriod === 'custom' ? customStats.profit : stats[timePeriod].profit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Realized: ₹{(timePeriod === 'custom' ? customStats.realizedProfit : stats[timePeriod].realizedProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })} • 
                        Unrealized: ₹{(timePeriod === 'custom' ? customStats.unrealizedProfit : stats[timePeriod].unrealizedProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Transactions</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{timePeriod === 'custom' ? customStats.transactions : stats[timePeriod].transactions}</p>
                      <p className="text-xs text-gray-500 mt-1">Sales completed</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Items Sold</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{timePeriod === 'custom' ? customStats.itemsSold : stats[timePeriod].itemsSold}</p>
                      <p className="text-xs text-gray-500 mt-1">Total quantity</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {timePeriod === 'custom' ? 'Charges (Custom Range)' : timePeriod === 'weekly' ? 'Charges (Last 7 Days)' : timePeriod === 'monthly' ? 'Charges This Month' : 'Charges This Year'}
                      </p>
                      <p className="text-3xl font-bold text-amber-600 mt-2">
                        ₹{(timePeriod === 'custom' ? customStats.additionalCharges : stats[timePeriod].additionalCharges).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Additional charges income</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {timePeriod === 'custom' ? 'Returns (Custom Range)' : timePeriod === 'weekly' ? 'Returns (Last 7 Days)' : timePeriod === 'monthly' ? 'Returns This Month' : 'Returns This Year'}
                      </p>
                      <p className="text-3xl font-bold text-red-600 mt-2">
                        ₹{(timePeriod === 'custom' ? customStats.returns : stats[timePeriod].returns).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Sales returned</p>
                    </div>
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {timePeriod === 'custom' ? 'Net Sales (Custom Range)' : timePeriod === 'weekly' ? 'Net Sales (Last 7 Days)' : timePeriod === 'monthly' ? 'Net Sales This Month' : 'Net Sales This Year'}
                      </p>
                      <p className="text-3xl font-bold text-indigo-600 mt-2">
                        ₹{((timePeriod === 'custom' ? customStats.sales - customStats.returns : stats[timePeriod].sales - stats[timePeriod].returns)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Sales - Returns</p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {timePeriod === 'custom' ? 'Outstanding (Custom Range)' : timePeriod === 'weekly' ? 'Outstanding (Last 7 Days)' : timePeriod === 'monthly' ? 'Outstanding This Month' : 'Outstanding This Year'}
                      </p>
                      <p className="text-3xl font-bold text-orange-600 mt-2">
                        ₹{(timePeriod === 'custom' ? customStats.outstanding : stats[timePeriod].outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Pending payments</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <TrendingDown className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Period Comparison */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">All Periods Comparison</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* This Week */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Last 7 Days
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-sm text-gray-600">Total Sales</span>
                      <span className="text-lg font-bold text-gray-900">
                        ₹{stats.weekly.sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-sm text-gray-600">Total Profit</span>
                      <span className="text-lg font-bold text-green-600">
                        ₹{stats.weekly.profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Transactions</span>
                      <span className="text-lg font-bold text-gray-900">{stats.weekly.transactions}</span>
                    </div>
                  </div>
                </div>

                {/* This Month */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    This Month ({new Date().toLocaleDateString('en-US', { month: 'long' })})
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-sm text-gray-600">Total Sales</span>
                      <span className="text-lg font-bold text-gray-900">
                        ₹{stats.monthly.sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-sm text-gray-600">Total Profit</span>
                      <span className="text-lg font-bold text-green-600">
                        ₹{stats.monthly.profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Transactions</span>
                      <span className="text-lg font-bold text-gray-900">{stats.monthly.transactions}</span>
                    </div>
                  </div>
                </div>

                {/* This Year */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    This Year ({new Date().getFullYear()})
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-sm text-gray-600">Total Sales</span>
                      <span className="text-lg font-bold text-gray-900">
                        ₹{stats.yearly.sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-sm text-gray-600">Total Profit</span>
                      <span className="text-lg font-bold text-green-600">
                        ₹{stats.yearly.profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Transactions</span>
                      <span className="text-lg font-bold text-gray-900">{stats.yearly.transactions}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory & Customers */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Health</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">Inventory</h3>
                    <Package className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.inventory.totalItems}</p>
                      <p className="text-xs text-gray-500">Total items</p>
                    </div>
                    <div className="pt-3 border-t">
                      <p className="text-sm text-gray-600">Inventory Value</p>
                      <p className="text-lg font-semibold text-blue-600">
                        ₹{stats.inventory.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {stats.inventory.lowStock > 0 && (
                      <div className="pt-3 border-t">
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <TrendingDown className="w-4 h-4" />
                          {stats.inventory.lowStock} items low on stock
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">Customers</h3>
                    <Users className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.customers.total}</p>
                      <p className="text-xs text-gray-500">Total customers</p>
                    </div>
                    <div className="pt-3 border-t">
                      <p className="text-sm text-gray-600">Outstanding</p>
                      <p className="text-lg font-semibold text-red-600">
                        ₹{stats.customers.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow p-6 text-white">
                  <h3 className="text-sm font-medium mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => { const url = new URL('sales/index.html', window.location.href); window.location.href = url.href; }}
                      className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 text-left transition-colors"
                    >
                      <p className="font-semibold">New Sale</p>
                      <p className="text-xs opacity-90">Create transaction</p>
                    </button>
                    <button
                      onClick={() => { const url = new URL('items/index.html', window.location.href); window.location.href = url.href; }}
                      className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 text-left transition-colors"
                    >
                      <p className="font-semibold">Add Item</p>
                      <p className="text-xs opacity-90">Manage inventory</p>
                    </button>
                    <button
                      onClick={() => { const url = new URL('customers/index.html', window.location.href); window.location.href = url.href; }}
                      className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 text-left transition-colors"
                    >
                      <p className="font-semibold">View Customers</p>
                      <p className="text-xs opacity-90">Manage customers</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">Analytics & Insights</h2>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Sales Trend Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-md font-semibold text-gray-700 mb-4">
                    Sales & Profit Trend (Last 7 Days)
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData.salesTrend}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '8px'
                        }}
                        formatter={(value: number | undefined) => value ? `₹${value.toLocaleString('en-IN')}` : '₹0'}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="sales" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" />
                      <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Most Profitable Products Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-md font-semibold text-gray-700">
                      Most Profitable Products
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant={profitPeriod === 'weekly' ? 'primary' : 'outline'}
                        onClick={() => setProfitPeriod('weekly')}
                        className="text-xs px-3 py-1"
                      >
                        Weekly
                      </Button>
                      <Button
                        variant={profitPeriod === 'monthly' ? 'primary' : 'outline'}
                        onClick={() => setProfitPeriod('monthly')}
                        className="text-xs px-3 py-1"
                      >
                        Monthly
                      </Button>
                      <Button
                        variant={profitPeriod === 'yearly' ? 'primary' : 'outline'}
                        onClick={() => setProfitPeriod('yearly')}
                        className="text-xs px-3 py-1"
                      >
                        Yearly
                      </Button>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.profitableProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <YAxis dataKey="name" type="category" stroke="#6b7280" style={{ fontSize: '11px' }} width={120} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '8px'
                        }}
                        formatter={(value: number | undefined, name: string | undefined) => {
                          if (!value) return ['0', name || ''];
                          if (name === 'Profit (₹)') return [`₹${value.toLocaleString('en-IN')}`, 'Profit'];
                          if (name === 'Revenue (₹)') return [`₹${value.toLocaleString('en-IN')}`, 'Revenue'];
                          if (name === 'Quantity Sold') return [value.toString(), 'Quantity Sold'];
                          return [value, name || ''];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="quantity" fill="#8b5cf6" name="Quantity Sold" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="profit" fill="#10b981" name="Profit (₹)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (₹)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Key Performance Indicators - Full Width */}
              <div className="grid grid-cols-1 gap-6">
                {/* Key Metrics */}
                <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-lg shadow p-6 text-white">
                  <h3 className="text-md font-semibold mb-4">Key Performance Indicators</h3>
                  <div className="space-y-4">
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm opacity-90">Avg Transaction Value</span>
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <p className="text-2xl font-bold mt-2">
                        ₹{stats.yearly.transactions > 0 
                          ? (stats.yearly.sales / stats.yearly.transactions).toLocaleString('en-IN', { maximumFractionDigits: 2 })
                          : '0.00'}
                      </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm opacity-90">Profit Margin</span>
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <p className="text-2xl font-bold mt-2">
                        {stats.yearly.sales > 0 
                          ? ((stats.yearly.profit / stats.yearly.sales) * 100).toFixed(1)
                          : '0.0'}%
                      </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm opacity-90">Avg Items per Sale</span>
                        <Package className="w-4 h-4" />
                      </div>
                      <p className="text-2xl font-bold mt-2">
                        {(timePeriod === 'custom' ? customStats.transactions : stats[timePeriod].transactions) > 0 
                          ? ((timePeriod === 'custom' ? customStats.itemsSold : stats[timePeriod].itemsSold) / (timePeriod === 'custom' ? customStats.transactions : stats[timePeriod].transactions)).toFixed(1)
                          : '0.0'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}
