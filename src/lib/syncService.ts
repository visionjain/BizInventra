// Comprehensive sync service for SQLite → MongoDB synchronization
export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error';

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  errors: string[];
  timestamp: string;
}

class SyncService {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private syncCallbacks: Array<(status: SyncStatus) => void> = [];
  private autoSyncEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => this.handleOnlineStatusChange(true));
      window.addEventListener('offline', () => this.handleOnlineStatusChange(false));
    }
  }

  private handleOnlineStatusChange(online: boolean) {
    this.isOnline = online;
    if (online && !this.syncInProgress && this.autoSyncEnabled) {
      // Auto-sync when coming back online
      console.log('Device is online, starting auto-sync...');
      this.syncAll().catch(console.error);
    }
  }

  onSyncStatusChange(callback: (status: SyncStatus) => void) {
    this.syncCallbacks.push(callback);
  }

  private notifyStatusChange(status: SyncStatus) {
    this.syncCallbacks.forEach(cb => cb(status));
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  async syncAll(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        itemsSynced: 0,
        errors: ['Sync already in progress'],
        timestamp: new Date().toISOString()
      };
    }

    if (!this.isOnline) {
      return {
        success: false,
        itemsSynced: 0,
        errors: ['Device is offline'],
        timestamp: new Date().toISOString()
      };
    }

    // Check if we're on native platform
    const { Capacitor } = await import('@capacitor/core');
    const platform = Capacitor.getPlatform();
    if (platform !== 'android' && platform !== 'ios') {
      return {
        success: true,
        itemsSynced: 0,
        errors: [],
        timestamp: new Date().toISOString()
      };
    }

    this.syncInProgress = true;
    this.notifyStatusChange('syncing');

    const errors: string[] = [];
    let itemsSynced = 0;

    try {
      const { getPendingSyncItems, markItemSynced, markEntitySynced } = await import('@/lib/db/sqlite');
      const { executeQuery } = await import('@/lib/db/sqlite');
      
      // Get user info from local storage
      const userStr = localStorage.getItem('current_user');
      if (!userStr) {
        throw new Error('No user found');
      }
      const user = JSON.parse(userStr);
      const userId = user.id;

      // Get all pending sync items
      const pendingItems = await getPendingSyncItems(userId);
      
      console.log(`Found ${pendingItems.length} items to sync`);

      // Group by entity type
      const itemsToSync = pendingItems.filter(item => item.entity_type === 'item');
      const customersToSync = pendingItems.filter(item => item.entity_type === 'customer');
      const transactionsToSync = pendingItems.filter(item => item.entity_type === 'transaction');
      const returnsToSync = pendingItems.filter(item => item.entity_type === 'return');

      // Sync items
      for (const syncItem of itemsToSync) {
        try {
          const items = await executeQuery(
            'SELECT * FROM items WHERE id = ? AND user_id = ?',
            [syncItem.entity_id, userId]
          );
          
          if (items.length === 0) continue;
          const item = items[0];

          if (item.is_deleted) {
            // Delete on server
            await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
          } else {
            // Upsert on server
            const response = await fetch('/api/items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: item.id,
                name: item.name,
                buyPrice: item.buy_price,
                sellPrice: item.sell_price,
                quantity: item.quantity,
                unit: item.unit,
              }),
            });

            if (!response.ok) {
              const error = await response.json();
              errors.push(`Item ${item.name}: ${error.error || 'Unknown error'}`);
              continue;
            }
          }

          await markItemSynced(syncItem.id);
          await markEntitySynced('item', item.id);
          itemsSynced++;
        } catch (err) {
          errors.push(`Item sync error: ${err}`);
        }
      }

      // Sync customers
      for (const syncItem of customersToSync) {
        try {
          const customers = await executeQuery(
            'SELECT * FROM customers WHERE id = ? AND user_id = ?',
            [syncItem.entity_id, userId]
          );
          
          if (customers.length === 0) continue;
          const customer = customers[0];

          if (customer.is_deleted) {
            // Skip deleted customers for now (complex with transactions)
            await markItemSynced(syncItem.id);
            continue;
          }

          const response = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: customer.id,
              name: customer.name,
              phoneNumber: customer.phone_number,
              outstandingBalance: customer.outstanding_balance,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            errors.push(`Customer ${customer.name}: ${error.error || 'Unknown error'}`);
            continue;
          }

          await markItemSynced(syncItem.id);
          await markEntitySynced('customer', customer.id);
          itemsSynced++;
        } catch (err) {
          errors.push(`Customer sync error: ${err}`);
        }
      }

      // Sync transactions
      for (const syncItem of transactionsToSync) {
        try {
          const transactions = await executeQuery(
            'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
            [syncItem.entity_id, userId]
          );
          
          if (transactions.length === 0) continue;
          const tx = transactions[0];

          if (tx.is_deleted) {
            // Skip deleted transactions for now
            await markItemSynced(syncItem.id);
            continue;
          }

          const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: tx.customer_id,
              items: JSON.parse(tx.items_json || '[]'),
              paymentReceived: tx.payment_received,
              paymentMethod: tx.payment_method,
              notes: tx.notes,
              transactionDate: tx.transaction_date,
              additionalCharges: JSON.parse(tx.additional_charges_json || '[]'),
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            errors.push(`Transaction: ${error.error || 'Unknown error'}`);
            continue;
          }

          await markItemSynced(syncItem.id);
          await markEntitySynced('transaction', tx.id);
          itemsSynced++;
        } catch (err) {
          errors.push(`Transaction sync error: ${err}`);
        }
      }

      // Sync returns
      for (const syncItem of returnsToSync) {
        try {
          const returns = await executeQuery(
            'SELECT * FROM return_transactions WHERE id = ? AND user_id = ?',
            [syncItem.entity_id, userId]
          );
          
          if (returns.length === 0) continue;
          const returnTx = returns[0];

          if (returnTx.is_deleted) {
            await markItemSynced(syncItem.id);
            continue;
          }

          const response = await fetch('/api/returns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactionId: returnTx.transaction_id,
              customerId: returnTx.customer_id,
              customerName: returnTx.customer_name,
              items: JSON.parse(returnTx.items_json || '[]'),
              totalReturnValue: returnTx.total_return_value,
              totalProfitLost: returnTx.total_profit_lost,
              returnReason: returnTx.return_reason,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            errors.push(`Return: ${error.error || 'Unknown error'}`);
            continue;
          }

          await markItemSynced(syncItem.id);
          itemsSynced++;
        } catch (err) {
          errors.push(`Return sync error: ${err}`);
        }
      }

      this.notifyStatusChange(errors.length > 0 ? 'error' : 'synced');

      return {
        success: errors.length === 0,
        itemsSynced,
        errors,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Sync error:', error);
      this.notifyStatusChange('error');
      
      return {
        success: false,
        itemsSynced,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        timestamp: new Date().toISOString()
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  enableAutoSync() {
    this.autoSyncEnabled = true;
  }

  disableAutoSync() {
    this.autoSyncEnabled = false;
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  // Manual sync trigger
  async manualSync(): Promise<SyncResult> {
    return this.syncAll();
  }

  // Get pending changes count
  async getPendingChangesCount(): Promise<number> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      if (platform !== 'android' && platform !== 'ios') {
        return 0;
      }

      const userStr = localStorage.getItem('current_user');
      if (!userStr) return 0;
      
      const user = JSON.parse(userStr);
      const { getPendingSyncItems, initDatabase } = await import('@/lib/db/sqlite');
      
      // Initialize database first
      await initDatabase();
      
      const pending = await getPendingSyncItems(user.id);
      return pending.length;
    } catch (error) {
      console.error('Failed to get pending changes count:', error);
      return 0;
    }
  }
}

export const syncService = new SyncService();
