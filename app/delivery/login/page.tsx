'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@/components/Alert';

export default function DeliveryLoginPage() {
  const [contactNumber, setContactNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'warning' | 'info' | 'success' } | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.user && data.user.role === 'delivery') {
          router.push('/delivery');
        }
      }
    } catch (error) {
      // Not authenticated, stay on login page
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    if (!contactNumber || !password) {
      setAlert({ message: 'Please fill in all fields', type: 'error' });
      setLoading(false);
      return;
    }

    // Validate contact number
    const contactRegex = /^[0-9]{10}$/;
    if (!contactRegex.test(contactNumber)) {
      setAlert({ message: 'Contact number must be 10 digits', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/delivery/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contactNumber, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setAlert({ 
          message: 'Login successful! Redirecting...', 
          type: 'success' 
        });
        setTimeout(() => {
          router.push('/delivery');
        }, 1000);
      } else {
        setAlert({ message: data.error || 'An error occurred', type: 'error' });
        setLoading(false);
      }
    } catch (error) {
      console.error('Error:', error);
      setAlert({ message: 'Network error. Please try again.', type: 'error' });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-sky-400 mb-2">🍕 Mr. Pizzeria</h1>
          <h2 className="text-2xl font-semibold text-black">Delivery Login</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Contact Number
            </label>
            <input
              type="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter 10-digit contact number"
              required
              maxLength={10}
              className="w-full px-4 py-3 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white text-black placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="w-full px-4 py-3 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white text-black placeholder:text-gray-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-sky-300 to-cyan-300 text-white py-3 rounded-xl hover:from-sky-400 hover:to-cyan-400 transition-all font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Login'}
          </button>
        </form>

        {alert && (
          <div className="mt-4">
            <Alert
              message={alert.message}
              type={alert.type}
              onClose={() => setAlert(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

