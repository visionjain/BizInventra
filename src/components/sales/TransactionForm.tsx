'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Customer, Item } from '@/types';
import { Plus, Trash2, UserPlus, Search, Minus, Phone } from 'lucide-react';
import Image from 'next/image';

interface TransactionFormProps {
  customers: Customer[];
  items: Item[];
  onSubmit: (transaction: {
    customerId?: string;
    items: { itemId: string; quantity: number; pricePerUnit: number }[];
    paymentReceived: number;
    paymentMethod: string;
    notes: string;
    transactionDate?: string;
    additionalCharges?: { amount: number; reason: string }[];
  }) => void;
  onCancel: () => void;
  onCustomerAdded?: () => void;
  isLoading?: boolean;
  initialData?: any;
}

export function TransactionForm({ customers, items, onSubmit, onCancel, onCustomerAdded, isLoading, initialData }: TransactionFormProps) {
  const [formData, setFormData] = useState({
    customerId: '',
    paymentReceived: '0',
    paymentMethod: 'cash',
    notes: '',
  });

  const [allowPartialPayment, setAllowPartialPayment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phoneNumber: '',
  });
  
  // Additional charges state
  const [additionalCharges, setAdditionalCharges] = useState<
    { amount: number; reason: string }[]
  >([]);
  
  // Custom date/time control - use function to get current local time
  const [useCustomDateTime, setUseCustomDateTime] = useState(false);
  const [customDateTime, setCustomDateTime] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const [transactionItems, setTransactionItems] = useState<
    { itemId: string; quantity: number; pricePerUnit: number; useCustomPrice: boolean }[]
  >([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculate payment when items change or partial payment is disabled
  useEffect(() => {
    if (!allowPartialPayment && transactionItems.length > 0) {
      const itemsTotal = transactionItems.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
      const additionalTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
      const total = itemsTotal + additionalTotal;
      setFormData(prev => ({ ...prev, paymentReceived: total.toString() }));
    }
  }, [transactionItems, allowPartialPayment, additionalCharges]);

  // Reset partial payment if customer is removed (walk-in sales must be full payment)
  useEffect(() => {
    if (!formData.customerId && allowPartialPayment) {
      setAllowPartialPayment(false);
    }
  }, [formData.customerId, allowPartialPayment]);

  // Update prices when customer changes (only for new transactions, not edits)
  useEffect(() => {
    if (!initialData && transactionItems.length > 0) {
      const updatedItems = transactionItems.map((cartItem) => {
        // Skip if using custom price
        if (cartItem.useCustomPrice) {
          return cartItem;
        }

        const item: any = items.find((i: any) => (i._id || i.id) === cartItem.itemId);
        if (!item) return cartItem;

        let priceToUse = item.sellPrice;

        // Check for customer-specific price
        if (formData.customerId && item.customerPrices && item.customerPrices.length > 0) {
          const customerPrice = item.customerPrices.find(
            (cp: any) => cp.customerId.toString() === formData.customerId.toString()
          );
          if (customerPrice) {
            priceToUse = customerPrice.price;
          }
        }

        return {
          ...cartItem,
          pricePerUnit: priceToUse,
        };
      });

      setTransactionItems(updatedItems);
    }
  }, [formData.customerId, items, initialData]);

  // Populate form with initial data when editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        customerId: initialData.customerId || '',
        paymentReceived: initialData.paymentReceived?.toString() || '0',
        paymentMethod: initialData.paymentMethod || 'cash',
        notes: initialData.notes || '',
      });

      // Set transaction items
      if (initialData.items && initialData.items.length > 0) {
        const mappedItems = initialData.items.map((item: any) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          useCustomPrice: false, // Will be determined by comparing with current item price
        }));
        setTransactionItems(mappedItems);
      }

      // Set partial payment if there's a balance
      if (initialData.balanceAmount > 0) {
        setAllowPartialPayment(true);
      }
      
      // Set additional charges if editing
      if (initialData.additionalCharges && initialData.additionalCharges.length > 0) {
        setAdditionalCharges(initialData.additionalCharges);
      }
      
      // Set custom date/time if editing
      if (initialData.transactionDate) {
        const txDate = new Date(initialData.transactionDate);
        const year = txDate.getFullYear();
        const month = String(txDate.getMonth() + 1).padStart(2, '0');
        const day = String(txDate.getDate()).padStart(2, '0');
        const hours = String(txDate.getHours()).padStart(2, '0');
        const minutes = String(txDate.getMinutes()).padStart(2, '0');
        setCustomDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
        setUseCustomDateTime(true);
      }
    } else {
      // Reset to current time for new transactions
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCustomDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
  }, [initialData]);

  const addItemToCart = (item: any) => {
    // Check if there's a customer-specific price for this item
    let priceToUse = item.sellPrice;
    
    // Only apply customer-specific pricing for new transactions (not when editing)
    if (!initialData && formData.customerId && item.customerPrices && item.customerPrices.length > 0) {
      const customerPrice = item.customerPrices.find(
        (cp: any) => cp.customerId.toString() === formData.customerId.toString()
      );
      if (customerPrice) {
        priceToUse = customerPrice.price;
      }
    }
    
    setTransactionItems([
      ...transactionItems,
      {
        itemId: item._id || item.id,
        quantity: 1,
        pricePerUnit: priceToUse,
        useCustomPrice: false,
      },
    ]);
    setSearchQuery(''); // Clear search after adding
  };

  const removeItemFromCart = (index: number) => {
    setTransactionItems(transactionItems.filter((_, i) => i !== index));
  };

  const updateCartItem = (index: number, field: string, value: any) => {
    const updated = [...transactionItems];
    
    // Validate quantity against available stock (skip validation when editing existing transaction)
    if (field === 'quantity' && !initialData) {
      const item: any = items.find((i: any) => (i._id || i.id) === updated[index].itemId);
      if (item && value > item.quantity) {
        alert(`Cannot exceed available stock of ${item.quantity} ${item.unit}`);
        return;
      }
    }
    
    updated[index] = { ...updated[index], [field]: value };
    
    // Reset to default price when custom price is disabled
    if (field === 'useCustomPrice' && !value && updated[index].itemId) {
      const selectedItem: any = items.find((item: any) => (item._id || item.id) === updated[index].itemId);
      if (selectedItem) {
        updated[index].pricePerUnit = selectedItem.sellPrice;
      }
    }
    
    setTransactionItems(updated);
  };

  const incrementQuantity = (index: number) => {
    const updated = [...transactionItems];
    const item: any = items.find((i: any) => (i._id || i.id) === updated[index].itemId);
    
    // Check if increment would exceed stock (skip validation when editing existing transaction)
    if (!initialData && item && updated[index].quantity >= item.quantity) {
      alert(`Cannot exceed available stock of ${item.quantity} ${item.unit}`);
      return;
    }
    
    updated[index].quantity += 1;
    setTransactionItems(updated);
  };

  const decrementQuantity = (index: number) => {
    const updated = [...transactionItems];
    if (updated[index].quantity > 1) {
      updated[index].quantity -= 1;
      setTransactionItems(updated);
    }
  };

  const calculateTotal = () => {
    return transactionItems.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
  };

  const calculateAdditionalChargesTotal = () => {
    return additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
  };

  const calculateGrandTotal = () => {
    return calculateTotal() + calculateAdditionalChargesTotal();
  };

  const addAdditionalCharge = () => {
    setAdditionalCharges([...additionalCharges, { amount: 0, reason: '' }]);
  };

  const removeAdditionalCharge = (index: number) => {
    setAdditionalCharges(additionalCharges.filter((_, i) => i !== index));
  };

  const updateAdditionalCharge = (index: number, field: 'amount' | 'reason', value: any) => {
    const updated = [...additionalCharges];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalCharges(updated);
  };

  const getAvailableItems = () => {
    const selectedItemIds = transactionItems.map((item) => item.itemId);
    return items.filter((item: any) => !selectedItemIds.includes(item._id || item.id));
  };

  const getFilteredItems = () => {
    const availableItems = getAvailableItems();
    
    let filtered = availableItems;
    
    // Filter by search query if provided
    if (searchQuery.trim()) {
      filtered = availableItems.filter((item: any) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      // If no search query, hide out-of-stock items
      filtered = availableItems.filter((item: any) => item.quantity > 0);
    }
    
    // Sort alphabetically by name
    const sorted = filtered.sort((a: any, b: any) => a.name.localeCompare(b.name));
    
    // Always limit to 6 items max
    return sorted.slice(0, 6);
  };

  const getFilteredCustomers = () => {
    let filtered = customers;
    
    // Filter by search query if provided
    if (customerSearchQuery.trim()) {
      filtered = customers.filter((customer: any) =>
        customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        customer.phoneNumber.includes(customerSearchQuery)
      );
    }
    
    // Sort alphabetically by name
    const sorted = filtered.sort((a: any, b: any) => a.name.localeCompare(b.name));
    
    // Always limit to 4 customers max
    return sorted.slice(0, 4);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (transactionItems.length === 0) {
      newErrors.items = 'Please add at least one item';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phoneNumber) {
      alert('Please enter customer name and phone number');
      return;
    }

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomer.name,
          phoneNumber: newCustomer.phoneNumber,
          outstandingBalance: 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFormData({ ...formData, customerId: data.customer._id || data.customer.id });
        setShowNewCustomerForm(false);
        setNewCustomer({ name: '', phoneNumber: '' });
        if (onCustomerAdded) onCustomerAdded();
      }
    } catch (error) {
      console.error('Failed to add customer:', error);
      alert('Failed to add customer');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Always send the transaction date - either custom or current local time
    const finalTransactionDate = useCustomDateTime 
      ? new Date(customDateTime).toISOString() 
      : new Date().toISOString();

    onSubmit({
      customerId: formData.customerId || undefined,
      items: transactionItems,
      paymentReceived: parseFloat(formData.paymentReceived) || 0,
      paymentMethod: formData.paymentMethod,
      notes: formData.notes,
      transactionDate: finalTransactionDate,
      additionalCharges: additionalCharges.filter(charge => charge.amount > 0 && charge.reason.trim() !== ''),
    });
  };

  const totalAmount = calculateTotal();
  const additionalChargesTotal = calculateAdditionalChargesTotal();
  const grandTotal = calculateGrandTotal();
  const balanceAmount = grandTotal - (parseFloat(formData.paymentReceived) || 0);
  const filteredItems = getFilteredItems();
  const filteredCustomers = getFilteredCustomers();
  const selectedCustomer = customers.find((c: any) => (c._id || c.id) === formData.customerId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Selection */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">Customer (Optional - Leave empty for walk-in sales)</label>
          <Button 
            type="button" 
            variant="secondary" 
            onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
            className="flex items-center gap-2 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            {showNewCustomerForm ? 'Cancel' : 'Add New Customer'}
          </Button>
        </div>
        
        {showNewCustomerForm ? (
          <div className="border border-blue-300 rounded-lg p-4 bg-blue-50 space-y-3">
            <Input
              label="Customer Name"
              type="text"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              placeholder="Enter customer name"
            />
            <Input
              label="Phone Number"
              type="tel"
              value={newCustomer.phoneNumber}
              onChange={(e) => setNewCustomer({ ...newCustomer, phoneNumber: e.target.value })}
              placeholder="Enter 10-digit phone number"
            />
            <Button type="button" onClick={handleAddCustomer} className="w-full">
              Save & Select Customer
            </Button>
          </div>
        ) : (
          <div>
            {/* Search Bar */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers by name or phone..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            {/* Selected Customer Display */}
            {selectedCustomer && (
              <div className="mb-2 bg-blue-50 border border-blue-300 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
                  <p className="text-sm text-gray-600">{selectedCustomer.phoneNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, customerId: '' })}
                  className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Customer Cards Grid */}
            {!selectedCustomer && filteredCustomers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                {filteredCustomers.map((customer: any) => (
                  <div
                    key={customer._id || customer.id}
                    className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      setFormData({ ...formData, customerId: customer._id || customer.id });
                      setCustomerSearchQuery('');
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm">{customer.name}</h4>
                        <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" />
                          {customer.phoneNumber}
                        </p>
                        {customer.outstandingBalance > 0 && (
                          <p className="text-xs text-red-600 mt-1 font-medium">
                            Outstanding: ₹{customer.outstandingBalance.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!selectedCustomer && customerSearchQuery && filteredCustomers.length === 0 && (
              <div className="text-center py-4 text-sm text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                No customers found matching "{customerSearchQuery}"
              </div>
            )}
          </div>
        )}
        {errors.customer && <p className="text-red-500 text-sm mt-1">{errors.customer}</p>}
      </div>

      {/* Items */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Search & Add Items *</label>
        
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search for products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
          />
        </div>

        {/* Item Cards Grid */}
        {filteredItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
            {filteredItems.map((item: any) => {
              const isOutOfStock = item.quantity <= 0;
              return (
              <div
                key={item._id || item.id}
                className={`bg-white border rounded-lg p-3 transition-shadow ${
                  isOutOfStock 
                    ? 'border-red-200 opacity-60' 
                    : 'border-gray-200 hover:shadow-md'
                }`}
              >
                <div className="flex gap-3">
                  {/* Item Image */}
                  <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden relative">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <span className="text-2xl">📦</span>
                      </div>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">OUT</span>
                      </div>
                    )}
                  </div>

                  {/* Item Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate text-sm">
                      {item.name}
                    </h4>
                    <p className="text-green-600 font-semibold text-sm">
                      ₹{item.sellPrice.toFixed(2)}
                    </p>
                    <p className={`text-xs ${isOutOfStock ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {isOutOfStock ? 'Out of Stock' : `Stock: ${item.quantity} ${item.unit}`}
                    </p>
                  </div>
                </div>

                {/* Add Button */}
                <button
                  type="button"
                  onClick={() => addItemToCart(item)}
                  disabled={isOutOfStock}
                  className={`w-full mt-2 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors ${
                    isOutOfStock
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  {isOutOfStock ? 'Out of Stock' : 'Add'}
                </button>
              </div>
            )})}
          
          </div>
        )}

        {searchQuery && filteredItems.length === 0 && (
          <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
            No items found matching "{searchQuery}"
          </div>
        )}

        {/* Selected Items Cart */}
        {transactionItems.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Items ({transactionItems.length})</h3>
            {transactionItems.map((cartItem, index) => {
              const item: any = items.find((i: any) => (i._id || i.id) === cartItem.itemId);
              if (!item) return null;

              return (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex gap-3 items-start">
                    {/* Item Image */}
                    <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span className="text-xl">📦</span>
                        </div>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                          <p className="text-xs text-gray-500">Stock: {item.quantity} {item.unit}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItemFromCart(index)}
                          className="text-red-600 hover:bg-red-50 p-1 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => decrementQuantity(index)}
                          className="w-8 h-8 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={cartItem.quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min="0.01"
                          max={initialData ? undefined : item.quantity}
                          step="0.01"
                          value={cartItem.quantity || ''}
                          onChange={(e) => updateCartItem(index, 'quantity', e.target.value ? parseFloat(e.target.value) : 1)}
                          className="w-20 px-2 py-1 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                        <button
                          type="button"
                          onClick={() => incrementQuantity(index)}
                          className="w-8 h-8 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-gray-600">{item.unit}</span>
                      </div>

                      {/* Price Controls */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={cartItem.useCustomPrice}
                            onChange={(e) => updateCartItem(index, 'useCustomPrice', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Override Price</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cartItem.pricePerUnit || ''}
                            onChange={(e) => updateCartItem(index, 'pricePerUnit', e.target.value ? parseFloat(e.target.value) : 0)}
                            placeholder="Price per unit"
                            disabled={!cartItem.useCustomPrice}
                            className={`flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                              cartItem.useCustomPrice
                                ? 'bg-white border-blue-300'
                                : 'bg-gray-100 border-gray-300 cursor-not-allowed'
                            }`}
                          />
                          <span className="text-sm font-semibold text-gray-900 min-w-[80px] text-right">
                            ₹{(cartItem.quantity * cartItem.pricePerUnit).toFixed(2)}
                          </span>
                        </div>
                        {!cartItem.useCustomPrice && (
                          <p className="text-xs text-gray-500">Default: ₹{item.sellPrice.toFixed(2)}/{item.unit}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {transactionItems.length === 0 && (
          <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
            Search and add items to start creating a sale
          </div>
        )}

        {errors.items && <p className="text-red-500 text-sm mt-2">{errors.items}</p>}
      </div>

      {/* Additional Charges Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Additional Charges (Packaging, Fuel, etc.)
          </label>
          <Button 
            type="button" 
            onClick={addAdditionalCharge}
            variant="secondary"
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Charge
          </Button>
        </div>

        {additionalCharges.length > 0 && (
          <div className="space-y-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-700 mb-2">
              💡 These charges are excluded from P&L calculations and tracked separately
            </p>
            {additionalCharges.map((charge, index) => (
              <div key={index} className="flex gap-2 items-start bg-white p-3 rounded border border-gray-200">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={charge.reason}
                    onChange={(e) => updateAdditionalCharge(index, 'reason', e.target.value)}
                    placeholder="Reason (e.g., Packaging, Fuel, Delivery)"
                    className="w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={charge.amount || ''}
                    onChange={(e) => updateAdditionalCharge(index, 'amount', e.target.value ? parseFloat(e.target.value) : 0)}
                    placeholder="Amount"
                    className="w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeAdditionalCharge(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {additionalCharges.length > 0 && (
              <div className="flex justify-between pt-2 border-t border-amber-300">
                <span className="text-sm font-medium text-amber-900">Total Additional Charges:</span>
                <span className="text-sm font-bold text-amber-900">₹{additionalChargesTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Total Summary */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between mb-2">
          <span className="text-gray-700">Items Total:</span>
          <span className="font-semibold text-gray-900">₹{totalAmount.toFixed(2)}</span>
        </div>
        {additionalChargesTotal > 0 && (
          <div className="flex justify-between mb-2">
            <span className="text-gray-700">Additional Charges:</span>
            <span className="font-semibold text-amber-600">₹{additionalChargesTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between mb-3 pb-2 border-b border-gray-300">
          <span className="text-gray-900 font-medium">Grand Total:</span>
          <span className="font-bold text-lg text-gray-900">₹{grandTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mb-2">
```          <span className="text-gray-700">Payment Received:</span>
          <span className="font-semibold text-green-600">₹{(parseFloat(formData.paymentReceived) || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-300">
          <span className="text-gray-900 font-medium">Balance:</span>
          <span className={`font-bold ${balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ₹{balanceAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Partial Payment Toggle */}
      <div className={`p-4 rounded-lg ${
        formData.customerId 
          ? 'bg-blue-50' 
          : 'bg-gray-100 border border-amber-300'
      }`}>
        {!formData.customerId && (
          <p className="text-amber-700 text-sm mb-2 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>Select a customer to allow outstanding/credit sales. Walk-in customers must pay in full.</span>
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="partialPayment"
            checked={allowPartialPayment}
            disabled={!formData.customerId}
            onChange={(e) => {
              setAllowPartialPayment(e.target.checked);
              if (!e.target.checked) {
                setFormData({ ...formData, paymentReceived: totalAmount.toString() });
              }
            }}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label 
            htmlFor="partialPayment" 
            className={`text-sm font-medium cursor-pointer ${
              formData.customerId ? 'text-gray-700' : 'text-gray-500'
            }`}
          >
            Allow Partial Payment / Outstanding
          </label>
          {!allowPartialPayment && formData.customerId && (
            <span className="ml-auto text-xs text-gray-600 italic">Full payment assumed</span>
          )}
        </div>
      </div>

      {/* Transaction Date & Time Control */}
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            id="customDateTime"
            checked={useCustomDateTime}
            onChange={(e) => {
              setUseCustomDateTime(e.target.checked);
              if (e.target.checked) {
                // Reset to current time when enabling
                setCustomDateTime(new Date().toISOString().slice(0, 16));
              }
            }}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
          />
          <label htmlFor="customDateTime" className="text-sm font-medium text-gray-700 cursor-pointer">
            Set Custom Date & Time
          </label>
          {!useCustomDateTime && (
            <span className="ml-auto text-xs text-gray-600 italic">Using current date & time</span>
          )}
        </div>
        
        {useCustomDateTime && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Date & Time
              <span className="text-xs text-gray-500 ml-2">(For adding old transactions)</span>
            </label>
            <input
              type="datetime-local"
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
            />
          </div>
        )}
      </div>

      {/* Payment Details */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Payment Received (₹)"
          type="number"
          step="0.01"
          value={formData.paymentReceived}
          onChange={(e) => setFormData({ ...formData, paymentReceived: e.target.value })}
          placeholder="0.00"
          disabled={!allowPartialPayment}
          className={!allowPartialPayment ? 'bg-gray-100 cursor-not-allowed' : ''}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
          <select
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Add any notes..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Sale'}
        </Button>
      </div>
    </form>
  );
}
