'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Customer } from '@/types';

interface CustomerFormProps {
  customer?: Customer;
  onSubmit: (customer: { name: string; phoneNumber: string; outstandingBalance: number }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CustomerForm({ customer, onSubmit, onCancel, isLoading }: CustomerFormProps) {
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    phoneNumber: customer?.phoneNumber || '',
    outstandingBalance: customer?.outstandingBalance?.toString() || '0',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Customer name is required';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phoneNumber.replace(/\s/g, ''))) {
      newErrors.phoneNumber = 'Please enter a valid 10-digit phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    onSubmit({
      name: formData.name.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      outstandingBalance: parseFloat(formData.outstandingBalance) || 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Customer Name"
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Enter customer name"
        error={errors.name}
        required
      />

      <Input
        label="Phone Number"
        type="tel"
        value={formData.phoneNumber}
        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
        placeholder="Enter 10-digit phone number"
        error={errors.phoneNumber}
        required
      />

      {customer ? (
        // Show outstanding balance as read-only when editing
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
          <p className="text-xl font-semibold text-gray-900">
            ₹{parseFloat(formData.outstandingBalance).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            💡 Outstanding balance is automatically managed by sales transactions and cannot be edited manually.
          </p>
        </div>
      ) : (
        // Allow setting initial balance only when creating new customer
        <div>
          <Input
            label="Initial Outstanding Balance (₹)"
            type="number"
            step="0.01"
            value={formData.outstandingBalance}
            onChange={(e) => setFormData({ ...formData, outstandingBalance: e.target.value })}
            placeholder="0.00"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter any existing outstanding balance this customer has (if starting with previous records).
          </p>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : customer ? 'Update Customer' : 'Add Customer'}
        </Button>
      </div>
    </form>
  );
}
