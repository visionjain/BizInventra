'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useItemsStore } from '@/store/itemsStore';
import { useStockTransactionsStore } from '@/store/stockTransactionsStore';
import { ItemForm } from '@/components/items/ItemForm';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { PullToRefresh } from '@/components/PullToRefresh';
import { Item, ItemUnit } from '@/types';
import { Plus, Edit2, Trash2, Search, LogOut, PackagePlus, History, DollarSign, TrendingUp, Clock, Phone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export default function ItemsPage() {
  const router = useRouter();
  const { user, logout, checkAuth, isAuthenticated } = useAuthStore();
  const { items, setItems, addItem, updateItem, deleteItem, setLoading, isLoading } = useItemsStore();
  const { stockTransactions, setStockTransactions } = useStockTransactionsStore();
  
  const [showForm, setShowForm] = useState(false);
  const [showStockForm, setShowStockForm] = useState(false);
  const [showStockHistory, setShowStockHistory] = useState(false);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [showCustomerPrices, setShowCustomerPrices] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerPrices, setCustomerPrices] = useState<any[]>([]);
  const [customerPriceSearch, setCustomerPriceSearch] = useState('');
  const [newCustomerPrice, setNewCustomerPrice] = useState({
    customerId: '',
    price: ''
  });
  const [stockFormData, setStockFormData] = useState({
    quantity: '',
    notes: '',
    transactionDate: new Date().toISOString().slice(0, 16),
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Stock history pagination and date filter
  const [stockHistoryPage, setStockHistoryPage] = useState(1);
  const stockHistoryPerPage = 50;
  const [stockHistoryTotal, setStockHistoryTotal] = useState(0);
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false);
  
  // Stock history date range - default to last 30 days
  const getDefaultStockDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };
  const [stockStartDate, setStockStartDate] = useState(getDefaultStockDates().start);
  const [stockEndDate, setStockEndDate] = useState(getDefaultStockDates().end);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
    setIsInitialized(true);
  }, []);

  // Redirect to login if not authenticated (only after initialization)
  useEffect(() => {
    if (isInitialized && !user) {
      router.push('/login');
    }
  }, [isInitialized, user, router]);

  // Load items when user is available
  useEffect(() => {
    if (user && isInitialized) {
      loadItems();
    }
  }, [user, isInitialized]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      const isNative = platform === 'android' || platform === 'ios';
      
      let isOnline = navigator.onLine;
      
      // Use Network plugin for reliable detection on native
      if (isNative) {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        isOnline = status.connected;
      }
      
      // Try online first
      if (isOnline) {
        try {
          const response = await fetch('/api/items');
          if (response.ok) {
            const data = await response.json();
            setItems(data.items || []);
            
            // Save to cache for offline access
            if (isNative && data.items) {
              const { saveItemsToCache } = await import('@/lib/db/sqlite');
              await saveItemsToCache(user!.id, data.items);
            }
            return;
          }
        } catch (error) {
          console.log('Online fetch failed, falling back to offline:', error);
          // Continue to offline mode below
        }
      }
      
      // Load from offline SQLite
      if (isNative) {
        const { getItemsOffline } = await import('@/lib/db/sqlite');
        const offlineItems = await getItemsOffline(user!.id);
        setItems(offlineItems);
        console.log('Loaded items from offline storage');
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: { name: string; buyPrice: number; sellPrice: number; quantity: number; unit: ItemUnit; imageUrl?: string }) => {
    setIsSubmitting(true);
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      const isNative = platform === 'android' || platform === 'ios';
      const isOffline = !navigator.onLine;

      if (editingItem) {
        const itemId = editingItem._id || editingItem.id;
        
        // Try online update
        if (!isOffline) {
          const response = await fetch(`/api/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });

          if (response.ok) {
            setShowForm(false);
            setEditingItem(null);
            await loadItems();
            alert('Item updated successfully!');
            return;
          }
        }
        
        // Fallback to offline update (native only)
        if (isNative) {
          const { updateItemOffline } = await import('@/lib/db/sqlite');
          await updateItemOffline(user!.id, itemId, formData);
          setShowForm(false);
          setEditingItem(null);
          await loadItems();
          alert('Item updated offline. Will sync when online.');
        } else {
          alert('Cannot update item offline on web. Please check your connection.');
        }
      } else {
        // Try online create
        if (!isOffline) {
          const response = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });

          if (response.ok) {
            const data = await response.json();
            addItem(data.item);
            setShowForm(false);
            await loadItems();
            alert('Item added successfully!');
            return;
          }
        }
        
        // Fallback to offline create (native only)
        if (isNative) {
          const { saveItemOffline } = await import('@/lib/db/sqlite');
          const itemId = await saveItemOffline(user!.id, formData);
          const newItem = { 
            ...formData, 
            id: itemId, 
            _id: itemId,
            userId: user!.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            isDeleted: false,
            lastModifiedAt: new Date()
          };
          addItem(newItem);
          setShowForm(false);
          await loadItems();
          alert('Item added offline. Will sync when online.');
        } else {
          alert('Cannot add item offline on web. Please check your connection.');
        }
      }
    } catch (error) {
      console.error('Failed to save item:', error);
      alert('Failed to save item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: any) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const itemId = typeof id === 'object' ? id.toString() : id;
      const isOffline = !navigator.onLine;
      
      // Try online delete
      if (!isOffline) {
        const response = await fetch(`/api/items/${itemId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          deleteItem(itemId);
          await loadItems();
          return;
        }
      }
      
      // Fallback to offline delete (native only)
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      if (platform === 'android' || platform === 'ios') {
        const { deleteItemOffline } = await import('@/lib/db/sqlite');
        await deleteItemOffline(user!.id, itemId);
        deleteItem(itemId);
        await loadItems();
        alert('Item deleted offline. Will sync when online.');
      } else {
        alert('Cannot delete item offline on web. Please check your connection.');
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleAddStock = (item: any) => {
    setSelectedItem(item);
    setShowStockForm(true);
  };

  const handleStockSubmit = async () => {
    if (!selectedItem || !stockFormData.quantity) {
      alert('Please enter quantity');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemId = selectedItem._id?.toString() || selectedItem.id?.toString();
      
      if (!itemId) {
        alert('Invalid item selected. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/stock-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: itemId,
          quantity: parseFloat(stockFormData.quantity),
          notes: stockFormData.notes,
          transactionType: 'addition',
          transactionDate: new Date(stockFormData.transactionDate).toISOString(),
        }),
      });

      if (response.ok) {
        setShowStockForm(false);
        setSelectedItem(null);
        setStockFormData({ quantity: '', notes: '', transactionDate: new Date().toISOString().slice(0, 16) });
        await loadItems(); // Reload to get updated stock
        alert('Stock added successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to add stock: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to add stock:', error);
      alert('Failed to add stock. Please check console for details.');
      alert('Failed to add stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewHistory = async (item: any) => {
    setSelectedItem(item);
    setShowStockHistory(true);
    setStockHistoryPage(1);
    await loadStockHistory(item._id || item.id, 0);
  };
  
  const loadStockHistory = async (itemId?: string, skip: number = 0) => {
    setStockHistoryLoading(true);
    try {
      let url = `/api/stock-transactions/paginated?limit=${stockHistoryPerPage}&skip=${skip}&startDate=${stockStartDate}&endDate=${stockEndDate}`;
      if (itemId) {
        url += `&itemId=${itemId}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStockTransactions(data.stockTransactions || []);
        setStockHistoryTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to load stock history:', error);
    } finally {
      setStockHistoryLoading(false);
    }
  };

  const handleViewAllHistory = async () => {
    setSelectedItem(null);
    setShowStockHistory(true);
    setStockHistoryPage(1);
    await loadStockHistory(undefined, 0);
  };

  const handleViewPriceHistory = (item: any) => {
    setSelectedItem(item);
    const history = item.priceHistory || [];
    // Sort by date descending (newest first)
    const sorted = [...history].sort((a: any, b: any) => 
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
    setPriceHistory(sorted);
    setShowPriceHistory(true);
  };

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const handleManageCustomerPrices = async (item: any) => {
    setSelectedItem(item);
    setShowCustomerPrices(true);
    setCustomerPrices(item.customerPrices || []);
    setNewCustomerPrice({ customerId: '', price: '' });
    setCustomerPriceSearch('');
    await loadCustomers();
  };

  const handleAddCustomerPrice = async () => {
    if (!selectedItem || !newCustomerPrice.customerId || !newCustomerPrice.price) {
      alert('Please select a customer and enter a price');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemId = selectedItem._id || selectedItem.id;
      const response = await fetch(`/api/items/${itemId}/customer-prices`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: newCustomerPrice.customerId,
          price: parseFloat(newCustomerPrice.price)
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCustomerPrices(data.customerPrices || []);
        setNewCustomerPrice({ customerId: '', price: '' });
        // Reload items to get updated data
        await loadItems();
        alert('Customer price updated successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to update price: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update customer price:', error);
      alert('Failed to update customer price');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomerPrice = async (customerId: string) => {
    if (!selectedItem) return;
    
    if (!confirm('Remove this customer-specific price?')) return;

    setIsSubmitting(true);
    try {
      const itemId = selectedItem._id || selectedItem.id;
      const response = await fetch(`/api/items/${itemId}/customer-prices?customerId=${customerId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        setCustomerPrices(data.customerPrices || []);
        // Reload items to get updated data
        await loadItems();
        alert('Customer price removed successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to remove price: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete customer price:', error);
      alert('Failed to delete customer price');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );  
  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);
  
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  // Show loading if redirecting
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadItems}>
      <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Bizinventra" className="h-12 w-12" />
              <img src="/titlelogo.png" alt="Bizinventra" className="h-10 hidden md:block" />
            </div>
            <div className="flex items-center gap-4">
              <ConnectionStatus onRefresh={loadItems} />
              <div className="text-right">
                <h2 className="text-lg font-semibold text-gray-900">Items</h2>
                <p className="text-sm text-gray-600">{user?.companyName}</p>
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
              className="px-4 py-3 text-blue-600 border-b-2 border-blue-600 font-medium"
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8" style={{ paddingTop: 'calc(152px + env(safe-area-inset-top))' }}>
        {showForm ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h2>
            <ItemForm
              item={editingItem || undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingItem(null);
              }}
              isLoading={isSubmitting}
            />
          </div>
        ) : showStockForm ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Add Stock - {selectedItem?.name}</h2>
            <div className="space-y-4">
              <Input
                label="Quantity to Add"
                type="number"
                step="0.01"
                value={stockFormData.quantity}
                onChange={(e) => setStockFormData({ ...stockFormData, quantity: e.target.value })}
                placeholder="Enter quantity"
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Date & Time</label>
                <input
                  type="datetime-local"
                  value={stockFormData.transactionDate}
                  onChange={(e) => setStockFormData({ ...stockFormData, transactionDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={stockFormData.notes}
                  onChange={(e) => setStockFormData({ ...stockFormData, notes: e.target.value })}
                  placeholder="Add notes about this stock addition..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => {
                    setShowStockForm(false);
                    setSelectedItem(null);
                    setStockFormData({ quantity: '', notes: '', transactionDate: new Date().toISOString().slice(0, 16) });
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleStockSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Stock'}
                </Button>
              </div>
            </div>
          </div>
        ) : showStockHistory ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Stock History {selectedItem ? `- ${selectedItem.name}` : '- All Items'}
              </h2>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowStockHistory(false);
                  setSelectedItem(null);
                }}
              >
                Close
              </Button>
            </div>
            
            {/* Date Range Filter */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date Range</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">From Date</label>
                  <input
                    type="date"
                    value={stockStartDate}
                    onChange={(e) => {
                      setStockStartDate(e.target.value);
                      setStockHistoryPage(1);
                      loadStockHistory(selectedItem?._id || selectedItem?.id, 0);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">To Date</label>
                  <input
                    type="date"
                    value={stockEndDate}
                    onChange={(e) => {
                      setStockEndDate(e.target.value);
                      setStockHistoryPage(1);
                      loadStockHistory(selectedItem?._id || selectedItem?.id, 0);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => {
                      const defaults = getDefaultStockDates();
                      setStockStartDate(defaults.start);
                      setStockEndDate(defaults.end);
                      setStockHistoryPage(1);
                      loadStockHistory(selectedItem?._id || selectedItem?.id, 0);
                    }}
                    variant="secondary"
                    className="whitespace-nowrap"
                  >
                    Last 30 Days
                  </Button>
                </div>
              </div>
            </div>
            
            {stockHistoryLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="ml-3 text-gray-600">Loading stock history...</p>
              </div>
            ) : stockTransactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No stock transactions found for the selected date range</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Date</th>
                          {!selectedItem && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Item</th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Quantity</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {stockTransactions.map((tx: any) => (
                          <tr key={tx._id || tx.id}>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                              {new Date(tx.transactionDate).toLocaleString()}
                            </td>
                            {!selectedItem && (
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                                {tx.itemName || 'Unknown'}
                              </td>
                            )}
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                tx.transactionType === 'addition' ? 'bg-green-100 text-green-800' :
                                tx.transactionType === 'sale' ? 'bg-blue-100 text-blue-800' :
                                tx.transactionType === 'return' ? 'bg-orange-100 text-orange-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {tx.transactionType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <span className={tx.quantity > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{tx.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination */}
                  {stockHistoryTotal > stockHistoryPerPage && (
                    <div className="mt-4 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {(stockHistoryPage - 1) * stockHistoryPerPage + 1} to {Math.min(stockHistoryPage * stockHistoryPerPage, stockHistoryTotal)} of {stockHistoryTotal} results
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            const newPage = Math.max(1, stockHistoryPage - 1);
                            setStockHistoryPage(newPage);
                            loadStockHistory(selectedItem?._id || selectedItem?.id, (newPage - 1) * stockHistoryPerPage);
                          }}
                          disabled={stockHistoryPage === 1}
                          variant="secondary"
                          className="px-3 py-1 text-sm"
                        >
                          Previous
                        </Button>
                        <span className="px-3 py-1 text-sm text-gray-700">
                          Page {stockHistoryPage} of {Math.ceil(stockHistoryTotal / stockHistoryPerPage)}
                        </span>
                        <Button
                          onClick={() => {
                            const newPage = Math.min(Math.ceil(stockHistoryTotal / stockHistoryPerPage), stockHistoryPage + 1);
                            setStockHistoryPage(newPage);
                            loadStockHistory(selectedItem?._id || selectedItem?.id, (newPage - 1) * stockHistoryPerPage);
                          }}
                          disabled={stockHistoryPage >= Math.ceil(stockHistoryTotal / stockHistoryPerPage)}
                          variant="secondary"
                          className="px-3 py-1 text-sm"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        ) : showPriceHistory ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Price History - {selectedItem?.name}
              </h2>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowPriceHistory(false);
                  setSelectedItem(null);
                  setPriceHistory([]);
                }}
              >
                Close
              </Button>
            </div>
            {priceHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No price changes recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buy Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sell Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {priceHistory.map((ph: any, index: number) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(ph.changedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          ₹{ph.buyPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          ₹{ph.sellPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ph.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : showCustomerPrices ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">Customer-Specific Prices</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedItem?.name}</p>
                <p className="text-xs text-gray-500">Default Price: ₹{selectedItem?.sellPrice.toFixed(2)}/{selectedItem?.unit}</p>
              </div>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowCustomerPrices(false);
                  setSelectedItem(null);
                  setCustomerPrices([]);
                  setNewCustomerPrice({ customerId: '', price: '' });
                }}
              >
                Close
              </Button>
            </div>

            {/* Add New Customer Price */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Customer-Specific Price</h3>
              
              {!newCustomerPrice.customerId ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Search Customer</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search by name or phone..."
                        value={customerPriceSearch}
                        onChange={(e) => setCustomerPriceSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {customerPriceSearch && (() => {
                    const availableCustomers = customers.filter(c => 
                      !customerPrices.find(cp => cp.customerId.toString() === (c._id || c.id).toString())
                    );
                    const filtered = availableCustomers.filter((customer) =>
                      customer.name.toLowerCase().includes(customerPriceSearch.toLowerCase()) ||
                      customer.phoneNumber.includes(customerPriceSearch)
                    );
                    
                    return filtered.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-2 bg-white">
                        {filtered.map((customer) => (
                          <div
                            key={customer._id || customer.id}
                            className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300"
                            onClick={() => {
                              setNewCustomerPrice({ ...newCustomerPrice, customerId: customer._id || customer.id });
                              setCustomerPriceSearch('');
                            }}
                          >
                            <h4 className="font-medium text-gray-900 text-sm">{customer.name}</h4>
                            <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3" />
                              {customer.phoneNumber}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-sm text-gray-500 border border-gray-300 rounded-lg bg-white">
                        No customers found matching "{customerPriceSearch}"
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Selected Customer */}
                  <div className="bg-white border border-blue-300 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {customers.find(c => (c._id || c.id) === newCustomerPrice.customerId)?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {customers.find(c => (c._id || c.id) === newCustomerPrice.customerId)?.phoneNumber}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewCustomerPrice({ customerId: '', price: '' })}
                        className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Price Input */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newCustomerPrice.price}
                        onChange={(e) => setNewCustomerPrice({ ...newCustomerPrice, price: e.target.value })}
                        placeholder="Enter price"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={handleAddCustomerPrice}
                        disabled={isSubmitting || !newCustomerPrice.price}
                        className="w-full"
                      >
                        {isSubmitting ? 'Adding...' : 'Add Price'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Existing Customer Prices */}
            {customerPrices.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No customer-specific prices set</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Special Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customerPrices.map((cp: any) => {
                      const customer = customers.find(c => (c._id || c.id).toString() === cp.customerId.toString());
                      return (
                        <tr key={cp.customerId}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {customer?.name || 'Unknown Customer'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="font-semibold text-gray-900">₹{cp.price.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            <button
                              onClick={() => handleDeleteCustomerPrice(cp.customerId)}
                              disabled={isSubmitting}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <>
            {isLoading ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600">Loading items...</p>
                </div>
                
                {/* Stats skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {[...Array(4)].map((_, i) => (
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
            {/* Inventory Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Inventory Cost</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₹{items.reduce((sum, item) => sum + (item.buyPrice * item.quantity), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Total investment in stock</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₹{items.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Potential revenue from all stock</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleViewAllHistory} variant="secondary" className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    All Stock History
                  </Button>
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="w-5 h-5 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500 text-lg">No items found</p>
                <p className="text-gray-400 mt-2">Add your first item to get started</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {/* Horizontal scroll wrapper for mobile */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Image</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Item Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Buy Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Sell Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Current Stock</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedItems.map((item: any) => (
                        <tr key={item._id?.toString() || item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-cover rounded" />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">No image</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{item.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">₹{item.buyPrice.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">₹{item.sellPrice.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap">
                            <span className={`font-medium ${item.quantity < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                              {item.quantity} {item.unit}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleAddStock(item)} 
                                className="text-green-600 hover:text-green-900"
                                title="Add Stock"
                              >
                                <PackagePlus className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleViewHistory(item)} 
                                className="text-purple-600 hover:text-purple-900"
                                title="View Stock History"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleViewPriceHistory(item)} 
                                className="text-orange-600 hover:text-orange-900"
                                title="View Price History"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleManageCustomerPrices(item)} 
                                className="text-teal-600 hover:text-teal-900"
                                title="Customer-Specific Prices"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleEdit(item)} 
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit Item"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(item._id || item.id)} 
                                className="text-red-600 hover:text-red-900"
                                title="Delete Item"
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
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredItems.length)} of {filteredItems.length} results
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
