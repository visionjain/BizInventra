'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Item } from '@/types';
import { Plus, Trash2, X, Search, Minus } from 'lucide-react';
import Image from 'next/image';

interface ReturnFormProps {
  items: Item[];
  originalTransaction?: any;
  onSubmit: (returnData: {
    originalTransactionId?: string;
    items: { itemId: string; quantity: number; pricePerUnit: number }[];
    refundAmount: number;
    notes: string;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ReturnForm({ items, originalTransaction, onSubmit, onCancel, isLoading }: ReturnFormProps) {
  const [returnItems, setReturnItems] = useState<
    { itemId: string; quantity: number; pricePerUnit: number; useCustomPrice: boolean }[]
  >([]);
  const [refundAmount, setRefundAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const addReturnItem = (itemId: string) => {
    const item = items.find((i: any) => (i._id || i.id) === itemId);
    if (!item) return;

    setReturnItems([
      ...returnItems,
      {
        itemId,
        quantity: 1,
        pricePerUnit: item.sellPrice,
        useCustomPrice: false,
      },
    ]);
    setSearchQuery(''); // Clear search after adding
  };

  const removeReturnItem = (index: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const updateReturnItem = (index: number, field: string, value: any) => {
    const updated = [...returnItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Reset to default price when custom price is disabled
    if (field === 'useCustomPrice' && !value && updated[index].itemId) {
      const item: any = items.find((i: any) => (i._id || i.id) === updated[index].itemId);
      if (item) {
        updated[index].pricePerUnit = item.sellPrice;
      }
    }
    
    setReturnItems(updated);
  };

  const incrementQuantity = (index: number) => {
    const updated = [...returnItems];
    updated[index].quantity += 1;
    setReturnItems(updated);
  };

  const decrementQuantity = (index: number) => {
    const updated = [...returnItems];
    if (updated[index].quantity > 1) {
      updated[index].quantity -= 1;
      setReturnItems(updated);
    }
  };

  const calculateTotal = () => {
    return returnItems.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (returnItems.length === 0) {
      alert('Please add at least one item to return');
      return;
    }

    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      alert('Please enter a valid refund amount');
      return;
    }

    onSubmit({
      originalTransactionId: originalTransaction?._id || originalTransaction?.id,
      items: returnItems,
      refundAmount: parseFloat(refundAmount),
      notes,
    });
  };

  const getFilteredItems = () => {
    if (!searchQuery) return [];
    return items.filter((item: any) => {
      const alreadyAdded = returnItems.some((ri) => ri.itemId === (item._id || item.id));
      if (alreadyAdded) return false;
      return item.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  const filteredItems = getFilteredItems();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Process Return</h2>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Items to Return */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search and Add Items to Return *
        </label>

        {/* Search Box */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items by name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          />
        </div>

        {/* Search Results */}
        {searchQuery && filteredItems.length > 0 && (
          <div className="mb-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
            {filteredItems.map((item: any) => (
              <div
                key={item._id || item.id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
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

                {/* Item Info */}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                  <p className="text-xs text-gray-500">₹{item.sellPrice} per {item.unit}</p>
                </div>

                {/* Add Button */}
                <button
                  type="button"
                  onClick={() => addReturnItem(item._id || item.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        {searchQuery && filteredItems.length === 0 && (
          <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg bg-gray-50 mb-4">
            No items found matching "{searchQuery}"
          </div>
        )}

        {/* Selected Return Items */}
        {returnItems.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Items to Return ({returnItems.length})
            </h3>
            {returnItems.map((returnItem, index) => {
              const item: any = items.find((i: any) => (i._id || i.id) === returnItem.itemId);
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
                          <p className="text-xs text-gray-500">₹{item.sellPrice} per {item.unit}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeReturnItem(index)}
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
                          disabled={returnItem.quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={returnItem.quantity || ''}
                          onChange={(e) => updateReturnItem(index, 'quantity', e.target.value ? parseFloat(e.target.value) : 1)}
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
                            checked={returnItem.useCustomPrice}
                            onChange={(e) => updateReturnItem(index, 'useCustomPrice', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Override Price</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={returnItem.pricePerUnit || ''}
                            onChange={(e) => updateReturnItem(index, 'pricePerUnit', e.target.value ? parseFloat(e.target.value) : 0)}
                            placeholder="Price per unit"
                            disabled={!returnItem.useCustomPrice}
                            className={`flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                              returnItem.useCustomPrice
                                ? 'bg-white border-blue-300'
                                : 'bg-gray-100 border-gray-300 cursor-not-allowed'
                            }`}
                          />
                          <span className="text-sm font-semibold text-gray-900 min-w-[80px] text-right">
                            ₹{(returnItem.quantity * returnItem.pricePerUnit).toFixed(2)}
                          </span>
                        </div>
                        {!returnItem.useCustomPrice && (
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

        {returnItems.length === 0 && !searchQuery && (
          <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
            Search and add items to process return
          </div>
        )}
      </div>

      {/* Return Value */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Total Return Value:</span>
          <span className="text-xl font-bold text-gray-900">₹{calculateTotal().toFixed(2)}</span>
        </div>
      </div>

      {/* Refund Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Refund Amount (₹) *
        </label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={refundAmount}
          onChange={(e) => setRefundAmount(e.target.value)}
          placeholder="Amount to refund to customer"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Can be different from return value (e.g., restocking fee, partial refund)
        </p>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes / Reason for Return
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Optional: Reason for return, condition of items, etc."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button type="button" onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Process Return'}
        </Button>
      </div>
    </form>
  );
}
