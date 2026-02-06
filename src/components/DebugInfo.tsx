'use client';

import { useState, useEffect } from 'react';

interface DebugInfoProps {
  isVisible?: boolean;
}

export function DebugInfo({ isVisible = false }: DebugInfoProps) {
  const [debugData, setDebugData] = useState({
    hasAuthToken: false,
    apiUrl: '',
    isNative: false,
    platform: '',
    isOnline: false
  });
  const [show, setShow] = useState(isVisible);

  useEffect(() => {
    const checkDebugInfo = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const platform = Capacitor.getPlatform();
        const isNative = platform === 'android' || platform === 'ios';
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://bizinventra.vercel.app';
        const hasAuthToken = !!localStorage.getItem('auth_token');
        
        let isOnline = navigator.onLine;
        if (isNative) {
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          isOnline = status.connected;
        }

        setDebugData({
          hasAuthToken,
          apiUrl,
          isNative,
          platform,
          isOnline
        });
      } catch (error) {
        console.error('Debug info error:', error);
      }
    };

    checkDebugInfo();
    const interval = setInterval(checkDebugInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-full shadow-lg text-xs"
        style={{ fontSize: '10px' }}
      >
        🐛
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white p-3 rounded-lg shadow-xl max-w-xs text-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Debug Info</h3>
        <button 
          onClick={() => setShow(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-400">Auth Token:</span>
          <span className={debugData.hasAuthToken ? 'text-green-400' : 'text-red-400'}>
            {debugData.hasAuthToken ? '✓ Present' : '✗ Missing'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Platform:</span>
          <span>{debugData.platform}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Native:</span>
          <span>{debugData.isNative ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Online:</span>
          <span className={debugData.isOnline ? 'text-green-400' : 'text-red-400'}>
            {debugData.isOnline ? '✓ Yes' : '✗ No'}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-700">
          <span className="text-gray-400">API URL:</span>
          <div className="text-xs break-all mt-1">{debugData.apiUrl}</div>
        </div>
      </div>
    </div>
  );
}
