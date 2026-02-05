// Offline SQLite Database (Native with Capacitor)
// This uses native SQLite on Android and web fallback in browser

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

let db: SQLiteDBConnection | null = null;
let sqlite: SQLiteConnection;
let isWeb = false;

export async function initDatabase() {
  if (db) return db;
  
  try {
    const platform = Capacitor.getPlatform();
    isWeb = platform === 'web';

    // Skip SQLite initialization on web for now (use API only)
    // SQLite will work on Android native
    if (isWeb) {
      console.log('Running on web - using MongoDB API only');
      return null;
    }

    sqlite = new SQLiteConnection(CapacitorSQLite);
    
    // Create or open database
    const dbName = 'bizinventra.db';
    const encrypted = false;
    const mode = 'no-encryption';
    const version = 1;

    // Check if connection exists
    const ret = await sqlite.checkConnectionsConsistency();
    const isConn = await sqlite.isConnection(dbName, false);

    if (ret.result && isConn.result) {
      db = await sqlite.retrieveConnection(dbName, false);
    } else {
      db = await sqlite.createConnection(dbName, encrypted, mode, version, false);
    }

    await db.open();
    console.log('SQLite database opened:', dbName);

    // Create tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        company_name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_sync_at TEXT
      );

      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        buy_price REAL NOT NULL,
        sell_price REAL NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        last_modified_at TEXT NOT NULL,
        synced INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        outstanding_balance REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        last_modified_at TEXT NOT NULL,
        synced INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT,
        transaction_date TEXT NOT NULL,
        total_amount REAL NOT NULL,
        payment_status TEXT NOT NULL,
        payment_received REAL NOT NULL,
        outstanding_amount REAL NOT NULL,
        balance_amount REAL DEFAULT 0,
        sale_type TEXT NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        notes TEXT,
        total_profit REAL DEFAULT 0,
        total_additional_charges REAL DEFAULT 0,
        items_json TEXT,
        additional_charges_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        last_modified_at TEXT NOT NULL,
        synced INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );

      CREATE TABLE IF NOT EXISTS transaction_items (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        sell_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id),
        FOREIGN KEY (item_id) REFERENCES items(id)
      );

      CREATE TABLE IF NOT EXISTS return_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT,
        transaction_date TEXT NOT NULL,
        total_return_value REAL NOT NULL,
        total_profit_lost REAL NOT NULL,
        return_reason TEXT,
        items_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        last_modified_at TEXT NOT NULL,
        synced INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id)
      );

      CREATE TABLE IF NOT EXISTS sync_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
      CREATE INDEX IF NOT EXISTS idx_items_synced ON items(synced);
      CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
      CREATE INDEX IF NOT EXISTS idx_customers_synced ON customers(synced);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_synced ON transactions(synced);
      CREATE INDEX IF NOT EXISTS idx_sync_log_synced ON sync_log(synced);
    `);

    console.log('Database tables created');

    // Save changes for web
    if (isWeb) {
      await sqlite.saveToStore(dbName);
    }

    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export async function saveDatabase() {
  if (!db || isWeb) return;
  
  try {
    // Auto-saved on native platforms
    console.log('Database changes saved');
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

export function getDatabase() {
  return db;
}
// Utility function to run queries safely
export async function executeQuery<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const database = await initDatabase();
  if (!database) {
    console.warn('Database not available - returning empty results');
    return [];
  }
  
  try {
    const result = await database.query(sql, params);
    await saveDatabase();
    return result.values || [];
  } catch (error) {
    console.error('Database query error:', error);
    return [];
  }
}

// Utility function to run insert/update/delete queries
export async function executeUpdate(
  sql: string,
  params: any[] = []
): Promise<void> {
  const database = await initDatabase();
  if (!database) {
    console.warn('Database not available - skipping update');
    return;
  }
  
  try {
    await database.run(sql, params);
    await saveDatabase();
  } catch (error) {
    console.error('Database update error:', error);
  }
}

// Generate UUID
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Auto-save for web (not needed for native)
let autoSaveInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSave(): void {
  if (!isWeb || autoSaveInterval) return;
  
  autoSaveInterval = setInterval(() => {
    saveDatabase();
  }, 5000);
}

export function stopAutoSave(): void {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

// ==================== OFFLINE CRUD OPERATIONS ====================

// ITEMS
export async function saveItemOffline(userId: string, item: any): Promise<string> {
  const id = item.id || generateId();
  const now = new Date().toISOString();
  
  await executeUpdate(
    `INSERT OR REPLACE INTO items (id, user_id, name, buy_price, sell_price, quantity, unit, created_at, updated_at, is_deleted, last_modified_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`,
    [id, userId, item.name, item.buyPrice, item.sellPrice, item.quantity, item.unit, item.createdAt || now, now, now]
  );
  
  // Add to sync queue
  await executeUpdate(
    `INSERT INTO sync_log (id, user_id, entity_type, entity_id, operation, synced, created_at)
     VALUES (?, ?, 'item', ?, 'upsert', 0, ?)`,
    [generateId(), userId, id, now]
  );
  
  return id;
}

export async function getItemsOffline(userId: string): Promise<any[]> {
  const items = await executeQuery(
    'SELECT * FROM items WHERE user_id = ? AND is_deleted = 0',
    [userId]
  );
  
  return items.map((item: any) => ({
    id: item.id,
    _id: item.id,
    name: item.name,
    buyPrice: item.buy_price,
    sellPrice: item.sell_price,
    quantity: item.quantity,
    unit: item.unit,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  }));
}

export async function updateItemOffline(userId: string, itemId: string, updates: any): Promise<void> {
  const now = new Date().toISOString();
  
  await executeUpdate(
    `UPDATE items SET name = ?, buy_price = ?, sell_price = ?, quantity = ?, unit = ?, updated_at = ?, last_modified_at = ?, synced = 0
     WHERE id = ? AND user_id = ?`,
    [updates.name, updates.buyPrice, updates.sellPrice, updates.quantity, updates.unit, now, now, itemId, userId]
  );
  
  // Add to sync queue
  await executeUpdate(
    `INSERT INTO sync_log (id, user_id, entity_type, entity_id, operation, synced, created_at)
     VALUES (?, ?, 'item', ?, 'update', 0, ?)`,
    [generateId(), userId, itemId, now]
  );
}

export async function deleteItemOffline(userId: string, itemId: string): Promise<void> {
  const now = new Date().toISOString();
  
  await executeUpdate(
    `UPDATE items SET is_deleted = 1, updated_at = ?, last_modified_at = ?, synced = 0
     WHERE id = ? AND user_id = ?`,
    [now, now, itemId, userId]
  );
  
  // Add to sync queue
  await executeUpdate(
    `INSERT INTO sync_log (id, user_id, entity_type, entity_id, operation, synced, created_at)
     VALUES (?, ?, 'item', ?, 'delete', 0, ?)`,
    [generateId(), userId, itemId, now]
  );
}

// CUSTOMERS
export async function saveCustomerOffline(userId: string, customer: any): Promise<string> {
  const id = customer.id || generateId();
  const now = new Date().toISOString();
  
  await executeUpdate(
    `INSERT OR REPLACE INTO customers (id, user_id, name, phone_number, outstanding_balance, created_at, updated_at, is_deleted, last_modified_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`,
    [id, userId, customer.name, customer.phoneNumber, customer.outstandingBalance || 0, customer.createdAt || now, now, now]
  );
  
  // Add to sync queue
  await executeUpdate(
    `INSERT INTO sync_log (id, user_id, entity_type, entity_id, operation, synced, created_at)
     VALUES (?, ?, 'customer', ?, 'upsert', 0, ?)`,
    [generateId(), userId, id, now]
  );
  
  return id;
}

export async function getCustomersOffline(userId: string): Promise<any[]> {
  const customers = await executeQuery(
    'SELECT * FROM customers WHERE user_id = ? AND is_deleted = 0',
    [userId]
  );
  
  return customers.map((c: any) => ({
    id: c.id,
    _id: c.id,
    name: c.name,
    phoneNumber: c.phone_number,
    outstandingBalance: c.outstanding_balance,
    createdAt: new Date(c.created_at),
    updatedAt: new Date(c.updated_at),
  }));
}

export async function updateCustomerOffline(userId: string, customerId: string, updates: any): Promise<void> {
  const now = new Date().toISOString();
  
  await executeUpdate(
    `UPDATE customers SET name = ?, phone_number = ?, outstanding_balance = ?, updated_at = ?, last_modified_at = ?, synced = 0
     WHERE id = ? AND user_id = ?`,
    [updates.name, updates.phoneNumber, updates.outstandingBalance, now, now, customerId, userId]
  );
  
  // Add to sync queue
  await executeUpdate(
    `INSERT INTO sync_log (id, user_id, entity_type, entity_id, operation, synced, created_at)
     VALUES (?, ?, 'customer', ?, 'update', 0, ?)`,
    [generateId(), userId, customerId, now]
  );
}

// TRANSACTIONS
export async function saveTransactionOffline(userId: string, transaction: any): Promise<string> {
  const id = transaction.id || generateId();
  const now = new Date().toISOString();
  
  await executeUpdate(
    `INSERT OR REPLACE INTO transactions (id, user_id, customer_id, customer_name, transaction_date, total_amount, payment_status, payment_received, outstanding_amount, sale_type, created_at, updated_at, is_deleted, last_modified_at, synced, items_json, additional_charges_json, total_profit, payment_method, notes, balance_amount, total_additional_charges)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, transaction.customerId || null, transaction.customerName || 'Walk-in',
      transaction.transactionDate || now, transaction.totalAmount, 
      transaction.balanceAmount > 0 ? 'pending' : 'paid',
      transaction.paymentReceived, transaction.balanceAmount || 0, 'sale',
      now, now, now,
      JSON.stringify(transaction.items), JSON.stringify(transaction.additionalCharges || []),
      transaction.totalProfit || 0, transaction.paymentMethod || 'cash',
      transaction.notes || '', transaction.balanceAmount || 0,
      transaction.totalAdditionalCharges || 0
    ]
  );
  
  // Update item quantities offline
  for (const item of transaction.items) {
    await executeUpdate(
      'UPDATE items SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ? AND user_id = ?',
      [item.quantity, now, item.itemId, userId]
    );
  }
  
  // Update customer balance if applicable
  if (transaction.customerId && transaction.balanceAmount) {
    await executeUpdate(
      'UPDATE customers SET outstanding_balance = outstanding_balance + ?, updated_at = ?, synced = 0 WHERE id = ? AND user_id = ?',
      [transaction.balanceAmount, now, transaction.customerId, userId]
    );
  }
  
  // Add to sync queue
  await executeUpdate(
    `INSERT INTO sync_log (id, user_id, entity_type, entity_id, operation, synced, created_at)
     VALUES (?, ?, 'transaction', ?, 'insert', 0, ?)`,
    [generateId(), userId, id, now]
  );
  
  return id;
}

