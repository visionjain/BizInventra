'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useCustomersStore } from '@/store/customersStore';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { Button } from '@/components/ui/Button';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { PullToRefresh } from '@/components/PullToRefresh';
import { Customer } from '@/types';
import { Plus, Edit2, Trash2, Search, LogOut, Phone, DollarSign, Eye, X } from 'lucide-react';

export default function CustomersPage() {
  const router = useRouter();
  const { user, logout, checkAuth } = useAuthStore();
  const { customers, setCustomers, addCustomer, updateCustomer, deleteCustomer, setLoading, isLoading } = useCustomersStore();
  
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<any>(null);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsToShow, setPaymentsToShow] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Customer transaction filters
  const today = new Date().toISOString().split('T')[0];
  const [txStartDate, setTxStartDate] = useState(today);
  const [txEndDate, setTxEndDate] = useState(today);
  const [txCurrentPage, setTxCurrentPage] = useState(1);
  const txItemsPerPage = 10;
  
  // Bulk payment state
  const [showBulkPayment, setShowBulkPayment] = useState(false);
  const [bulkPaymentAmount, setBulkPaymentAmount] = useState('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [processingPayment, setProcessingPayment] = useState(false);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
    const token = localStorage.getItem('auth_token');
    if (!token) {
      window.location.href = '/login/';
    }
  }, []);

  // Load customers when user is available
  useEffect(() => {
    if (user) {
      loadCustomers();
    }
  }, [user]);

  const loadCustomers = async () => {
    setLoading(true);
    
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      const isNative = platform === 'android' || platform === 'ios';
      
      // Step 1: Load from cache immediately (native only)
      if (isNative && user) {
        const { getCustomersOffline } = await import('@/lib/db/sqlite');
        const offlineCustomers = await getCustomersOffline(user.id);
        setCustomers(offlineCustomers);
        console.log('Customers: Displayed cache immediately');
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
          console.log('Customers: Background sync started');
          const response = await fetch('/api/customers');
          
          if (response.ok) {
            const data = await response.json();
            setCustomers(data.customers || []);
            
            // Save to cache
            if (isNative && data.customers) {
              const { saveCustomersToCache } = await import('@/lib/db/sqlite');
              await saveCustomersToCache(user!.id, data.customers);
            }
            
            console.log('Customers: Background sync completed');
          }
        } catch (error) {
          console.log('Customers: Background sync failed', error);
        } finally {
          setIsUpdating(false);
        }
      }
    } catch (error) {
      console.error('Customers: Failed to load data', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: { name: string; phoneNumber: string; outstandingBalance: number }) => {
    setIsSubmitting(true);
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      const isNative = platform === 'android' || platform === 'ios';
      const isOffline = !navigator.onLine;

      if (editingCustomer) {
        const customerId = (editingCustomer as any)._id || editingCustomer.id;
        
        // Try online update
        if (!isOffline) {
          const response = await fetch(`/api/customers/${customerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });

          if (response.ok) {
            const data = await response.json();
            updateCustomer(editingCustomer.id, data.customer);
            setShowForm(false);
            setEditingCustomer(null);
            return;
          }
        }
        
        // Fallback to offline update (native only)
        if (isNative) {
          const { updateCustomerOffline } = await import('@/lib/db/sqlite');
          await updateCustomerOffline(user!.id, customerId, formData);
          const updatedCustomer = { 
            ...editingCustomer, 
            ...formData,
            updatedAt: new Date(),
            lastModifiedAt: new Date()
          };
          updateCustomer(editingCustomer.id, updatedCustomer);
          setShowForm(false);
          setEditingCustomer(null);
          alert('Customer updated offline. Will sync when online.');
        } else {
          alert('Cannot update customer offline on web. Please check your connection.');
        }
      } else {
        // Try online create
        if (!isOffline) {
          const response = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });

          if (response.ok) {
            const data = await response.json();
            addCustomer(data.customer);
            setShowForm(false);
            return;
          }
        }
        
        // Fallback to offline create (native only)
        if (isNative) {
          const { saveCustomerOffline } = await import('@/lib/db/sqlite');
          const customerId = await saveCustomerOffline(user!.id, formData);
          const newCustomer = { 
            ...formData, 
            id: customerId, 
            _id: customerId,
            userId: user!.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            isDeleted: false,
            lastModifiedAt: new Date()
          };
          addCustomer(newCustomer);
          setShowForm(false);
          alert('Customer added offline. Will sync when online.');
        } else {
          alert('Cannot add customer offline on web. Please check your connection.');
        }
      }
    } catch (error) {
      console.error('Failed to save customer:', error);
      alert('Failed to save customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleDelete = async (id: any) => {
    // First, get transaction count for this customer
    const customerId = typeof id === 'object' ? id.toString() : id;
    
    try {
      const txResponse = await fetch(`/api/transactions?customerId=${customerId}`);
      const txData = await txResponse.json();
      const txCount = txData.transactions?.length || 0;
      
      const confirmMessage = txCount > 0
        ? `⚠️ WARNING: Deleting this customer will also delete ${txCount} transaction(s) associated with them.\n\nThis will alter your:\n• Total sales data\n• Profit/loss calculations\n• Dashboard analytics\n\nThis action cannot be undone. Are you sure?`
        : 'Are you sure you want to delete this customer?';
      
      if (!confirm(confirmMessage)) return;

      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        deleteCustomer(customerId);
        if (data.transactionsDeleted > 0) {
          alert(`Customer and ${data.transactionsDeleted} transaction(s) have been deleted.`);
        }
      }
    } catch (error) {
      console.error('Failed to delete customer:', error);
      alert('Failed to delete customer');
    }
  };

  const handleViewCustomer = async (customer: any) => {
    setViewingCustomer(customer);
    setLoadingTransactions(true);
    setLoadingPayments(true);
    setPaymentsToShow(5);
    // Reset transaction filters and bulk payment state
    setTxStartDate('');
    setTxEndDate('');
    setTxCurrentPage(1);
    setShowBulkPayment(false);
    setBulkPaymentAmount('');
    setSelectedTransactions(new Set());
    try {
      // Fetch transactions directly for this customer using the server query
      const customerId = customer._id || customer.id;
      const [txResponse, paymentsResponse] = await Promise.all([
        fetch(`/api/transactions?customerId=${customerId}`),
        fetch(`/api/customers/${customerId}/payments`)
      ]);
      
      if (txResponse.ok) {
        const data = await txResponse.json();
        setCustomerTransactions(data.transactions || []);
      }
      
      if (paymentsResponse.ok) {
        const data = await paymentsResponse.json();
        setCustomerPayments(data.payments || []);
      }
    } catch (error) {
      console.error('Failed to load customer data:', error);
    } finally {
      setLoadingTransactions(false);
      setLoadingPayments(false);
    }
  };

  const handleBulkPaymentFIFO = async () => {
    const amount = parseFloat(bulkPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    setProcessingPayment(true);
    try {
      const response = await fetch('/api/customers/bulk-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: viewingCustomer._id || viewingCustomer.id,
          paymentAmount: amount,
          mode: 'fifo',
        }),
      });

      const data = await response.json();
      console.log('Bulk payment response:', data);

      if (response.ok) {
        alert(`Payment applied successfully! ${data.note || ''}`);
        // Reload customer and transactions
        await loadCustomers();
        await handleViewCustomer(viewingCustomer);
        setBulkPaymentAmount('');
        setShowBulkPayment(false);
      } else {
        alert(`Failed to apply payment: ${data.message || data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to apply bulk payment:', error);
      alert('Failed to apply payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleManualPayment = async () => {
    if (selectedTransactions.size === 0) {
      alert('Please select transactions to mark as paid');
      return;
    }

    const amount = parseFloat(bulkPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    setProcessingPayment(true);
    try {
      const response = await fetch('/api/customers/bulk-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: viewingCustomer._id || viewingCustomer.id,
          paymentAmount: amount,
          mode: 'manual',
          transactionIds: Array.from(selectedTransactions),
        }),
      });

      const data = await response.json();
      console.log('Manual payment response:', data);

      if (response.ok) {
        alert(`Payment applied successfully! ${data.note || ''}`);
        // Reload customer and transactions
        await loadCustomers();
        await handleViewCustomer(viewingCustomer);
        setBulkPaymentAmount('');
        setSelectedTransactions(new Set());
        setShowBulkPayment(false);
      } else {
        alert(`Failed to apply payment: ${data.message || data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to apply manual payment:', error);
      alert('Failed to apply payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const toggleTransactionSelection = (txId: string) => {
    const newSelection = new Set(selectedTransactions);
    if (newSelection.has(txId)) {
      newSelection.delete(txId);
    } else {
      newSelection.add(txId);
    }
    setSelectedTransactions(newSelection);
  };

  const handleLogout = () => {
    logout();
    window.location.replace('/login/');
  };

  const filteredCustomers = customers.filter(
    (customer: any) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phoneNumber.includes(searchQuery)
  );
  
  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);
  
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalOutstanding = customers.reduce((sum: number, customer: any) => sum + (customer.outstandingBalance || 0), 0);

  if (!user) {
    return null;
  }

  return (
    <PullToRefresh onRefresh={loadCustomers}>
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
              <ConnectionStatus onRefresh={loadCustomers} isUpdating={isUpdating} />
              <div className="text-right">
                <h2 className="text-lg font-semibold text-gray-900">Customers</h2>
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
              className="px-4 py-3 text-blue-600 border-b-2 border-blue-600 font-medium"
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8" style={{ paddingTop: 'calc(152px + env(safe-area-inset-top))' }}>
        {isLoading ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-gray-600">Loading customers...</p>
            </div>
            
            {/* Stats skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
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
        {/* Stats - Only show when not viewing specific customer */}
        {!viewingCustomer && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
                </div>
                <Phone className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Outstanding</p>
                  <p className="text-2xl font-bold text-gray-900">₹{totalOutstanding.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </div>
        )}

        {showForm ? (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            <CustomerForm
              customer={editingCustomer || undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingCustomer(null);
              }}
              isLoading={isSubmitting}
            />
          </div>
        ) : viewingCustomer ? (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{viewingCustomer.name}</h2>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {viewingCustomer.phoneNumber}
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">{viewingCustomer.outstandingBalance < 0 ? 'Customer Credit: ' : 'Outstanding Balance: '}</span>
                    <span className={`font-semibold ${viewingCustomer.outstandingBalance > 0 ? 'text-red-600' : viewingCustomer.outstandingBalance < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                      {viewingCustomer.outstandingBalance < 0 ? '-' : ''}₹{Math.abs(viewingCustomer.outstandingBalance || 0).toFixed(2)}
                    </span>
                    {viewingCustomer.outstandingBalance < 0 && (
                      <span className="text-xs text-green-600 ml-2">(Advance)</span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  setViewingCustomer(null);
                  setCustomerTransactions([]);
                  setCustomerPayments([]);
                }}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Close
              </Button>
            </div>

            {/* Payment History Section */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                💰 Payment History
              </h3>
              
              {loadingPayments ? (
                <div className="text-center py-4 text-gray-500">Loading payment history...</div>
              ) : customerPayments.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500 text-sm">
                  No payments recorded yet
                </div>
              ) : (
                <>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount Paid</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Applied</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mode</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Transactions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {customerPayments.slice(0, paymentsToShow).map((payment: any, index: number) => (
                          <tr key={payment._id || index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(payment.paymentDate).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                              ₹{payment.paymentAmount?.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              ₹{payment.amountApplied?.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                payment.mode === 'fifo' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {payment.mode === 'fifo' ? 'FIFO' : 'Manual'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">
                              {payment.transactionsAffected?.length || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Load More button */}
                  {customerPayments.length > paymentsToShow && (
                    <div className="mt-3 text-center">
                      <Button
                        onClick={() => setPaymentsToShow(prev => prev + 5)}
                        variant="secondary"
                        className="text-sm"
                      >
                        Load More ({customerPayments.length - paymentsToShow} remaining)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
              
              {/* Date Filter */}
              {!loadingTransactions && customerTransactions.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date Range</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">From Date</label>
                      <input
                        type="date"
                        value={txStartDate}
                        onChange={(e) => {
                          setTxStartDate(e.target.value);
                          setTxCurrentPage(1);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">To Date</label>
                      <input
                        type="date"
                        value={txEndDate}
                        onChange={(e) => {
                          setTxEndDate(e.target.value);
                          setTxCurrentPage(1);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          setTxStartDate(today);
                          setTxEndDate(today);
                          setTxCurrentPage(1);
                        }}
                        variant="secondary"
                        className="whitespace-nowrap"
                      >
                        Today
                      </Button>
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => {
                          setTxStartDate('');
                          setTxEndDate('');
                          setTxCurrentPage(1);
                        }}
                        variant="secondary"
                        className="whitespace-nowrap"
                      >
                        All Time
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Bulk Payment Section - Always show when viewing customer */}
              {!loadingTransactions && (
                <div className={`border rounded-lg p-4 mb-4 ${
                  viewingCustomer.outstandingBalance > 0 
                    ? 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200' 
                    : 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {viewingCustomer.outstandingBalance > 0 
                        ? 'Clear Outstanding Balance' 
                        : 'Accept Payment / Advance'}
                    </h4>
                    <Button
                      onClick={() => setShowBulkPayment(!showBulkPayment)}
                      variant="secondary"
                    >
                      {showBulkPayment ? 'Hide' : 'Show'} Options
                    </Button>
                  </div>
                  
                  {showBulkPayment && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Amount Received
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={bulkPaymentAmount}
                          onChange={(e) => setBulkPaymentAmount(e.target.value)}
                          placeholder="Enter amount (e.g., 10000)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 bg-white"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {viewingCustomer.outstandingBalance > 0 && (
                          <>
                            <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                              <h5 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                <span className="text-lg">🔄</span>
                                Auto FIFO Mode
                              </h5>
                              <p className="text-xs text-gray-600 mb-3">
                                Automatically clear oldest outstanding transactions first until amount is exhausted
                              </p>
                              <Button
                                onClick={handleBulkPaymentFIFO}
                                disabled={processingPayment || !bulkPaymentAmount}
                                className="w-full bg-blue-600 hover:bg-blue-700"
                              >
                                {processingPayment ? 'Processing...' : 'Apply FIFO Payment'}
                              </Button>
                            </div>
                            
                            <div className="bg-white p-4 rounded-lg border-2 border-purple-200">
                              <h5 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                                <span className="text-lg">☑️</span>
                                Manual Selection Mode
                              </h5>
                              <p className="text-xs text-gray-600 mb-3">
                                Select specific transactions below using checkboxes, then click to apply payment
                              </p>
                              <Button
                                onClick={handleManualPayment}
                                disabled={processingPayment || !bulkPaymentAmount || selectedTransactions.size === 0}
                                className="w-full bg-purple-600 hover:bg-purple-700"
                              >
                                {processingPayment ? 'Processing...' : `Clear ${selectedTransactions.size} Selected`}
                              </Button>
                            </div>
                          </>
                        )}
                        
                        {viewingCustomer.outstandingBalance <= 0 && (
                          <div className="bg-white p-4 rounded-lg border-2 border-indigo-200 md:col-span-2">
                            <h5 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                              <span className="text-lg">💰</span>
                              Accept Advance Payment
                            </h5>
                            <p className="text-xs text-gray-600 mb-3">
                              {viewingCustomer.outstandingBalance < 0 
                                ? `Customer already has ₹${Math.abs(viewingCustomer.outstandingBalance).toFixed(2)} in advance credit. Additional payment will increase their credit.`
                                : 'Customer has no outstanding balance. Any payment received will be stored as advance credit for future purchases.'}
                            </p>
                            <Button
                              onClick={handleBulkPaymentFIFO}
                              disabled={processingPayment || !bulkPaymentAmount}
                              className="w-full bg-indigo-600 hover:bg-indigo-700"
                            >
                              {processingPayment ? 'Processing...' : 'Accept Advance Payment'}
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      {viewingCustomer.outstandingBalance > 0 && selectedTransactions.size > 0 && (
                        <div className="bg-purple-50 p-3 rounded border border-purple-200">
                          <p className="text-sm text-purple-900">
                            <strong>{selectedTransactions.size}</strong> transaction(s) selected for manual payment
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {loadingTransactions ? (
                <div className="text-center py-8 text-gray-500">Loading transactions...</div>
              ) : customerTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                  No transactions found for this customer.
                </div>
              ) : (() => {
                // Apply date filtering
                let filteredTx = customerTransactions.filter(tx => {
                  if (!txStartDate && !txEndDate) return true;
                  const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
                  if (txStartDate && txEndDate) {
                    return txDate >= txStartDate && txDate <= txEndDate;
                  } else if (txStartDate) {
                    return txDate >= txStartDate;
                  } else if (txEndDate) {
                    return txDate <= txEndDate;
                  }
                  return true;
                });
                
                // When bulk payment is shown, filter to only outstanding transactions and show all (no pagination)
                if (showBulkPayment) {
                  filteredTx = filteredTx.filter(tx => tx.balanceAmount > 0);
                }
                
                // Apply pagination only when bulk payment is NOT shown
                const txTotalPages = showBulkPayment ? 1 : Math.ceil(filteredTx.length / txItemsPerPage);
                const txStartIndex = showBulkPayment ? 0 : (txCurrentPage - 1) * txItemsPerPage;
                const txEndIndex = showBulkPayment ? filteredTx.length : txStartIndex + txItemsPerPage;
                const paginatedTx = filteredTx.slice(txStartIndex, txEndIndex);
                
                return filteredTx.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                    No transactions found for the selected date range.
                  </div>
                ) : (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Transactions</p>
                      <p className="text-xl font-bold text-gray-900">{filteredTx.length}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Purchased</p>
                      <p className="text-xl font-bold text-green-600">
                        ₹{filteredTx.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Paid</p>
                      <p className="text-xl font-bold text-amber-600">
                        ₹{filteredTx.reduce((sum, tx) => sum + (tx.paymentReceived || 0), 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Transactions List */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Horizontal scroll wrapper for mobile */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              {showBulkPayment && (
                                <span className="text-purple-600">Select</span>
                              )}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Items</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Total</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Paid</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Balance</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedTx.map((tx: any) => {
                            const txBalance = tx.balanceAmount || ((tx.grandTotal || tx.totalAmount || 0) - (tx.paymentReceived || 0));
                            return (
                          <tr key={tx._id?.toString() || tx.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-center">
                              {showBulkPayment && txBalance > 0 && (
                                <input
                                  type="checkbox"
                                  checked={selectedTransactions.has(tx._id?.toString() || tx.id)}
                                  onChange={() => toggleTransactionSelection(tx._id?.toString() || tx.id)}
                                  className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer"
                                />
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                              {new Date(tx.transactionDate).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {tx.items?.length || 0} item(s)
                              <div className="text-xs text-gray-500 mt-1">
                                {tx.items?.slice(0, 2).map((item: any, i: number) => (
                                  <div key={i}>{item.itemName} (×{item.quantity})</div>
                                ))}
                                {tx.items?.length > 2 && (
                                  <div className="text-gray-400">+{tx.items.length - 2} more</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium whitespace-nowrap">
                              ₹{(tx.grandTotal || tx.totalAmount || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-green-600 text-right whitespace-nowrap">
                              ₹{(tx.paymentReceived || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                              <span className={txBalance > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                                ₹{txBalance.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 capitalize whitespace-nowrap">
                              {tx.paymentMethod}
                            </td>
                          </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination - Hidden when bulk payment is shown */}
                    {!showBulkPayment && txTotalPages > 1 && (
                      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                          Showing {txStartIndex + 1} to {Math.min(txEndIndex, filteredTx.length)} of {filteredTx.length} results
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setTxCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={txCurrentPage === 1}
                            variant="secondary"
                            className="px-3 py-1 text-sm"
                          >
                            Previous
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: txTotalPages }, (_, i) => i + 1).map(page => (
                              <button
                                key={page}
                                onClick={() => setTxCurrentPage(page)}
                                className={`px-3 py-1 text-sm rounded ${
                                  txCurrentPage === page
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>
                          <Button
                            onClick={() => setTxCurrentPage(prev => Math.min(txTotalPages, prev + 1))}
                            disabled={txCurrentPage === txTotalPages}
                            variant="secondary"
                            className="px-3 py-1 text-sm"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <>
            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search customers by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>
              <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Customer
              </Button>
            </div>

            {/* Customers Table */}
            {filteredCustomers.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">No customers found. Add your first customer to get started.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {/* Horizontal scroll wrapper for mobile */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Outstanding Balance</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedCustomers.map((customer: any) => (
                        <tr key={customer._id?.toString() || customer.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{customer.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{customer.phoneNumber}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                            <span className={customer.outstandingBalance > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              ₹{customer.outstandingBalance?.toFixed(2) || '0.00'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleViewCustomer(customer)} 
                                className="text-blue-600 hover:text-blue-900"
                                title="View Transactions"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleEdit(customer)} 
                                className="text-green-600 hover:text-green-900"
                                title="Edit Customer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(customer._id || customer.id)} 
                                className="text-red-600 hover:text-red-900"
                                title="Delete Customer"
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
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredCustomers.length)} of {filteredCustomers.length} results
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
