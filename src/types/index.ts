// Core Types for Bizinventra

export interface User {
  id: string;
  name: string;
  email: string;
  companyName: string;
  phoneNumber: string;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date;
}

export interface Item {
  id: string;
  _id?: string;
  userId: string;
  name: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  unit: ItemUnit;
  imageUrl?: string;
  customerPrices?: Array<{ customerId: string; price: number }>;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  lastModifiedAt: Date;
}

export enum ItemUnit {
  PCS = 'pcs',
  KG = 'kg',
  LITRE = 'litre',
  GRAM = 'gram',
  METER = 'meter',
  BOX = 'box',
  DOZEN = 'dozen',
}

export interface Customer {
  id: string;
  _id?: string;
  userId: string;
  name: string;
  phoneNumber: string;
  outstandingBalance: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  lastModifiedAt: Date;
}

export interface StockTransaction {
  id: string;
  userId: string;
  itemId: string;
  itemName?: string;
  quantity: number;
  transactionType: 'addition' | 'sale' | 'adjustment';
  notes?: string;
  transactionDate: Date;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  customerId?: string;
  customerName?: string;
  items: any[];
  totalAmount: number;
  paymentReceived: number;
  balanceAmount: number;
  paymentMethod: string;
  notes?: string;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  lastModifiedAt: Date;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  sellPrice: number;
  subtotal: number;
}

export enum PaymentStatus {
  PAID = 'paid',
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
}

export enum SaleType {
  IMMEDIATE = 'immediate',
  WALKIN = 'walkin',
  CREDIT = 'credit',
}

export interface SyncLog {
  id: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  operation: SyncOperation;
  synced: boolean;
  createdAt: Date;
}

export enum EntityType {
  ITEM = 'item',
  CUSTOMER = 'customer',
  TRANSACTION = 'transaction',
}

export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  phoneNumber: string;
}

export interface ItemFormData {
  name: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  unit: ItemUnit;
}

export interface CustomerFormData {
  name: string;
  phoneNumber: string;
}

export interface SaleFormData {
  customerId?: string;
  saleType: SaleType;
  items: {
    itemId: string;
    quantity: number;
  }[];
  paymentReceived?: number;
}

// Reports Types
export interface SalesReport {
  totalSales: number;
  totalTransactions: number;
  paidAmount: number;
  unpaidAmount: number;
  period: string;
}

export interface ProfitLossReport {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  period: string;
}

export interface OutstandingPayment {
  customerId: string;
  customerName: string;
  totalOutstanding: number;
  transactions: Transaction[];
}

// Sync Types
export interface SyncState {
  isSyncing: boolean;
  lastSyncTime?: Date;
  pendingChanges: number;
  syncError?: string;
}

export interface SyncPayload {
  items: Item[];
  customers: Customer[];
  transactions: Transaction[];
  lastSyncAt: Date;
}
