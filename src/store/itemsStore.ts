// Items Store - State management for inventory
import { create } from 'zustand';
import { Item } from '@/types';

interface ItemsState {
  items: Item[];
  isLoading: boolean;
  error: string | null;
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  updateItem: (id: string, item: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearItems: () => void;
}

export const useItemsStore = create<ItemsState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  setItems: (items) => set({ items, error: null }),

  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
      error: null,
    })),

  updateItem: (id, updatedItem) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updatedItem } : item
      ),
      error: null,
    })),

  deleteItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      error: null,
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clearItems: () => set({ items: [], error: null }),
}));
