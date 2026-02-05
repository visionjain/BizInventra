'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setLoading, setError } = useAuthStore();
  
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);
    setLoading(true);

    try {
      // Check if running in Capacitor
      let isCapacitor = false;
      try {
        const { Capacitor } = await import('@capacitor/core');
        isCapacitor = Capacitor.isNativePlatform();
      } catch {}
      
      // Use production API for Capacitor, local API for web dev
      const apiUrl = isCapacitor 
        ? (process.env.NEXT_PUBLIC_API_URL || 'https://bizinventra.vercel.app')
        : (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'https://bizinventra.vercel.app'));
      
      console.log('Login attempt - isCapacitor:', isCapacitor, 'apiUrl:', apiUrl);
      
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ emailOrPhone, password }),
        mode: 'cors'
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (data.success) {
        setUser(data.user, data.token);
        
        // Redirect to dashboard
        window.location.href = '/';
      } else {
        setErrorMsg(data.error || 'Login failed');
        setError(data.error || 'Login failed');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(`Login failed: ${err.message}`);
      setError('Connection failed');
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center flex flex-col items-center">
          <img src="/logo.png" alt="Bizinventra" className="h-20 w-20 mb-4" />
          <img src="/titlelogo.png" alt="Bizinventra" className="h-12 mb-4" />
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          <div className="space-y-4">
            <Input
              label="Email or Phone Number"
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="Enter email or phone"
              required
              autoComplete="username"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
          >
            Sign In
          </Button>

          <div className="text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
