// Authentication Store
import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setUser: (user, token) => {
    // Store in localStorage for persistence
    localStorage.setItem('auth_token', token);
    localStorage.setItem('current_user', JSON.stringify(user));
    
    // Set cookie for API authentication
    document.cookie = `token=${token}; path=/; max-age=2592000; SameSite=Lax`;
    
    set({
      user,
      token,
      isAuthenticated: true,
      error: null,
    });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    
    // Clear cookie
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),

  checkAuth: () => {
    if (typeof window === 'undefined') return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const userStr = localStorage.getItem('current_user');
      
      console.log('checkAuth - Token:', token ? 'exists' : 'missing');
      console.log('checkAuth - User:', userStr ? 'exists' : 'missing');
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          
          // Restore cookie for API requests
          document.cookie = `token=${token}; path=/; max-age=2592000; SameSite=Lax`;
          console.log('checkAuth - Restored user and cookie');
          
          set({
            user,
            token,
            isAuthenticated: true,
          });
        } catch (parseError) {
          console.error('checkAuth - Failed to parse user:', parseError);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('current_user');
          set({ isAuthenticated: false });
        }
      } else {
        console.log('checkAuth - No auth data found');
        set({ isAuthenticated: false });
      }
    } catch (error) {
      console.error('checkAuth - Error:', error);
      set({ isAuthenticated: false });
    }
  },
}));
