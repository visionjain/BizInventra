'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { Capacitor } from '@capacitor/core';

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
      const platform = Capacitor.getPlatform();
      const isNative = platform === 'android' || platform === 'ios';

      // Try online login first
      let onlineSuccess = false;
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailOrPhone, password }),
        });

        const data = await response.json();

        if (data.success) {
          setUser(data.user, data.token);
          
          // Store in SQLite for offline access (only on native)
          if (isNative) {
            await storeUserOffline(data.user, password);
          }
          
          // Small delay to ensure state is set before redirect
          setTimeout(() => {
            router.push('/');
          }, 100);
          onlineSuccess = true;
        } else {
          setErrorMsg(data.error || 'Login failed');
          setError(data.error || 'Login failed');
        }
      } catch (networkError) {
        console.log('Network error, trying offline login...', networkError);
        
        // If online fails and we're on native, try offline SQLite
        if (isNative) {
          const offlineUser = await loginOffline(emailOrPhone, password);
          
          if (offlineUser) {
            setUser(offlineUser.user, offlineUser.token);
            setTimeout(() => {
              router.push('/');
            }, 100);
            onlineSuccess = true;
          } else {
            setErrorMsg('Login failed. No internet and no offline data.');
            setError('No offline data available');
          }
        } else {
          setErrorMsg('Login failed. Please check your connection.');
          setError('Connection failed');
        }
      }

    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Login failed. Please try again.');
      setError('Login failed');
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

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Works offline after first login
          </p>
        </div>
      </div>
    </div>
  );
}

// Offline login helper (only works on native)
async function loginOffline(emailOrPhone: string, password: string) {
  try {
    const bcrypt = await import('bcryptjs');
    const { executeQuery } = await import('@/lib/db/sqlite');
    
    // Query user from SQLite
    const users = await executeQuery(
      `SELECT * FROM users WHERE email = ? OR phone_number = ?`,
      [emailOrPhone, emailOrPhone]
    );

    if (!users || users.length === 0) return null;

    const user = users[0] as any;

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) return null;

    // Generate a simple token (for offline use)
    const token = `offline_${user.id}_${Date.now()}`;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyName: user.company_name,
        phoneNumber: user.phone_number,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      },
      token,
    };
  } catch (error) {
    console.error('Offline login error:', error);
    return null;
  }
}

// Store user for offline access (only on native)
async function storeUserOffline(user: any, password: string) {
  try {
    const bcrypt = await import('bcryptjs');
    const { executeUpdate, executeQuery } = await import('@/lib/db/sqlite');
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if user exists
    const existing = await executeQuery(
      'SELECT id FROM users WHERE id = ?',
      [user.id]
    );

    if (!existing || existing.length === 0) {
      // Insert new user
      await executeUpdate(
        `INSERT INTO users (id, name, email, password_hash, company_name, phone_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.name,
          user.email,
          passwordHash,
          user.companyName,
          user.phoneNumber,
          user.createdAt.toISOString(),
          user.updatedAt.toISOString(),
        ]
      );
    } else {
      // Update existing user
      await executeUpdate(
        `UPDATE users SET name = ?, password_hash = ?, company_name = ?, phone_number = ?, updated_at = ?
         WHERE id = ?`,
        [user.name, passwordHash, user.companyName, user.phoneNumber, new Date().toISOString(), user.id]
      );
    }
    
    console.log('User stored offline successfully');
  } catch (error) {
    console.error('Error storing user offline:', error);
  }
}
