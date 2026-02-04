import { create } from 'zustand';
import { Customer } from '@/types';

interface CustomersState {
  customers: Customer[];
  isLoading: boolean;
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useCustomersStore = create<CustomersState>((set) => ({
  customers: [],
  isLoading: false,
  setCustomers: (customers) => set({ customers }),
  addCustomer: (customer) => set((state) => ({ customers: [...state.customers, customer] })),
  updateCustomer: (id, updatedCustomer) =>
    set((state) => ({
      customers: state.customers.map((c) => (c.id === id ? { ...c, ...updatedCustomer } : c)),
    })),
  deleteCustomer: (id) => set((state) => ({ customers: state.customers.filter((c) => c.id !== id) })),
  setLoading: (isLoading) => set({ isLoading }),
}));
