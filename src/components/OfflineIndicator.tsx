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
    try {
      const count = await syncService.getPendingChangesCount();
      setPendingChanges(count);
    } catch (error) {
      console.error('Failed to update pending count:', error);
      setPendingChanges(0);
    }
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
    <div className="fixed right-4 z-50" style={{ bottom: 'max(3rem, calc(48px + env(safe-area-inset-bottom)))' }}>
      <button
        onClick={handleManualSync}
        disabled={!isOnline || syncing}
        className={`w-12 h-12 rounded-full border-2 shadow-lg flex items-center justify-center transition-all ${getStatusColor()} ${
          !isOnline || syncing ? 'cursor-not-allowed opacity-70' : 'hover:scale-110'
        }`}
        title={getStatusText() + (pendingChanges > 0 ? ` (${pendingChanges})` : '')}
      >
        {getStatusIcon()}
      </button>
    </div>
  );
}
