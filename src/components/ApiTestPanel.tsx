'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export function ApiTestPanel() {
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
    details?: any;
  }>({ status: 'idle', message: '' });
  const [isVisible, setIsVisible] = useState(false);

  const testApi = async () => {
    setTestResult({ status: 'testing', message: 'Testing API connection...' });
    
    try {
      // Check if we're on Capacitor
      let isNative = false;
      let Capacitor: any;
      try {
        const cap = await import('@capacitor/core');
        Capacitor = cap.Capacitor;
        isNative = Capacitor.isNativePlatform();
      } catch (e) {
        console.log('Not Capacitor');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://bizinventra.vercel.app';
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setTestResult({
          status: 'error',
          message: '❌ No auth token found!',
          details: 'You need to login first.'
        });
        return;
      }

      const testUrl = isNative ? `${apiUrl}/api/dashboard/stats` : '/api/dashboard/stats';
      
      console.log('Testing API:', testUrl);
      console.log('Is Native:', isNative);
      console.log('Token exists:', !!token);

      let response: any;
      
      if (isNative && Capacitor) {
        const { CapacitorHttp } = await import('@capacitor/core');
        response = await CapacitorHttp.get({
          url: testUrl,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (response.status === 200) {
          setTestResult({
            status: 'success',
            message: '✅ API working!',
            details: `Status: ${response.status}, Data: ${JSON.stringify(response.data).substring(0, 100)}...`
          });
        } else {
          setTestResult({
            status: 'error',
            message: `❌ API returned ${response.status}`,
            details: JSON.stringify(response.data)
          });
        }
      } else {
        const res = await fetch(testUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          setTestResult({
            status: 'success',
            message: '✅ API working!',
            details: `Status: ${res.status}, Data: ${JSON.stringify(data).substring(0, 100)}...`
          });
        } else {
          const text = await res.text();
          setTestResult({
            status: 'error',
            message: `❌ API returned ${res.status}`,
            details: text.substring(0, 200)
          });
        }
      }
    } catch (error: any) {
      console.error('API Test Error:', error);
      setTestResult({
        status: 'error',
        message: '❌ API request failed',
        details: error.message || error.toString()
      });
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-20 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
      >
        🔧 Test API
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border-2 border-blue-600 rounded-lg shadow-xl p-4 max-w-md" style={{ maxWidth: '90vw' }}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-gray-900">API Connection Test</h3>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <Button 
        onClick={testApi} 
        disabled={testResult.status === 'testing'}
        className="w-full mb-3 flex items-center justify-center gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${testResult.status === 'testing' ? 'animate-spin' : ''}`} />
        {testResult.status === 'testing' ? 'Testing...' : 'Run API Test'}
      </Button>

      {testResult.message && (
        <div className={`p-3 rounded-lg ${
          testResult.status === 'success' ? 'bg-green-50 border border-green-200' :
          testResult.status === 'error' ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-start gap-2">
            {testResult.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
            {testResult.status === 'error' && <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
            {testResult.status === 'testing' && <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 mb-1">{testResult.message}</p>
              {testResult.details && (
                <p className="text-xs text-gray-600 break-words">{testResult.details}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          This tests if your app can connect to the API server. If it fails, check your internet connection or try logging out and back in.
        </p>
      </div>
    </div>
  );
}
