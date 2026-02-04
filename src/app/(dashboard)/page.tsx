'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { LogOut, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users, Calendar, BarChart3, PieChart } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface DashboardStats {
  weekly: {
    sales: number;
    profit: number;
    transactions: number;
    itemsSold: number;
    additionalCharges: number;
    returns: number;
    returnsProfit: number;
  };
  monthly: {
    sales: number;
    profit: number;
    transactions: number;
    itemsSold: number;
    additionalCharges: number;
    returns: number;
    returnsProfit: number;
  };
  yearly: {
    sales: number;
    profit: number;
    transactions: number;
    itemsSold: number;
    additionalCharges: number;
    returns: number;
    returnsProfit: number;
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
  topItems: Array<{ name: string; quantity: number; revenue: number; }>;
  paymentMethods: Array<{ name: string; value: number; }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, checkAuth } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [stats, setStats] = useState<DashboardStats>({
    weekly: { sales: 0, profit: 0, transactions: 0, itemsSold: 0, additionalCharges: 0, returns: 0, returnsProfit: 0 },
    monthly: { sales: 0, profit: 0, transactions: 0, itemsSold: 0, additionalCharges: 0, returns: 0, returnsProfit: 0 },
    yearly: { sales: 0, profit: 0, transactions: 0, itemsSold: 0, additionalCharges: 0, returns: 0, returnsProfit: 0 },
    inventory: { totalItems: 0, lowStock: 0, totalValue: 0 },
    customers: { total: 0, outstanding: 0 },
  });
  const [chartData, setChartData] = useState<ChartData>({
    salesTrend: [],
    topItems: [],
    paymentMethods: [],
  });

  useEffect(() => {
    console.log('Dashboard: Starting auth check...');
    checkAuth();
    console.log('Dashboard: Auth check called');
    // Delay to ensure state updates from checkAuth
    const timer = setTimeout(() => {
      console.log('Dashboard: Setting initialized to true');
      setIsInitialized(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [checkAuth]);

  useEffect(() => {
    console.log('Dashboard: isInitialized=', isInitialized, 'user=', user ? 'exists' : 'null');
    if (isInitialized && !user) {
      console.log('Dashboard: No user found, redirecting to login');
      router.push('/login');
    }
  }, [isInitialized, user, router]);

  useEffect(() => {
    console.log('Dashboard: Data load check - user=', user ? 'exists' : 'null', 'isInitialized=', isInitialized);
    if (user && isInitialized) {
      console.log('Dashboard: Loading dashboard data...');
      loadDashboardData();
    }
  }, [user, isInitialized]);

  const loadDashboardData = async () => {
    console.log('Dashboard: loadDashboardData started');
    setLoading(true);
    try {
      console.log('Dashboard: Fetching optimized stats...');
      // Use optimized server-side aggregation endpoint
      const response = await fetch('/api/dashboard/stats');

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const data = await response.json();
      
      console.log('Dashboard: Stats received', data);

      // Set stats from server aggregation
      setStats({
        weekly: data.stats.weekly,
        monthly: data.stats.monthly,
        yearly: data.stats.yearly,
        inventory: data.stats.inventory,
        customers: data.stats.customers
      });

      // Set chart data
      setChartData({
        salesTrend: data.chartData.salesTrend,
        topItems: data.chartData.topItems,
        paymentMethods: [] // Payment methods aggregation can be added if needed
      });

      console.log('Dashboard: Stats loaded successfully');
    } catch (error) {
      console.error('Dashboard: Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!isInitialized || (isInitialized && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow fixed top-0 left-0 right-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Bizinventra" className="h-12 w-12" />
              <img src="/titlelogo.png" alt="Bizinventra" className="h-10" />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
                <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
              </div>
              <Button onClick={handleLogout} variant="secondary" className="flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow-sm border-b fixed left-0 right-0 z-30" style={{ top: 'calc(68px + env(safe-area-inset-top))' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <button
              className="px-4 py-3 text-blue-600 border-b-2 border-blue-600 font-medium"
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push('/items')}
              className="px-4 py-3 text-gray-600 hover:text-blue-600 hover:border-b-2 hover:border-blue-600"
            >
              Items
            </button>
            <button
              onClick={() => router.push('/customers')}
              className="px-4 py-3 text-gray-600 hover:text-blue-600 hover:border-b-2 hover:border-blue-600"
            >
              Customers
            </button>
            <button
              onClick={() => router.push('/sales')}
              className="px-4 py-3 text-gray-600 hover:text-blue-600 hover:border-b-2 hover:border-blue-600"
            >
              Sales
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingTop: 'calc(120px + env(safe-area-inset-top))' }}>
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
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
                </div>
                <div className="flex gap-2">
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
                </div>
              </div>
            </div>

            {/* Dynamic Stats Based on Selected Period */}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {timePeriod === 'weekly' ? 'Sales (Last 7 Days)' : timePeriod === 'monthly' ? 'Sales This Month' : 'Sales This Year'}
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        ₹{stats[timePeriod].sales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{stats[timePeriod].transactions} transactions • Gross sales</p>
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
                        {timePeriod === 'weekly' ? 'Profit (Last 7 Days)' : timePeriod === 'monthly' ? 'Profit This Month' : 'Profit This Year'}
                      </p>
                      <p className="text-3xl font-bold text-green-600 mt-2">
                        ₹{stats[timePeriod].profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Gross profit</p>
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
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats[timePeriod].transactions}</p>
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
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats[timePeriod].itemsSold}</p>
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
                        {timePeriod === 'weekly' ? 'Charges (Last 7 Days)' : timePeriod === 'monthly' ? 'Charges This Month' : 'Charges This Year'}
                      </p>
                      <p className="text-3xl font-bold text-amber-600 mt-2">
                        ₹{stats[timePeriod].additionalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        {timePeriod === 'weekly' ? 'Returns (Last 7 Days)' : timePeriod === 'monthly' ? 'Returns This Month' : 'Returns This Year'}
                      </p>
                      <p className="text-3xl font-bold text-red-600 mt-2">
                        ₹{stats[timePeriod].returns.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        {timePeriod === 'weekly' ? 'Net Sales (Last 7 Days)' : timePeriod === 'monthly' ? 'Net Sales This Month' : 'Net Sales This Year'}
                      </p>
                      <p className="text-3xl font-bold text-indigo-600 mt-2">
                        ₹{(stats[timePeriod].sales - stats[timePeriod].returns).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Sales - Returns</p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-indigo-600" />
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
                      onClick={() => router.push('/sales')}
                      className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 text-left transition-colors"
                    >
                      <p className="font-semibold">New Sale</p>
                      <p className="text-xs opacity-90">Create transaction</p>
                    </button>
                    <button
                      onClick={() => router.push('/items')}
                      className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 text-left transition-colors"
                    >
                      <p className="font-semibold">Add Item</p>
                      <p className="text-xs opacity-90">Manage inventory</p>
                    </button>
                    <button
                      onClick={() => router.push('/customers')}
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

                {/* Top Items Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-md font-semibold text-gray-700 mb-4">
                    Top Selling Items
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.topItems} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <YAxis dataKey="name" type="category" stroke="#6b7280" style={{ fontSize: '11px' }} width={100} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '8px'
                        }}
                        formatter={(value: number | undefined, name: string | undefined) => {
                          if (!value) return ['0', name || ''];
                          if (name === 'revenue') return [`₹${value.toLocaleString('en-IN')}`, 'Revenue'];
                          return [value, 'Quantity'];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="quantity" fill="#8b5cf6" name="Quantity" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (₹)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Methods & Additional Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Methods Pie Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-blue-600" />
                    Payment Methods Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={chartData.paymentMethods}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ₹${entry.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.paymentMethods.map((entry, index) => {
                          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number | undefined) => value ? `₹${value.toLocaleString('en-IN')}` : '₹0'}
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>

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
                        {stats[timePeriod].transactions > 0 
                          ? (stats[timePeriod].itemsSold / stats[timePeriod].transactions).toFixed(1)
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
  );
}
