import { create } from 'zustand';
import { StockTransaction } from '@/types';

interface StockTransactionsState {
  stockTransactions: StockTransaction[];
  isLoading: boolean;
  setStockTransactions: (transactions: StockTransaction[]) => void;
  addStockTransaction: (transaction: StockTransaction) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useStockTransactionsStore = create<StockTransactionsState>((set) => ({
  stockTransactions: [],
  isLoading: false,
  setStockTransactions: (transactions) => set({ stockTransactions: transactions }),
  addStockTransaction: (transaction) => set((state) => ({ 
    stockTransactions: [transaction, ...state.stockTransactions] 
  })),
  setLoading: (isLoading) => set({ isLoading }),
}));
