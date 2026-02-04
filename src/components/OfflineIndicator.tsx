'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, Cloud } from 'lucide-react';
import { syncService, SyncStatus } from '@/lib/syncService';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to sync status changes
    syncService.onSyncStatusChange((status) => {
      setSyncStatus(status);
      if (status === 'synced') {
        setLastSyncTime(new Date().toLocaleTimeString());
        updatePendingCount();
      }
    });

    // Update pending count periodically
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const updatePendingCount = async () => {
    const count = await syncService.getPendingChangesCount();
    setPendingChanges(count);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const result = await syncService.manualSync();
      if (result.success) {
        setLastSyncTime(new Date().toLocaleTimeString());
        await updatePendingCount();
      } else if (result.errors.length > 0) {
        alert(`Sync completed with errors:\n${result.errors.join('\n')}`);
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      alert('Manual sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4 text-red-500" />;
    if (syncStatus === 'syncing' || syncing) return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    if (syncStatus === 'error') return <AlertCircle className="w-4 h-4 text-orange-500" />;
    if (pendingChanges > 0) return <Cloud className="w-4 h-4 text-yellow-500" />;
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (syncStatus === 'syncing' || syncing) return 'Syncing...';
    if (syncStatus === 'error') return 'Sync Error';
    if (pendingChanges > 0) return `${pendingChanges} pending`;
    return 'Synced';
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-50 border-red-200 text-red-700';
    if (syncStatus === 'syncing' || syncing) return 'bg-blue-50 border-blue-200 text-blue-700';
    if (syncStatus === 'error') return 'bg-orange-50 border-orange-200 text-orange-700';
    if (pendingChanges > 0) return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    return 'bg-green-50 border-green-200 text-green-700';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border shadow-lg ${getStatusColor()}`}>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
        
        {lastSyncTime && isOnline && (
          <span className="text-xs opacity-75">
            {lastSyncTime}
          </span>
        )}

        {isOnline && !syncing && (
          <button
            onClick={handleManualSync}
            className="p-1 hover:bg-white/50 rounded transition-colors"
            title="Sync now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {!isOnline && (
        <div className="mt-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          Working offline. Changes will sync when online.
        </div>
      )}
    </div>
  );
}
