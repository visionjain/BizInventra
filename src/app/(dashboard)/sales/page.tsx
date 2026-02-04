'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useTransactionsStore } from '@/store/transactionsStore';
import { useItemsStore } from '@/store/itemsStore';
import { useCustomersStore } from '@/store/customersStore';
import { TransactionForm } from '@/components/sales/TransactionForm';
import { ReturnForm } from '@/components/returns/ReturnForm';
import { Button } from '@/components/ui/Button';
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
  const [isInitialized, setIsInitialized] = useState(false);
  
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
    checkAuth();
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized && !user) {
      router.push('/login');
    }
  }, [isInitialized, user, router]);

  useEffect(() => {
    if (user && isInitialized) {
      loadData();
    }
  }, [user, isInitialized]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all data in parallel for faster loading
      const [txResponse, returnsResponse, itemsResponse, customersResponse] = await Promise.all([
        fetch('/api/transactions/paginated?limit=100'),
        fetch('/api/returns'),
        fetch('/api/items'),
        fetch('/api/customers')
      ]);

      if (txResponse.ok) {
        const txData = await txResponse.json();
        setTransactions(txData.transactions || []);
      }

      if (returnsResponse.ok) {
        const returnsData = await returnsResponse.json();
        setReturns(returnsData.returns || []);
      }

      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        setItems(itemsData.items || []);
      }

      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        setCustomers(customersData.customers || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      const isEditing = !!editingTransaction;
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
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to save transaction');
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
      const response = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnData),
      });

      if (response.ok) {
        alert('Return processed successfully!');
        setShowReturnForm(false);
        setReturningTransaction(null);
        await loadData();
      } else {
        const error = await response.json();
        alert(`Failed to process return: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Return submission error:', error);
      alert('Failed to process return');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const filteredTransactions = transactions.filter(
    (tx: any) => {
      // Search filter
      const matchesSearch = tx.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Date filter - use local date instead of UTC
      const txDateObj = new Date(tx.transactionDate);
      const year = txDateObj.getFullYear();
      const month = String(txDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(txDateObj.getDate()).padStart(2, '0');
      const txDate = `${year}-${month}-${day}`;
      const matchesDate = txDate >= startDate && txDate <= endDate;
      
      return matchesSearch && matchesDate;
    }
  );
  
  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate]);

  // Calculate stats based on filtered transactions (date range)
  const totalSales = filteredTransactions.reduce((sum: number, tx: any) => sum + (tx.totalAmount || 0), 0);
  const totalReceived = filteredTransactions.reduce((sum: number, tx: any) => sum + (tx.paymentReceived || 0), 0);
  const totalOutstanding = filteredTransactions.reduce((sum: number, tx: any) => sum + (tx.balanceAmount || 0), 0);
  const totalAdditionalCharges = filteredTransactions.reduce((sum: number, tx: any) => sum + (tx.totalAdditionalCharges || 0), 0);
  
  // Calculate realized vs unrealized profit proportionally (based on filtered transactions)
  const realizedProfit = filteredTransactions.reduce((sum: number, tx: any) => {
    const totalProfit = tx.totalProfit || 0;
    const totalAmount = tx.totalAmount || 0;
    const paymentReceived = tx.paymentReceived || 0;
    
    if (totalAmount === 0) return sum;
    
    // Realized profit is proportional to payment received
    const realizedPortion = (paymentReceived / totalAmount) * totalProfit;
    return sum + realizedPortion;
  }, 0);
  
  const unrealizedProfit = filteredTransactions.reduce((sum: number, tx: any) => {
    const totalProfit = tx.totalProfit || 0;
    const totalAmount = tx.totalAmount || 0;
    const balanceAmount = tx.balanceAmount || 0;
    
    if (totalAmount === 0) return sum;
    
    // Unrealized profit is proportional to outstanding balance
    const unrealizedPortion = (balanceAmount / totalAmount) * totalProfit;
    return sum + unrealizedPortion;
  }, 0);
  
  const totalProfitLoss = realizedProfit + unrealizedProfit;

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
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
              <p className="text-sm text-gray-600 mt-1">Welcome, {user?.name}</p>
            </div>
            <Button onClick={handleLogout} variant="secondary" className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4">
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
      <div className="bg-white border-b">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-gray-600">Loading sales data...</p>
            </div>
            
            {/* Stats skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Table skeleton */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="h-4 bg-gray-200 rounded flex-1"></div>
                    <div className="h-4 bg-gray-200 rounded flex-1"></div>
                    <div className="h-4 bg-gray-200 rounded flex-1"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900">₹{totalSales.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Items only</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Additional Charges</p>
                <p className="text-2xl font-bold text-amber-600">₹{totalAdditionalCharges.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Packaging, fuel, etc.</p>
              </div>
              <Package className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Payment Received</p>
                <p className="text-2xl font-bold text-green-600">₹{totalReceived.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Outstanding</p>
                <p className="text-2xl font-bold text-red-600">₹{totalOutstanding.toFixed(2)}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-gray-600">Total Profit</p>
                <p className={`text-2xl font-bold ${totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{totalProfitLoss.toFixed(2)}
                </p>
              </div>
              <TrendingUp className={`w-8 h-8 ${totalProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-green-700">✓ Realized (Paid):</span>
                <span className="font-semibold text-green-700">₹{realizedProfit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-amber-700">⏳ Unrealized (Credit):</span>
                <span className="font-semibold text-amber-700">₹{unrealizedProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(viewingTransaction.transactionDate).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-medium text-gray-900">
                    {viewingTransaction.customerName || <span className="text-gray-500 italic">Walk-in Customer</span>}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payment Method</p>
                  <p className="font-medium text-gray-900 capitalize">{viewingTransaction.paymentMethod}</p>
                </div>
                {viewingTransaction.notes && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">Notes</p>
                    <p className="font-medium text-gray-900">{viewingTransaction.notes}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Items</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viewingTransaction.items?.map((item: any, index: number) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.itemName || 'Unknown Item'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">₹{item.pricePerUnit.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                            ₹{(item.quantity * item.pricePerUnit).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700">Total Amount:</span>
                  <span className="font-semibold text-gray-900">₹{viewingTransaction.totalAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Payment Received:</span>
                  <span className="font-semibold text-green-600">₹{viewingTransaction.paymentReceived?.toFixed(2)}</span>
                </div>
                {viewingTransaction.totalProfit !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Profit:</span>
                    <span className={`font-semibold ${viewingTransaction.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{viewingTransaction.totalProfit?.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="text-gray-900 font-medium">Balance:</span>
                  <span className={`font-bold ${viewingTransaction.balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{viewingTransaction.balanceAmount?.toFixed(2)}
                  </span>
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
  );
}
