'use client';

import { useState, useEffect } from 'react';

interface Order {
  _id: string;
  dailyOrderId: number;
  status: string;
  createdAt: string;
}

export default function OrderDisplayPage() {
  const [nowPreparing, setNowPreparing] = useState<Order[]>([]);
  const [prepared, setPrepared] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const fetchOrders = async () => {
    try {
      // Fetch orders that are being prepared
      const preparingResponse = await fetch('/api/orders?status=being_prepared');
      const preparingData = await preparingResponse.json();
      
      // Fetch orders that are prepared
      const preparedResponse = await fetch('/api/orders?status=prepared');
      const preparedData = await preparedResponse.json();

      // Also include ready_for_pickup as prepared
      const readyResponse = await fetch('/api/orders?status=ready_for_pickup');
      const readyData = await readyResponse.json();

      setNowPreparing(preparingData || []);
      setPrepared([...(preparedData || []), ...(readyData || [])]);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 3 seconds
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-sky-50 to-cyan-50 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-black text-xl font-semibold">Loading order display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-sky-50 to-cyan-50 overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col p-4 lg:p-6 max-w-7xl mx-auto w-full">
        {/* Professional Header */}
        <div className="bg-white rounded-2xl shadow-xl p-4 lg:p-6 mb-4 lg:mb-6 border-2 border-sky-200 flex-shrink-0">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-black mb-1">
                Order Status Display
              </h1>
              <p className="text-black text-sm lg:text-base">
                Real-time order tracking system
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl lg:text-2xl font-bold text-black mb-1">
                {currentTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true 
                })}
              </div>
              <div className="text-black text-xs lg:text-sm">
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Orders Grid - Takes remaining space */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 min-h-0 overflow-hidden">
          {/* Now Preparing Section */}
          <div className="bg-white rounded-2xl shadow-xl p-4 lg:p-6 border-2 border-sky-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-sky-100 flex-shrink-0">
              <div>
                <h2 className="text-xl lg:text-3xl font-bold text-black mb-1">
                  Now Preparing
                </h2>
                <p className="text-black text-xs lg:text-sm">
                  Orders in kitchen
                </p>
              </div>
              <div className="bg-sky-100 px-3 py-1.5 rounded-full border-2 border-sky-300">
                <span className="text-sky-600 font-bold text-lg lg:text-xl">
                  {nowPreparing.length}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {nowPreparing.length === 0 ? (
                <div className="text-center py-8 lg:py-12 h-full flex flex-col items-center justify-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-sky-100 mb-3">
                    <svg className="w-8 h-8 lg:w-10 lg:h-10 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-black text-base lg:text-lg font-semibold">
                    No orders being prepared
                  </p>
                  <p className="text-black text-xs lg:text-sm mt-1">
                    Waiting for new orders...
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
                  {nowPreparing
                    .sort((a, b) => a.dailyOrderId - b.dailyOrderId)
                    .map((order) => (
                      <div
                        key={order._id}
                        className="bg-gradient-to-br from-sky-400 to-cyan-400 rounded-xl p-3 lg:p-4 text-center shadow-lg border-2 border-sky-300 transform transition-all duration-300 hover:scale-105"
                      >
                        <div className="text-3xl lg:text-5xl font-bold text-white mb-1">
                          {order.dailyOrderId}
                        </div>
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                          <span className="text-white text-xs font-semibold uppercase">
                            Preparing
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Prepared Section */}
          <div className="bg-white rounded-2xl shadow-xl p-4 lg:p-6 border-2 border-sky-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-sky-100 flex-shrink-0">
              <div>
                <h2 className="text-xl lg:text-3xl font-bold text-black mb-1">
                  Ready for Pickup
                </h2>
                <p className="text-black text-xs lg:text-sm">
                  Orders ready now
                </p>
              </div>
              <div className="bg-green-100 px-3 py-1.5 rounded-full border-2 border-green-300">
                <span className="text-green-600 font-bold text-lg lg:text-xl">
                  {prepared.length}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {prepared.length === 0 ? (
                <div className="text-center py-8 lg:py-12 h-full flex flex-col items-center justify-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-green-100 mb-3">
                    <svg className="w-8 h-8 lg:w-10 lg:h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-black text-base lg:text-lg font-semibold">
                    No orders ready yet
                  </p>
                  <p className="text-black text-xs lg:text-sm mt-1">
                    Orders will appear here when ready
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
                  {prepared
                    .sort((a, b) => a.dailyOrderId - b.dailyOrderId)
                    .map((order) => (
                      <div
                        key={order._id}
                        className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 lg:p-4 text-center shadow-lg border-2 border-green-400 transform transition-all duration-300 hover:scale-105 relative overflow-hidden"
                      >
                        <div className="absolute top-1.5 right-1.5">
                          <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                          <div className="w-2 h-2 bg-white rounded-full absolute top-0 right-0"></div>
                        </div>
                        <div className="text-3xl lg:text-5xl font-bold text-white mb-1">
                          {order.dailyOrderId}
                        </div>
                        <div className="flex items-center justify-center gap-1.5">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-white text-xs font-semibold uppercase">
                            Ready
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

