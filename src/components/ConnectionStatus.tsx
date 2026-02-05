'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { syncService } from '@/lib/syncService';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

interface ConnectionStatusProps {
  onRefresh?: () => void;
  isUpdating?: boolean;
}

export function ConnectionStatus({ onRefresh, isUpdating = false }: ConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const isNative = Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';

    // Check initial online status
    if (isNative) {
      let networkListener: any;

      Network.getStatus().then(status => {
        setIsOnline(status.connected);
      });

      // Listen for network status changes
      Network.addListener('networkStatusChange', status => {
        setIsOnline(status.connected);
        if (status.connected) {
          // Auto-sync when back online
          handleSync();
        }
      }).then(listener => {
        networkListener = listener;
      });

      // Check pending changes periodically
      updatePendingCount();
      const interval = setInterval(updatePendingCount, 5000);

      return () => {
        if (networkListener) {
          networkListener.remove();
        }
        clearInterval(interval);
      };
    } else {
      // Fallback to navigator.onLine for web
      setIsOnline(navigator.onLine);

      const handleOnline = () => {
        setIsOnline(true);
        handleSync();
      };
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      updatePendingCount();
      const interval = setInterval(updatePendingCount, 5000);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        clearInterval(interval);
      };
    }
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

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    try {
      await syncService.syncAll();
      await updatePendingCount();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusConfig = () => {
    if (isUpdating) {
      return {
        color: 'blue',
        dotClass: 'bg-blue-500',
        textClass: 'text-blue-700',
        bgClass: 'bg-blue-50',
        text: 'Updating...'
      };
    } else if (isOnline && pendingChanges === 0) {
      return {
        color: 'green',
        dotClass: 'bg-green-500',
        textClass: 'text-green-700',
        bgClass: 'bg-green-50',
        text: 'Online • Synced'
      };
    } else if (isOnline && pendingChanges > 0) {
      return {
        color: 'yellow',
        dotClass: 'bg-yellow-500',
        textClass: 'text-yellow-700',
        bgClass: 'bg-yellow-50',
        text: `Online • ${pendingChanges} Unsynced`
      };
    } else if (!isOnline && pendingChanges === 0) {
      return {
        color: 'orange',
        dotClass: 'bg-orange-500',
        textClass: 'text-orange-700',
        bgClass: 'bg-orange-50',
        text: 'Offline • Cached Data'
      };
    } else {
      return {
        color: 'orange',
        dotClass: 'bg-orange-500',
        textClass: 'text-orange-700',
        bgClass: 'bg-orange-50',
        text: `Offline • ${pendingChanges} Unsynced`
      };
    }
  };

  const status = getStatusConfig();

  return (
    <button
      onClick={handleSync}
      disabled={!isOnline || isSyncing}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${status.bgClass} ${status.textClass} text-sm font-medium transition-all ${
        isOnline && !isSyncing ? 'hover:scale-105 cursor-pointer' : 'cursor-default'
      }`}
      title={isOnline ? 'Click to sync now' : 'Waiting for connection'}
    >
      <span className={`w-2 h-2 rounded-full ${status.dotClass} ${isSyncing ? 'animate-pulse' : ''}`}></span>
      <span>{status.text}</span>
      {isSyncing && <RefreshCw className="w-3 h-3 animate-spin" />}
    </button>
  );
}
