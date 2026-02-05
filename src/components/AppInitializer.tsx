'use client';

import { useEffect } from 'react';

export function AppInitializer() {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const platform = Capacitor.getPlatform();
        
        // Only on native platforms
        if (platform === 'android' || platform === 'ios') {
          // Check if user is logged in
          const userStr = localStorage.getItem('current_user');
          if (!userStr) return;
          
          // Check if online
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          
          if (status.connected) {
            // Auto-sync on startup
            console.log('App initialized, starting auto-sync...');
            const { syncService } = await import('@/lib/syncService');
            
            // Wait a bit for the app to fully load
            setTimeout(async () => {
              try {
                await syncService.syncAll();
                console.log('Auto-sync on startup completed');
              } catch (error) {
                console.error('Auto-sync on startup failed:', error);
              }
            }, 2000);
          } else {
            console.log('App initialized offline - sync will happen when connection is restored');
          }
        }
      } catch (error) {
        console.error('App initialization failed:', error);
      }
    };
    
    initializeApp();
  }, []);
  
  return null; // This component doesn't render anything
}