export async function getTransactionsOffline(userId: string): Promise<any[]> {
  const transactions = await executeQuery(
    'SELECT * FROM transactions WHERE user_id = ? AND is_deleted = 0 ORDER BY transaction_date DESC',
    [userId]
  );
  
  return transactions.map((t: any) => ({
    id: t.id,
    _id: t.id,
    customerId: t.customer_id,
    customerName: t.customer_name,
    transactionDate: new Date(t.transaction_date),
    totalAmount: t.total_amount,
    paymentReceived: t.payment_received,
    balanceAmount: t.balance_amount,
    totalProfit: t.total_profit,
    paymentMethod: t.payment_method,
    notes: t.notes,
    items: JSON.parse(t.items_json || '[]'),
    additionalCharges: JSON.parse(t.additional_charges_json || '[]'),
    totalAdditionalCharges: t.total_additional_charges,
    createdAt: new Date(t.created_at),
  }));
}

// CACHE OPERATIONS - Save API data to local storage for offline access
export async function saveTransactionsToCache(userId: string, transactions: any[]): Promise<void> {
  for (const tx of transactions) {
    const txId = tx._id || tx.id;
    
    // Check if transaction exists
    const existing = await executeQuery(
      'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      [txId, userId]
    );
    
    if (existing.length > 0) {
      // Update existing
      await executeUpdate(
        `UPDATE transactions SET 
          customer_id = ?,
          customer_name = ?,
          total_amount = ?,
          payment_received = ?,
          balance_amount = ?,
          total_profit = ?,
          payment_method = ?,
          notes = ?,
          items_json = ?,
          additional_charges_json = ?,
          total_additional_charges = ?,
          transaction_date = ?,
          synced = 1
        WHERE id = ? AND user_id = ?`,
        [
          tx.customerId,
          tx.customerName,
          tx.totalAmount,
          tx.paymentReceived,
          tx.balanceAmount,
          tx.totalProfit || 0,
          tx.paymentMethod || '',
          tx.notes || '',
          JSON.stringify(tx.items || []),
          JSON.stringify(tx.additionalCharges || []),
          tx.totalAdditionalCharges || 0,
          tx.transactionDate || new Date().toISOString(),
          txId,
          userId
        ]
      );
    } else {
      // Insert new
      await executeUpdate(
        `INSERT INTO transactions (
          id, user_id, customer_id, customer_name, total_amount,
          payment_received, balance_amount, total_profit, payment_method,
          notes, items_json, additional_charges_json, total_additional_charges,
          transaction_date, synced, is_deleted, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        [
          txId,
          userId,
          tx.customerId,
          tx.customerName,
          tx.totalAmount,
          tx.paymentReceived,
          tx.balanceAmount,
          tx.totalProfit || 0,
          tx.paymentMethod || '',
          tx.notes || '',
          JSON.stringify(tx.items || []),
          JSON.stringify(tx.additionalCharges || []),
          tx.totalAdditionalCharges || 0,
          tx.transactionDate || new Date().toISOString(),
          new Date().toISOString()
        ]
      );
    }
  }
  await saveDatabase();
}

export async function saveItemsToCache(userId: string, items: any[]): Promise<void> {
  for (const item of items) {
    const itemId = item._id || item.id;
    
    // Check if item exists
    const existing = await executeQuery(
      'SELECT id FROM items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );
    
    if (existing.length > 0) {
      // Update existing
      await executeUpdate(
        `UPDATE items SET 
          item_name = ?,
          buy_price = ?,
          sell_price = ?,
          quantity = ?,
          category = ?,
          synced = 1
        WHERE id = ? AND user_id = ?`,
        [
          item.itemName,
          item.buyPrice,
          item.sellPrice,
          item.quantity,
          item.category || '',
          itemId,
          userId
        ]
      );
    } else {
      // Insert new
      await executeUpdate(
        `INSERT INTO items (
          id, user_id, item_name, buy_price, sell_price, quantity, category,
          synced, is_deleted, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        [
          itemId,
          userId,
          item.itemName,
          item.buyPrice,
          item.sellPrice,
          item.quantity,
          item.category || '',
          new Date().toISOString()
        ]
      );
    }
  }
  await saveDatabase();
}

export async function saveCustomersToCache(userId: string, customers: any[]): Promise<void> {
  for (const customer of customers) {
    const customerId = customer._id || customer.id;
    
    // Check if customer exists
    const existing = await executeQuery(
      'SELECT id FROM customers WHERE id = ? AND user_id = ?',
      [customerId, userId]
    );
    
    if (existing.length > 0) {
      // Update existing
      await executeUpdate(
        `UPDATE customers SET 
          customer_name = ?,
          phone = ?,
          email = ?,
          address = ?,
          balance = ?,
          synced = 1
        WHERE id = ? AND user_id = ?`,
        [
          customer.customerName,
          customer.phone || '',
          customer.email || '',
          customer.address || '',
          customer.balance || 0,
          customerId,
          userId
        ]
      );
    } else {
      // Insert new
      await executeUpdate(
        `INSERT INTO customers (
          id, user_id, customer_name, phone, email, address, balance,
          synced, is_deleted, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        [
          customerId,
          userId,
          customer.customerName,
          customer.phone || '',
          customer.email || '',
          customer.address || '',
          customer.balance || 0,
          new Date().toISOString()
        ]
      );
    }
  }
  await saveDatabase();
}

// SYNC OPERATIONS
export async function getPendingSyncItems(userId: string): Promise<any[]> {
  return await executeQuery(
    'SELECT * FROM sync_log WHERE user_id = ? AND synced = 0 ORDER BY created_at ASC',
    [userId]
  );
}

export async function markItemSynced(syncId: string): Promise<void> {
  await executeUpdate(
    'UPDATE sync_log SET synced = 1 WHERE id = ?',
    [syncId]
  );
}

export async function markEntitySynced(entityType: string, entityId: string): Promise<void> {
  const table = entityType === 'item' ? 'items' : entityType === 'customer' ? 'customers' : 'transactions';
  await executeUpdate(
    `UPDATE ${table} SET synced = 1 WHERE id = ?`,
    [entityId]
  );
}

// UPDATE TRANSACTION OFFLINE
export async function updateTransactionOffline(userId: string, transactionId: string, updates: any): Promise<void> {
  const now = new Date().toISOString();
  
  await executeUpdate(
    `UPDATE transactions SET 
      customer_id = ?,
      customer_name = ?,
      total_amount = ?,
      payment_received = ?,
      balance_amount = ?,
      payment_method = ?,
      notes = ?,
      total_profit = ?,
      total_additional_charges = ?,
      items_json = ?,
      additional_charges_json = ?,
      updated_at = ?,
      last_modified_at = ?,
      synced = 0
    WHERE id = ? AND user_id = ?`,
    [
      updates.customerId || null,
      updates.customerName,
      updates.totalAmount,
      updates.paymentReceived,
      updates.balanceAmount,
      updates.paymentMethod,
      updates.notes || '',
      updates.totalProfit,
      updates.totalAdditionalCharges || 0,
      JSON.stringify(updates.items || []),
      JSON.stringify(updates.additionalCharges || []),
      now,
      now,
      transactionId,
      userId
    ]
  );
  
  // Add to sync queue
  await executeUpdate(
    `INSERT INTO sync_log (id, user_id, entity_type, entity_id, operation, synced, created_at)
     VALUES (?, ?, 'transaction', ?, 'update', 0, ?)`,
    [generateId(), userId, transactionId, now]
  );
}

// SAVE RETURN OFFLINE
export async function saveReturnOffline(userId: string, returnData: any): Promise<string> {
  const id = generateId();
  const now = new Date().toISOString();
  
  await executeUpdate(
    `INSERT INTO return_transactions (
      id, user_id, transaction_id, customer_id, customer_name,
      transaction_date, total_return_value, total_profit_lost,
      return_reason, items_json, created_at, updated_at,
      last_modified_at, is_deleted, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    [
      id,
      userId,
      returnData.transactionId,
      returnData.customerId || null,
      returnData.customerName,
      now,
      returnData.totalReturnValue,
      returnData.totalProfitLost,
      returnData.returnReason || '',
      JSON.stringify(returnData.items || []),
      now,
      now,
      now
    ]
  );
  
  // Update stock for returned items
  for (const item of returnData.items || []) {
    await executeUpdate(
      `UPDATE items SET quantity = quantity + ?, updated_at = ?, last_modified_at = ?
       WHERE id = ? AND user_id = ?`,
      [item.quantity, now, now, item.itemId, userId]
    );
  }
  
  // Update customer balance if applicable
  if (returnData.customerId) {
    await executeUpdate(
      `UPDATE customers SET outstanding_balance = outstanding_balance - ?,
       updated_at = ?, last_modified_at = ?
       WHERE id = ? AND user_id = ?`,
      [returnData.totalReturnValue, now, now, returnData.customerId, userId]
    );
  }
  
  // Add to sync queue
  await executeUpdate(
    `INSERT INTO sync_log (id, user_id, entity_type, entity_id, operation, synced, created_at)
     VALUES (?, ?, 'return', ?, 'insert', 0, ?)`,
    [generateId(), userId, id, now]
  );
  
  return id;
}

// GET RETURNS OFFLINE
export async function getReturnsOffline(userId: string): Promise<any[]> {
  const returns = await executeQuery(
    'SELECT * FROM return_transactions WHERE user_id = ? AND is_deleted = 0 ORDER BY transaction_date DESC',
    [userId]
  );
  
  return returns.map((r: any) => ({
    id: r.id,
    _id: r.id,
    transactionId: r.transaction_id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    transactionDate: new Date(r.transaction_date),
    totalReturnValue: r.total_return_value,
    totalProfitLost: r.total_profit_lost,
    returnReason: r.return_reason,
    items: JSON.parse(r.items_json || '[]'),
    createdAt: new Date(r.created_at),
  }));
}
