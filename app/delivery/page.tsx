'use client';

import { useState, useEffect } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuth } from '@/lib/useAuth';

export default function DeliveryPage() {
  const { user, loading: authLoading, logout } = useAuth('delivery');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void; type?: 'danger' | 'warning' | 'info' } | null>(null);

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders?status=out_for_delivery');
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsDelivered = async (orderId: string) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId, status: 'delivered' }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Order marked as delivered!' });
        fetchOrders();
        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to update order status' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      setMessage({ type: 'error', text: 'Error updating order status' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-black text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useAuth
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-black mb-2">🚚 Delivery Dashboard</h1>
              <p className="text-gray-600">Orders ready for delivery</p>
              {user && (
                <p className="text-sm text-gray-500 mt-1">
                  Logged in as: {user.contactNumber}
                </p>
              )}
            </div>
            {user && (
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
              >
                Logout
              </button>
            )}
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800 border-2 border-green-300'
                  : 'bg-red-100 text-red-800 border-2 border-red-300'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Orders List */}
          <div className="bg-white rounded-xl border-2 border-sky-100 p-6 shadow-sm">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-gray-200">
                <p className="text-gray-600 text-lg">No orders ready for delivery at the moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order._id}
                    className="bg-gradient-to-r from-purple-50 to-cyan-50 rounded-xl border-2 border-purple-200 p-6 hover:border-purple-300 transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-black">
                            Order #{order.dailyOrderId}
                          </h3>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                            Out for Delivery
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <p className="text-sm font-semibold text-black mb-2">Customer Details</p>
                        <p className="text-sm text-black mb-1">
                          <span className="font-semibold">Name:</span> {order.customerName}
                        </p>
                        <p className="text-sm text-black mb-1">
                          <span className="font-semibold">Contact:</span> {order.contactNumber}
                        </p>
                        <p className="text-sm text-black">
                          <span className="font-semibold">Address:</span> {order.deliveryAddress}
                        </p>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <p className="text-sm font-semibold text-black mb-2">Order Items</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm text-black">
                              <span>{item.name} × {item.quantity}</span>
                              <span className="font-semibold">Rs {(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                          <span className="text-sm font-semibold text-black">Total:</span>
                          <span className="text-lg font-bold text-purple-600">Rs {order.total?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setConfirmDialog({
                          message: `Mark Order #${order.dailyOrderId} as delivered?`,
                          type: 'info',
                          onConfirm: () => {
                            markAsDelivered(order._id);
                          },
                        });
                      }}
                      className="w-full px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold text-lg shadow-md"
                    >
                      ✓ Mark as Delivered
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-8 pt-6 border-t-2 border-gray-200">
            <a
              href="/"
              className="text-sky-500 hover:text-sky-600 font-semibold"
            >
              ← Back to Store
            </a>
          </div>
        </div>
      </div>

      {/* Custom Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          title="Confirm Action"
          confirmText="Confirm"
          cancelText="Cancel"
          type={confirmDialog.type}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

