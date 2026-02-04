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
        sale_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        last_modified_at TEXT NOT NULL,
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
      CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
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
