'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  userId: string;
  contactNumber: string;
  role: 'admin' | 'delivery';
}

export function useAuth(requiredRole?: 'admin' | 'delivery') {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          // If role is required, check it
          if (requiredRole && data.user.role !== requiredRole) {
            // Wrong role, redirect to appropriate login
            router.push(`/${requiredRole}/login`);
            return;
          }
          setUser(data.user);
        } else {
          // Not authenticated
          if (requiredRole) {
            router.push(`/${requiredRole}/login`);
          }
        }
      } else {
        // Not authenticated
        if (requiredRole) {
          router.push(`/${requiredRole}/login`);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      if (requiredRole) {
        router.push(`/${requiredRole}/login`);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return { user, loading, logout, checkAuth };
}

