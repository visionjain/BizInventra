import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export function useStatusBar() {
  useEffect(() => {
    if (Capacitor.getPlatform() === 'android') {
      const setStatusBar = async () => {
        try {
          // Set background color to black first
          await StatusBar.setBackgroundColor({ color: '#000000' });
          
          // Set style to Dark (light/white content on dark background)
          await StatusBar.setStyle({ style: Style.Dark });
          
          // Ensure it's not overlaying
          await StatusBar.setOverlaysWebView({ overlay: false });
          
          // Show the status bar
          await StatusBar.show();
          
          console.log('Status bar set to black with white icons');
        } catch (error) {
          console.error('Error setting status bar:', error);
        }
      };
      
      setStatusBar();
    }
  }, []);
}
