'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useTransactionsStore } from '@/store/transactionsStore';
import { useItemsStore } from '@/store/itemsStore';
import { useCustomersStore } from '@/store/customersStore';
import { TransactionForm } from '@/components/sales/TransactionForm';
import { ReturnForm } from '@/components/returns/ReturnForm';
import { Button } from '@/components/ui/Button';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { PullToRefresh } from '@/components/PullToRefresh';
import { Plus, Search, LogOut, Trash2, DollarSign, ShoppingCart, TrendingUp, Eye, Edit2, Package, RotateCcw } from 'lucide-react';

export default function SalesPage() {
  const router = useRouter();
  const { user, logout, checkAuth } = useAuthStore();
  const { transactions, setTransactions, addTransaction, deleteTransaction, setLoading, isLoading } = useTransactionsStore();
  const { items, setItems } = useItemsStore();
  const { customers, setCustomers } = useCustomersStore();
  
  const [activeTab, setActiveTab] = useState<'sales' | 'returns'>('sales');
  const [showForm, setShowForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returningTransaction, setReturningTransaction] = useState<any>(null);
  const [returns, setReturns] = useState<any[]>([]);
  const [viewingTransaction, setViewingTransaction] = useState<any>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Stats from server
  const [stats, setStats] = useState({
    totalSales: 0,
    totalReceived: 0,
    totalOutstanding: 0,
    totalAdditionalCharges: 0,
    totalProfit: 0
  });
  
  // Date range filter - default to today
  const getTodayDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    console.log('Sales: Checking auth...');
    checkAuth();
    const token = localStorage.getItem('auth_token');
    console.log('Sales: Token exists?', !!token);
    
    if (!token) {
      console.log('Sales: No token, redirecting');
      setTimeout(() => {
        window.location.href = '/login/';
      }, 100);
    } else {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    if (user && authChecked) {
      loadData();
      checkPendingChanges();
    }
  }, [user, authChecked, startDate, endDate]);

  // Track online status
  useEffect(() => {
    const checkOnlineStatus = async () => {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      
      if (platform === 'android' || platform === 'ios') {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        
        // Listen for status changes
        Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
          if (status.connected) {
            // Auto-sync when back online
            handleRefresh();
          }
        });
      } else {
        setIsOnline(navigator.onLine);
        window.addEventListener('online', () => setIsOnline(true));
        window.addEventListener('offline', () => setIsOnline(false));
      }
    };
    
    checkOnlineStatus();
    
    // Check pending changes periodically
    const interval = setInterval(checkPendingChanges, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const checkPendingChanges = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      
      if (platform === 'android' || platform === 'ios') {
        const { syncService } = await import('@/lib/syncService');
        const count = await syncService.getPendingChangesCount();
        setPendingChanges(count);
      }
    } catch (error) {
      console.error('Failed to check pending changes:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Try to sync first if online
      if (isOnline) {
        const { syncService } = await import('@/lib/syncService');
        await syncService.syncAll();
      }
      // Reload data
      await loadData();
      await checkPendingChanges();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadData = async () => {
    const { Capacitor } = await import('@capacitor/core');
    const platform = Capacitor.getPlatform();
    const isNative = platform === 'android' || platform === 'ios';
    
    // Load from cache immediately for instant display (native only)
    if (isNative && user) {
      try {
        const { getTransactionsOffline, getItemsOffline, getCustomersOffline } = await import('@/lib/db/sqlite');
        
        const [offlineTxs, offlineItems, offlineCustomers] = await Promise.all([
          getTransactionsOffline(user.id),
          getItemsOffline(user.id),
          getCustomersOffline(user.id)
        ]);
        
        // Show cached data immediately
        setTransactions(offlineTxs);
        setItems(offlineItems);
        setCustomers(offlineCustomers);
        
        // Calculate stats from cached data
        const totalSales = offlineTxs.reduce((sum, tx) => sum + (tx.totalAmount - (tx.totalAdditionalCharges || 0)), 0);
        const totalReceived = offlineTxs.reduce((sum, tx) => sum + tx.paymentReceived, 0);
        const totalOutstanding = offlineTxs.reduce((sum, tx) => sum + tx.balanceAmount, 0);
        const totalAdditionalCharges = offlineTxs.reduce((sum, tx) => sum + (tx.totalAdditionalCharges || 0), 0);
        const totalProfit = offlineTxs.reduce((sum, tx) => sum + (tx.totalProfit || 0), 0);
        
        setStats({
          totalSales,
          totalReceived,
          totalOutstanding,
          totalAdditionalCharges,
          totalProfit
        });
        
        setLoadedFromCache(true);
        setLoading(false); // Stop loading spinner
      } catch (error) {
        console.log('Failed to load cached data:', error);
      }
    }
    
    // Now fetch fresh data in background
    let isOnline = navigator.onLine;
    
    // Use Network plugin for more reliable detection on native
    if (isNative) {
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      isOnline = status.connected;
    }
    
    // Try online fetch
    if (isOnline) {
      setIsUpdating(true); // Show "Updating..." status
      try {
        // Build query with date range for accurate stats
        const txUrl = `/api/transactions/paginated?limit=100&startDate=${startDate}&endDate=${endDate}`;
        
        // Load all data in parallel for faster loading
        const [txResponse, returnsResponse, itemsResponse, customersResponse] = await Promise.all([
          fetch(txUrl),
          fetch('/api/returns'),
          fetch('/api/items'),
          fetch('/api/customers')
        ]);

        if (txResponse.ok) {
          const txData = await txResponse.json();
          setTransactions(txData.transactions || []);
          // Save server-calculated stats (accurate for ALL transactions in date range)
          if (txData.stats) {
            setStats(txData.stats);
          }
          
          // Save to SQLite for offline access (native only)
          if (isNative && txData.transactions) {
            const { saveTransactionsToCache } = await import('@/lib/db/sqlite');
            await saveTransactionsToCache(user!.id, txData.transactions);
          }
        }

        if (returnsResponse.ok) {
          const returnsData = await returnsResponse.json();
          setReturns(returnsData.returns || []);
        }

        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          setItems(itemsData.items || []);
          
          // Save items to SQLite for offline access (native only)
          if (isNative && itemsData.items) {
            const { saveItemsToCache } = await import('@/lib/db/sqlite');
            await saveItemsToCache(user!.id, itemsData.items);
          }
        }

        if (customersResponse.ok) {
          const customersData = await customersResponse.json();
          setCustomers(customersData.customers || []);
          
          // Save customers to SQLite for offline access (native only)
          if (isNative && customersData.customers) {
            const { saveCustomersToCache } = await import('@/lib/db/sqlite');
            await saveCustomersToCache(user!.id, customersData.customers);
          }
        }
        setLoadedFromCache(false);
        setIsUpdating(false); // Done updating
      } catch (error) {
        console.log('Online fetch failed:', error);
        setIsUpdating(false); // Done updating
        // Already showing cached data, so don't show error
      }
    }
    
    setLoading(false);
  };

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      const isNative = platform === 'android' || platform === 'ios';
      const isEditing = !!editingTransaction;
      
      let savedOnline = false;

      // For native apps, try online first but fall back to offline on any error
      if (isNative) {
        try {
          const url = isEditing 
            ? `/api/transactions/${editingTransaction._id || editingTransaction.id}`
            : '/api/transactions';
          const method = isEditing ? 'PUT' : 'POST';

          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });

          if (response.ok) {
            const data = await response.json();
            if (isEditing) {
              // Update existing transaction in store
              setTransactions(transactions.map((t: any) => 
                (t._id || t.id) === (editingTransaction._id || editingTransaction.id) 
                  ? data.transaction 
                  : t
              ));
            } else {
              addTransaction(data.transaction);
            }
            setShowForm(false);
            setEditingTransaction(null);
            // Reload to get updated balances and stock
            loadData();
            // Auto-sync after successful online save
            const { syncService } = await import('@/lib/syncService');
            await syncService.syncAll();
            savedOnline = true;
            return;
          }
        } catch (error) {
          // Network error or other fetch failure - will fall through to offline save
          console.log('Online save failed, falling back to offline:', error);
        }

        // If we reach here, online save failed - use offline save
        if (!savedOnline) {
          if (isEditing) {
            const { updateTransactionOffline } = await import('@/lib/db/sqlite');
            await updateTransactionOffline(user!.id, editingTransaction.id || editingTransaction._id, formData);
            // Update local state
            setTransactions(transactions.map((t: any) => 
              (t._id || t.id) === (editingTransaction._id || editingTransaction.id) 
                ? { ...formData, id: editingTransaction.id || editingTransaction._id }
                : t
            ));
            setShowForm(false);
            setEditingTransaction(null);
            loadData();
            alert('Transaction updated offline. Will sync when online.');
          } else {
            const { saveTransactionOffline } = await import('@/lib/db/sqlite');
            const transactionId = await saveTransactionOffline(user!.id, formData);
            const newTransaction = { ...formData, id: transactionId, _id: transactionId };
            addTransaction(newTransaction);
            setShowForm(false);
            // Reload to get updated local data
            loadData();
            alert('Sale saved offline. Will sync when online.');
          }
        }
      } else {
        // Web platform - must be online
        const url = isEditing 
          ? `/api/transactions/${editingTransaction._id || editingTransaction.id}`
          : '/api/transactions';
        const method = isEditing ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          throw new Error('Failed to save transaction');
        }

        const data = await response.json();
        if (isEditing) {
          setTransactions(transactions.map((t: any) => 
            (t._id || t.id) === (editingTransaction._id || editingTransaction.id) 
              ? data.transaction 
              : t
          ));
        } else {
          addTransaction(data.transaction);
        }
        setShowForm(false);
        setEditingTransaction(null);
        loadData();
      }
    } catch (error) {
      console.error('Failed to save transaction:', error);
      alert('Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: any) => {
    if (!confirm('Are you sure you want to delete this sale? This will revert stock and customer balance.')) return;

    try {
      const transactionId = typeof id === 'object' ? id.toString() : id;
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        deleteTransaction(transactionId);
        // Reload to get updated balances and stock
        loadData();
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  const handleReturn = (transaction: any) => {
    setReturningTransaction(transaction);
    setShowReturnForm(true);
  };

  const handleReturnSubmit = async (returnData: any) => {
    setIsSubmitting(true);
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      const isNative = platform === 'android' || platform === 'ios';
      const isOffline = !navigator.onLine;

      // Try online save first
      if (!isOffline) {
        const response = await fetch('/api/returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(returnData),
        });

        if (response.ok) {
          setShowReturnForm(false);
          setReturningTransaction(null);
          loadData();
          // Auto-sync after successful online save
          const { syncService } = await import('@/lib/syncService');
          await syncService.syncAll();
          return;
        }
      }

      // Fallback to offline save (native only)
      if (isNative) {
        const { saveReturnOffline } = await import('@/lib/db/sqlite');
        await saveReturnOffline(user!.id, returnData);
        setShowReturnForm(false);
        setReturningTransaction(null);
        loadData();
        alert('Return saved offline. Will sync when online.');
      } else if (isOffline) {
        alert('Cannot save return offline on web. Please check your connection.');
      }
    } catch (error) {
      console.error('Failed to process return:', error);
      alert('Failed to process return');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.replace('/login/');
  };

  const filteredTransactions = transactions.filter(
    (tx: any) => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        tx.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    }
  );
  
  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
  
  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Use server-calculated stats (accurate for ALL transactions, not just loaded 100)
  const totalSales = stats.totalSales;
  const totalReceived = stats.totalReceived;
  const totalOutstanding = stats.totalOutstanding;
  const totalAdditionalCharges = stats.totalAdditionalCharges;
  const totalProfitLoss = stats.totalProfit;
  
  // Calculate realized vs unrealized profit
  // Profit comes only from items, not additional charges
  // So we calculate based on how much of the items total was actually paid
  const totalAmountWithCharges = totalSales + totalAdditionalCharges;
  const realizedProfit = totalReceived > 0 && totalSales > 0 
    ? Math.min((totalReceived / totalAmountWithCharges) * totalProfitLoss, totalProfitLoss)
    : 0;
  const unrealizedProfit = totalProfitLoss - realizedProfit;

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
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
              {/* Connection Status */}
              <ConnectionStatus onRefresh={handleRefresh} isUpdating={isUpdating} />
              
              <div className="text-right">
                <h2 className="text-lg font-semibold text-gray-900">Sales</h2>
                <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
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
          <div className="flex gap-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-3 text-gray-600 hover:text-blue-600 hover:border-b-2 hover:border-blue-600"
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
              className="px-4 py-3 text-blue-600 border-b-2 border-blue-600 font-medium"
            >
              Sales
            </button>
          </div>
        </div>
      </div>

      {/* Sales / Returns Tabs */}
      <div className="bg-white border-b fixed left-0 right-0 z-20" style={{ top: 'calc(144px + env(safe-area-inset-top))' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'sales'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <ShoppingCart className="w-4 h-4 inline mr-2" />
              Sales Transactions
            </button>
            <button
              onClick={() => setActiveTab('returns')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'returns'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <RotateCcw className="w-4 h-4 inline mr-2" />
              Returns ({returns.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8" style={{ paddingTop: 'calc(204px + env(safe-area-inset-top))' }}>
        {isLoading ? (
          <div className="flex items-center gap-2 mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Loading sales data...</p>
          </div>
        ) : (
          <>

        {showForm ? (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingTransaction ? 'Edit Sale' : 'Create New Sale'}
            </h2>
            <TransactionForm
              customers={customers}
              items={items}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingTransaction(null);
              }}
              onCustomerAdded={loadData}
              isLoading={isSubmitting}
              initialData={editingTransaction}
            />
          </div>
        ) : viewingTransaction ? (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-semibold">Sale Details</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setEditingTransaction(viewingTransaction);
                    setViewingTransaction(null);
                    setShowForm(true);
                  }}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  onClick={() => setViewingTransaction(null)}
                  variant="secondary"
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Transaction Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase mb-1">Date & Time</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(viewingTransaction.transactionDate).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase mb-1">Customer</p>
                  <p className="font-semibold text-gray-900">
                    {viewingTransaction.customerName || <span className="text-gray-500 italic">Walk-in Customer</span>}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase mb-1">Payment Method</p>
                  <p className="font-semibold text-gray-900 capitalize">{viewingTransaction.paymentMethod}</p>
                </div>
              </div>

              {viewingTransaction.notes && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-xs text-blue-700 uppercase font-medium mb-1">Notes</p>
                  <p className="text-gray-900">{viewingTransaction.notes}</p>
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-900">
                  <Package className="w-5 h-5 mr-2 text-blue-600" />
                  Items Sold
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viewingTransaction.items?.map((item: any, index: number) => {
                        const itemData = items.find((i: any) => (i._id || i.id).toString() === item.itemId?.toString());
                        return (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium text-gray-900">{itemData?.name || item.itemName || 'Item'}</div>
                              {item.unit && <div className="text-xs text-gray-500">{item.unit}</div>}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-center font-medium">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">₹{item.pricePerUnit?.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                              ₹{((item.quantity || 0) * (item.pricePerUnit || 0)).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50">
                        <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-700 text-right">Items Subtotal:</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                          ₹{viewingTransaction.items?.reduce((sum: number, item: any) => 
                            sum + ((item.quantity || 0) * (item.pricePerUnit || 0)), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Additional Charges */}
              {viewingTransaction.additionalCharges && viewingTransaction.additionalCharges.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-900">
                    <DollarSign className="w-5 h-5 mr-2 text-amber-600" />
                    Additional Charges
                  </h3>
                  <div className="border border-amber-200 rounded-lg overflow-hidden bg-amber-50">
                    <table className="min-w-full">
                      <tbody className="divide-y divide-amber-200">
                        {viewingTransaction.additionalCharges.map((charge: any, index: number) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="font-medium">{charge.reason || charge.description || 'Additional Charge'}</div>
                              {charge.notes && <div className="text-xs text-gray-600 mt-1">{charge.notes}</div>}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-amber-900 text-right">
                              ₹{charge.amount?.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-amber-100">
                          <td className="px-4 py-3 text-sm font-medium text-gray-700 text-right">Total Additional Charges:</td>
                          <td className="px-4 py-3 text-sm font-bold text-amber-900 text-right">
                            ₹{viewingTransaction.totalAdditionalCharges?.toFixed(2) || '0.00'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Payment Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-700">
                    <span>Items Total:</span>
                    <span className="font-semibold">₹{(viewingTransaction.items?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.pricePerUnit || 0)), 0) || 0).toFixed(2)}</span>
                  </div>
                  {viewingTransaction.totalAdditionalCharges > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span>Additional Charges:</span>
                      <span className="font-semibold text-amber-700">₹{viewingTransaction.totalAdditionalCharges?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-blue-300">
                    <span>Total Amount:</span>
                    <span>₹{((viewingTransaction.items?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.pricePerUnit || 0)), 0) || 0) + (viewingTransaction.totalAdditionalCharges || 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Payment Received:</span>
                    <span className="font-semibold text-green-600">₹{viewingTransaction.paymentReceived?.toFixed(2)}</span>
                  </div>
                  {viewingTransaction.totalProfit !== undefined && (
                    <div className="flex justify-between text-gray-700">
                      <span>Profit Earned:</span>
                      <span className={`font-semibold ${viewingTransaction.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{viewingTransaction.totalProfit?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-3 border-t border-blue-300">
                    <span className="text-gray-900">Outstanding Balance:</span>
                    <span className={`${viewingTransaction.balanceAmount > 0 ? 'text-red-600' : viewingTransaction.balanceAmount < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                      {viewingTransaction.balanceAmount < 0 && '- '}₹{Math.abs(viewingTransaction.balanceAmount || 0).toFixed(2)}
                    </span>
                  </div>
                  {viewingTransaction.balanceAmount < 0 && (
                    <p className="text-xs text-green-700 text-right">Customer has advance payment</p>
                  )}
                  {viewingTransaction.balanceAmount > 0 && (
                    <p className="text-xs text-red-700 text-right">Customer owes this amount</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : showReturnForm ? (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Process Return</h2>
            <ReturnForm
              items={items}
              originalTransaction={returningTransaction}
              onSubmit={handleReturnSubmit}
              onCancel={() => {
                setShowReturnForm(false);
                setReturningTransaction(null);
              }}
              isLoading={isSubmitting}
            />
          </div>
        ) : (
          <>
            {/* Actions Bar */}
            {activeTab === 'sales' && (
              <div className="flex flex-col gap-4 mb-6">
                {/* Date Range Filter */}
                <div className="bg-white rounded-lg shadow p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date Range</label>
                  <div className="flex flex-col sm:flex-row gap-3">
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
                </div>
                
                {/* Search and Add */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search sales by customer or notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                    />
                  </div>
                  <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    New Sale
                  </Button>
                </div>
              </div>
            )}

            {/* Sales Table */}
            {activeTab === 'sales' && (
              filteredTransactions.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <p className="text-gray-500">No sales found for the selected date range.</p>
                </div>
              ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {/* Horizontal scroll wrapper for mobile */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Items</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Paid</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Balance</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedTransactions.map((tx: any) => (
                        <tr key={tx._id?.toString() || tx.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {new Date(tx.transactionDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {tx.customerName || <span className="text-gray-500 italic">Walk-in Customer</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{tx.items?.length || 0} item(s)</td>
                          <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">₹{tx.totalAmount?.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm text-green-600 whitespace-nowrap">₹{tx.paymentReceived?.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap">
                            <span className={tx.balanceAmount > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              ₹{tx.balanceAmount?.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setViewingTransaction(tx)}
                                className="text-blue-600 hover:text-blue-900"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTransaction(tx);
                                  setShowForm(true);
                                }}
                                className="text-green-600 hover:text-green-900"
                                title="Edit Sale"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReturn(tx)}
                                className="text-purple-600 hover:text-purple-900"
                                title="Process Return"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(tx._id || tx.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete Sale"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} results
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        variant="secondary"
                        className="px-3 py-1 text-sm"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 text-sm rounded ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <Button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        variant="secondary"
                        className="px-3 py-1 text-sm"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              )
            )}

            {/* Returns Table */}
            {activeTab === 'returns' && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Process New Return</h3>
                    <Button 
                      onClick={() => {
                        setReturningTransaction(null);
                        setShowReturnForm(true);
                      }}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      New Return
                    </Button>
                  </div>
                </div>

                {returns.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-12 text-center">
                    <RotateCcw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No returns recorded yet.</p>
                    <p className="text-sm text-gray-400 mt-2">Returns will appear here after processing.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Customer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Items Returned</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Return Value</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Refund Given</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Profit Lost</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {returns.map((ret: any) => (
                            <tr key={ret._id?.toString() || ret.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                {new Date(ret.transactionDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                                {ret.customerName || <span className="text-gray-500 italic">Walk-in Customer</span>}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                {ret.items?.length || 0} item(s)
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                                ₹{ret.totalReturnValue?.toFixed(2) || '0.00'}
                              </td>
                              <td className="px-6 py-4 text-sm text-red-600 whitespace-nowrap font-medium">
                                ₹{ret.refundAmount?.toFixed(2) || '0.00'}
                              </td>
                              <td className="px-6 py-4 text-sm text-orange-600 whitespace-nowrap font-medium">
                                ₹{ret.totalProfitLost?.toFixed(2) || '0.00'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                {ret.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
          </>
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}
