import { Capacitor } from '@capacitor/core';

/**
 * Check if device is currently online
 * Works on both web and native platforms
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Check if we're running on a native platform (Android/iOS)
 */
export function isNativePlatform(): boolean {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios';
}

/**
 * Check if offline functionality is available
 * (only on native platforms with SQLite)
 */
export function isOfflineSupported(): boolean {
  return isNativePlatform();
}

/**
 * Setup online/offline event listeners
 */
export function setupNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
