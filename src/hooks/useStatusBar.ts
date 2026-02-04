import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export function useStatusBar() {
  useEffect(() => {
    if (Capacitor.getPlatform() === 'android') {
      const setStatusBar = async () => {
        try {
          // Set background color to black
          await StatusBar.setBackgroundColor({ color: '#000000' });
          
          // Set style to Dark (light/white icons on dark background)
          await StatusBar.setStyle({ style: Style.Dark });
          
          // Show the status bar
          await StatusBar.show();
          
          console.log('Status bar configured: black bg, white icons');
        } catch (error) {
          console.error('StatusBar error:', error);
        }
      };
      
      // Set immediately and also after a slight delay to override any other settings
      setStatusBar();
      setTimeout(setStatusBar, 100);
      setTimeout(setStatusBar, 500);
    }
  }, []);
}
