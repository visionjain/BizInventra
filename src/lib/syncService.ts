// Simplified sync service for browser/mobile (using IndexedDB via localStorage for now)
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

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => this.handleOnlineStatusChange(true));
      window.addEventListener('offline', () => this.handleOnlineStatusChange(false));
    }
  }

  private handleOnlineStatusChange(online: boolean) {
    this.isOnline = online;
    if (online && !this.syncInProgress) {
      // Auto-sync when coming back online
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

    this.syncInProgress = true;
    this.notifyStatusChange('syncing');

    const result: SyncResult = {
      success: true,
      itemsSynced: 0,
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Get pending changes from localStorage
      const pendingChanges = this.getPendingChangesFromStorage();
      
      for (const change of pendingChanges) {
        try {
          const response = await fetch(change.endpoint, {
            method: change.method,
            headers: { 'Content-Type': 'application/json' },
            body: change.body ? JSON.stringify(change.body) : undefined,
          });

          if (response.ok) {
            this.removePendingChange(change.id);
            result.itemsSynced++;
          } else {
            throw new Error(`Failed to sync: ${response.statusText}`);
          }
        } catch (error: any) {
          result.errors.push(error.message);
        }
      }

      this.notifyStatusChange('synced');
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      this.notifyStatusChange('error');
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  private getPendingChangesFromStorage(): any[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('pendingChanges');
    return stored ? JSON.parse(stored) : [];
  }

  private removePendingChange(id: string) {
    if (typeof window === 'undefined') return;
    const changes = this.getPendingChangesFromStorage();
    const filtered = changes.filter((c: any) => c.id !== id);
    localStorage.setItem('pendingChanges', JSON.stringify(filtered));
  }

  addPendingChange(endpoint: string, method: string, body?: any) {
    if (typeof window === 'undefined') return;
    const changes = this.getPendingChangesFromStorage();
    changes.push({
      id: Date.now().toString(),
      endpoint,
      method,
      body,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('pendingChanges', JSON.stringify(changes));
  }

  // Manual sync trigger
  async manualSync(): Promise<SyncResult> {
    return this.syncAll();
  }

  // Get pending changes count
  getPendingChangesCount(): number {
    return this.getPendingChangesFromStorage().length;
  }
}

export const syncService = new SyncService();
