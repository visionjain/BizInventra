'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Item, ItemUnit } from '@/types';
import { Upload, X } from 'lucide-react';

interface ItemFormProps {
  item?: Item;
  onSubmit: (item: { name: string; buyPrice: number; sellPrice: number; quantity: number; unit: ItemUnit; imageUrl?: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ItemForm({ item, onSubmit, onCancel, isLoading }: ItemFormProps) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    buyPrice: item?.buyPrice?.toString() || '',
    sellPrice: item?.sellPrice?.toString() || '',
    quantity: item?.quantity?.toString() || '',
    unit: item?.unit || ItemUnit.PCS,
    imageUrl: item?.imageUrl || '',
  });
  const [imagePreview, setImagePreview] = useState<string>(item?.imageUrl || '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Item name is required';
    }

    if (!formData.buyPrice || parseFloat(formData.buyPrice) < 0) {
      newErrors.buyPrice = 'Valid buy price is required';
    }

    if (!formData.sellPrice || parseFloat(formData.sellPrice) < 0) {
      newErrors.sellPrice = 'Valid sell price is required';
    }

    if (!formData.quantity || parseFloat(formData.quantity) < 0) {
      newErrors.quantity = 'Valid quantity is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image size should be less than 2MB');
        return;
      }
      
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        setFormData({ ...formData, imageUrl: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview('');
    setFormData({ ...formData, imageUrl: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    onSubmit({
      name: formData.name.trim(),
      buyPrice: parseFloat(formData.buyPrice),
      sellPrice: parseFloat(formData.sellPrice),
      quantity: parseFloat(formData.quantity),
      unit: formData.unit as ItemUnit,
      imageUrl: formData.imageUrl || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Item Name"
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Enter item name"
        error={errors.name}
        required
      />

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Item Image (Optional)</label>
        {imagePreview ? (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border" />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload" className="cursor-pointer">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Click to upload image</p>
              <p className="text-xs text-gray-400 mt-1">Max size: 2MB</p>
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Buy Price (₹)"
          type="number"
          step="0.01"
          value={formData.buyPrice}
          onChange={(e) => setFormData({ ...formData, buyPrice: e.target.value })}
          placeholder="0.00"
          error={errors.buyPrice}
          required
        />

        <Input
          label="Sell Price (₹)"
          type="number"
          step="0.01"
          value={formData.sellPrice}
          onChange={(e) => setFormData({ ...formData, sellPrice: e.target.value })}
          placeholder="0.00"
          error={errors.sellPrice}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Quantity"
          type="number"
          step="0.01"
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
          placeholder="0"
          error={errors.quantity}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit
          </label>
          <select
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value as ItemUnit })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.values(ItemUnit).map((unit) => (
              <option key={unit} value={unit}>
                {unit.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1" isLoading={isLoading}>
          {item ? 'Update Item' : 'Add Item'}
        </Button>
        <Button type="button" onClick={onCancel} variant="outline" className="flex-1">
          Cancel
        </Button>
      </div>
    </form>
  );
}
