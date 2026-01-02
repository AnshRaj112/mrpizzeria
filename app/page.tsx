'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import html2canvas from 'html2canvas';
import Alert from '@/components/Alert';
import ConfirmDialog from '@/components/ConfirmDialog';

// Food item types
type Category = 'retail' | 'produce';
type SubCategory = string;

interface FoodItem {
  id: number;
  name: string;
  category: Category;
  subCategory: SubCategory;
  price: number;
  image: string;
  quantity?: number;
  lowStockThreshold?: number;
  isVisible?: boolean;
}

interface CartItem extends FoodItem {
  quantity: number;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | 'all'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [orderType, setOrderType] = useState<'takeaway' | 'dine-in' | 'delivery' | ''>('');
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState(5.00);
  const [packingCharge, setPackingCharge] = useState(2.00);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [orderReceipt, setOrderReceipt] = useState<any>(null);
  const [lastOrderStatus, setLastOrderStatus] = useState<string | null>(null);
  const [lastOrderContact, setLastOrderContact] = useState<string>('');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [upcomingDiscounts, setUpcomingDiscounts] = useState<any[]>([]);
  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'warning' | 'info' | 'success' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void; type?: 'danger' | 'warning' | 'info' } | null>(null);

  // Fetch items function (can be called from anywhere)
  const fetchItems = useCallback(async () => {
    try {
      setItemsLoading(true);
      const response = await fetch('/api/items?visibleOnly=true', {
        cache: 'no-store', // Prevent caching
      });
      if (response.ok) {
        const data = await response.json();
        // Filter out items that are explicitly hidden
        const visibleItems = data.filter((item: FoodItem) => item.isVisible !== false);
        setFoodItems(visibleItems);
      } else {
        console.error('Failed to fetch items:', response.status);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch current order status
  const fetchOrderStatus = useCallback(async () => {
    if (!lastOrderId && !lastOrderContact) return;
    
    try {
      const url = lastOrderId 
        ? `/api/orders/check-status?orderId=${encodeURIComponent(lastOrderId)}`
        : `/api/orders/check-status?contact=${encodeURIComponent(lastOrderContact)}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.order && data.order.status) {
          const currentStatus = data.order.status;
          console.log(`Fetched current status: ${currentStatus}`);
          setLastOrderStatus((prevStatus) => {
            if (prevStatus !== currentStatus) {
              return currentStatus;
            }
            return prevStatus;
          });
        }
      }
    } catch (error) {
      console.error('Error fetching order status:', error);
    }
  }, [lastOrderId, lastOrderContact]);

  // Real-time order status updates using Server-Sent Events
  useEffect(() => {
    if (!lastOrderId && !lastOrderContact) return;

    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let sseWorking = false;
    
    // Fetch initial status first
    fetchOrderStatus();

    try {
      // Create SSE connection - prefer orderId, fallback to contactNumber
      const url = lastOrderId 
        ? `/api/orders/notifications?orderId=${encodeURIComponent(lastOrderId)}`
        : `/api/orders/notifications?contact=${encodeURIComponent(lastOrderContact)}`;
      
      console.log(`Connecting to SSE: ${url}`);
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log('SSE connection opened');
        sseWorking = true;
        // Clear polling if SSE is working
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };

      eventSource.onmessage = (event) => {
        try {
          console.log('SSE message received:', event.data);
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            console.log('SSE connected:', data.message, 'subscriptionKey:', data.subscriptionKey);
            return;
          }
          
          if (data.type === 'status_update') {
            const currentStatus = data.status;
            console.log(`Status update received: ${currentStatus} for order ${data.dailyOrderId}`);
            
            // Always update status when we receive an update
            setLastOrderStatus(currentStatus);

            // Send browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              let title = '';
              let body = '';

              switch (currentStatus) {
                case 'being_prepared':
                  title = '🍳 Order Being Prepared';
                  body = `Order #${data.dailyOrderId} is now being prepared!`;
                  break;
                case 'prepared':
                  title = '✅ Order Prepared';
                  body = `Order #${data.dailyOrderId} is ready!`;
                  break;
                case 'ready_for_pickup':
                  title = '📦 Ready for Pickup';
                  body = `Order #${data.dailyOrderId} is ready for pickup!`;
                  break;
                case 'out_for_delivery':
                  title = '🚚 Out for Delivery';
                  body = `Order #${data.dailyOrderId} is out for delivery!`;
                  break;
                case 'delivered':
                  title = '🎉 Order Delivered';
                  body = `Order #${data.dailyOrderId} has been delivered! Thank you!`;
                  break;
                default:
                  return;
              }

              new Notification(title, {
                body,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
              });
            }

            // If delivered, close connection
            if (currentStatus === 'delivered') {
              eventSource?.close();
            }
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        console.error('EventSource readyState:', eventSource?.readyState);
        
        // If SSE fails, fallback to polling
        if (!sseWorking && !pollInterval) {
          console.log('SSE not working, falling back to polling');
          pollInterval = setInterval(() => {
            fetchOrderStatus();
          }, 5000); // Poll every 5 seconds
        }
      };

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      // Fallback to polling if SSE fails to initialize
      if (!pollInterval) {
        pollInterval = setInterval(() => {
          fetchOrderStatus();
        }, 5000);
      }
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [lastOrderId, lastOrderContact]);

  // Fetch charges, items, and discounts from API
  useEffect(() => {
    const fetchCharges = async () => {
      try {
        const response = await fetch('/api/charges');
        if (response.ok) {
          const data = await response.json();
          setDeliveryCharge(data.deliveryCharge || 5.00);
          setPackingCharge(data.packingCharge || 2.00);
        }
      } catch (error) {
        console.error('Error fetching charges:', error);
        // Keep default values if fetch fails
      }
    };

    const fetchDiscounts = async () => {
      try {
        // Fetch active discounts
        const activeResponse = await fetch('/api/discounts?activeOnly=true');
        if (activeResponse.ok) {
          const activeData = await activeResponse.json();
          setDiscounts(activeData || []);
        }
        
        // Fetch upcoming discounts
        const upcomingResponse = await fetch('/api/discounts?includeUpcoming=true');
        if (upcomingResponse.ok) {
          const allData = await upcomingResponse.json();
          const now = new Date();
          // Filter for upcoming discounts (startDate > now)
          const upcoming = allData.filter((discount: any) => {
            if (!discount.isActive) return false;
            const startDate = new Date(discount.startDate);
            return startDate > now;
          });
          setUpcomingDiscounts(upcoming || []);
        }
      } catch (error) {
        console.error('Error fetching discounts:', error);
      }
    };

    fetchCharges();
    fetchDiscounts();
    fetchItems();
    
    // Refresh items and discounts every 30 seconds to get new items
    const itemsInterval = setInterval(() => {
      fetchItems();
      fetchDiscounts();
    }, 30000);
    
    // Refresh items when window regains focus (user comes back to tab)
    const handleFocus = () => {
      fetchItems();
      fetchDiscounts();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(itemsInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchItems]);

  // Prevent body scrolling when cart is open
  useEffect(() => {
    if (showCart) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showCart]);

  // Filter and search food items
  const filteredItems = useMemo(() => {
    return foodItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSubCategory = selectedSubCategory === 'all' || item.subCategory.toLowerCase() === selectedSubCategory.toLowerCase();
      
      return matchesSearch && matchesCategory && matchesSubCategory;
    });
  }, [searchQuery, selectedCategory, selectedSubCategory, foodItems]);

  // Add item to cart
  const addToCart = (item: FoodItem) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  // Remove item from cart
  const removeFromCart = (id: number) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  // Update quantity
  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  // Get discounted price and discount info for an item
  const getDiscountedPrice = useCallback((item: FoodItem): { price: number; discountPercent: number; hasDiscount: boolean } => {
    const now = new Date();
    let finalPrice = item.price;
    let discountPercent = 0;
    let hasDiscount = false;

    // Find applicable discounts
    const applicableDiscounts = discounts.filter((discount) => {
      if (!discount.isActive) return false;
      const startDate = new Date(discount.startDate);
      const endDate = discount.endDate ? new Date(discount.endDate) : null;
      if (startDate > now || (endDate && endDate < now)) return false;
      
      if (discount.applyTo === 'all') return true;
      if (discount.applyTo === 'specific' && discount.productIds?.includes(item.id)) return true;
      return false;
    });

    // Apply the best discount (highest value)
    if (applicableDiscounts.length > 0) {
      let bestDiscount = applicableDiscounts[0];
      let bestDiscountValue = 0;

      applicableDiscounts.forEach((discount) => {
        let discountValue = 0;
        if (discount.discountType === 'percentage') {
          discountValue = (item.price * discount.discountValue) / 100;
        } else {
          discountValue = discount.discountValue;
        }
        if (discountValue > bestDiscountValue) {
          bestDiscountValue = discountValue;
          bestDiscount = discount;
        }
      });

      if (bestDiscount.discountType === 'percentage') {
        finalPrice = item.price - (item.price * bestDiscount.discountValue) / 100;
        discountPercent = bestDiscount.discountValue;
      } else {
        finalPrice = Math.max(0, item.price - bestDiscount.discountValue);
        // Calculate percentage for fixed discounts
        discountPercent = Math.round((bestDiscount.discountValue / item.price) * 100);
      }
      hasDiscount = finalPrice < item.price;
    }

    return {
      price: Math.max(0, parseFloat(finalPrice.toFixed(2))),
      discountPercent: Math.round(discountPercent),
      hasDiscount,
    };
  }, [discounts]);

  // Calculate subtotal with discounts
  const cartSubtotal = useMemo(() => {
    return cart.reduce((total, item) => {
      const discountInfo = getDiscountedPrice(item);
      return total + discountInfo.price * item.quantity;
    }, 0);
  }, [cart, getDiscountedPrice]);

  // Calculate total with charges
  const cartTotal = useMemo(() => {
    let total = cartSubtotal;
    if (orderType === 'delivery') {
      total += deliveryCharge + packingCharge;
    } else if (orderType === 'takeaway') {
      total += packingCharge;
    }
    return total;
  }, [cartSubtotal, orderType, deliveryCharge, packingCharge]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }, [cart]);

  // Show alert helper
  const showAlert = (message: string, type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setAlert({ message, type });
  };

  // Show confirm dialog helper
  const showConfirm = (message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'info') => {
    setConfirmDialog({ message, onConfirm, type });
  };

  // Handle Razorpay payment
  const handlePayment = async () => {
    // Validate all required fields
    if (!orderType) {
      showAlert('Please select an order type', 'warning');
      return;
    }
    if (!customerName.trim()) {
      showAlert('Please enter your name', 'warning');
      return;
    }
    if (!contactNumber.trim()) {
      showAlert('Please enter your contact number', 'warning');
      return;
    }
    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      showAlert('Please enter your delivery address', 'warning');
      return;
    }

    try {
      // Create Razorpay order
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: cartTotal,
          currency: 'INR',
          receipt: `order_${Date.now()}`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        showAlert(error.error || 'Failed to create payment order', 'error');
        return;
      }

      const { orderId } = await response.json();

      // Get Razorpay key from API
      const keyResponse = await fetch('/api/payment/get-key');
      if (!keyResponse.ok) {
        showAlert('Payment gateway configuration error. Please contact support.', 'error');
        return;
      }
      const { key } = await keyResponse.json();

      if (!key) {
        showAlert('Payment gateway configuration error. Please contact support.', 'error');
        return;
      }

      // Initialize Razorpay checkout
      const options = {
        key: key,
        amount: Math.round(cartTotal * 100), // Convert to paise
        currency: 'INR',
        name: 'Mr. Pizzeria',
        description: `Order for ${customerName}`,
        order_id: orderId,
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          // Payment successful
          try {
            const verifyResponse = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderData: {
                  orderType,
                  customerName,
                  contactNumber,
                  deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
                  items: cart,
                  subtotal: cartSubtotal,
                  deliveryCharge: orderType === 'delivery' ? deliveryCharge : 0,
                  packingCharge: orderType === 'delivery' || orderType === 'takeaway' ? packingCharge : 0,
                  total: cartTotal,
                },
              }),
            });

            if (verifyResponse.ok) {
              const result = await verifyResponse.json();
              
              // Show notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Order Placed Successfully! 🎉', {
                  body: `Order #${result.dailyOrderId} has been placed successfully. Total: Rs ${cartTotal.toFixed(2)}`,
                  icon: '/favicon.ico',
                  badge: '/favicon.ico',
                });
              } else if ('Notification' in window && Notification.permission !== 'denied') {
                Notification.requestPermission().then((permission) => {
                  if (permission === 'granted') {
                    new Notification('Order Placed Successfully! 🎉', {
                      body: `Order #${result.dailyOrderId} has been placed successfully. Total: Rs ${cartTotal.toFixed(2)}`,
                      icon: '/favicon.ico',
                      badge: '/favicon.ico',
                    });
                  }
                });
              }

              // Set receipt data
              setOrderReceipt({
                dailyOrderId: result.dailyOrderId,
                orderDate: result.orderDate,
                orderType,
                customerName,
                contactNumber,
                deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
                items: cart,
                subtotal: cartSubtotal,
                deliveryCharge: orderType === 'delivery' ? deliveryCharge : 0,
                packingCharge: orderType === 'delivery' || orderType === 'takeaway' ? packingCharge : 0,
                total: cartTotal,
                razorpayOrderId: result.razorpayOrderId,
                paymentId: result.paymentId,
              });

              // Track order for status updates
              setLastOrderStatus('pending');
              setLastOrderContact(contactNumber);
              setLastOrderId(result.orderId || null);

              // Close cart and show receipt
              setShowCart(false);
              setShowReceipt(true);
              
              // Reset form and cart
              setCart([]);
              setOrderType('');
              setCustomerName('');
              setContactNumber('');
              setDeliveryAddress('');
            } else {
              const error = await verifyResponse.json();
              showAlert('Payment verification failed: ' + (error.error || 'Unknown error'), 'error');
            }
          } catch (error) {
            console.error('Error verifying payment:', error);
            showAlert('Error verifying payment. Please contact support.', 'error');
          }
        },
        prefill: {
          name: customerName,
          contact: contactNumber,
          email: '',
        },
        theme: {
          color: '#0ea5e9', // Sky color
        },
        modal: {
          ondismiss: function() {
            console.log('Payment cancelled');
          },
        },
      };

      // Check if Razorpay is loaded
      if (typeof window !== 'undefined' && window.Razorpay) {
        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.failed', function (response: { error: { description?: string } }) {
          showAlert(`Payment failed: ${response.error?.description || 'Unknown error'}`, 'error');
        });
        razorpay.open();
      } else {
        showAlert('Payment gateway is loading. Please try again in a moment.', 'warning');
      }
    } catch (error) {
      console.error('Error initiating payment:', error);
      showAlert('Error initiating payment. Please try again.', 'error');
    }
  };

  // Get subcategories based on selected category (dynamic from items)
  const getSubCategories = (): SubCategory[] => {
    if (selectedCategory === 'all') return [];
    const subcats = foodItems
      .filter((item) => item.category === selectedCategory)
      .map((item) => item.subCategory);
    return Array.from(new Set(subcats)).sort();
  };

  // Group items by category and subcategory for section display
  const groupedItems = useMemo(() => {
    const groups: Record<Category, Record<string, FoodItem[]>> = {
      produce: {},
      retail: {},
    };

    filteredItems.forEach(item => {
      if (!groups[item.category][item.subCategory]) {
        groups[item.category][item.subCategory] = [];
      }
      groups[item.category][item.subCategory].push(item);
    });

    return groups;
  }, [filteredItems]);

  // Dynamic section order: Produce first, then Retail, with subcategories sorted
  const sectionOrder = useMemo(() => {
    const produceSubcats = foodItems
      .filter((item) => item.category === 'produce')
      .map((item) => item.subCategory);
    const retailSubcats = foodItems
      .filter((item) => item.category === 'retail')
      .map((item) => item.subCategory);

    const uniqueProduce = Array.from(new Set(produceSubcats)).sort();
    const uniqueRetail = Array.from(new Set(retailSubcats)).sort();

    const order: Array<{ category: Category; subCategory: SubCategory; label: string }> = [];

    // Add produce sections first
    uniqueProduce.forEach((subCat) => {
      order.push({
        category: 'produce',
        subCategory: subCat,
        label: subCat.charAt(0).toUpperCase() + subCat.slice(1),
      });
    });

    // Add retail sections second
    uniqueRetail.forEach((subCat) => {
      order.push({
        category: 'retail',
        subCategory: subCat,
        label: subCat.charAt(0).toUpperCase() + subCat.slice(1),
      });
    });

    return order;
  }, [foodItems]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-sky-400">🍕 Mr. Pizzeria</h1>
            <button
              onClick={() => setShowCart(true)}
              className="relative flex items-center gap-2 bg-sky-300 text-white px-6 py-2 rounded-full hover:bg-sky-400 transition-colors"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Cart
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-pink-300 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </button>
          </div>
        </div>
      </header>

      {/* Upcoming Discounts Banner */}
      {upcomingDiscounts.length > 0 && (
        <div className="bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 text-white py-4 shadow-lg">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.88A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
              <h2 className="text-xl font-bold">Upcoming Discounts</h2>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {upcomingDiscounts.map((discount) => {
                const startDate = new Date(discount.startDate);
                const daysUntil = Math.ceil((startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                const discountText = discount.discountType === 'percentage' 
                  ? `${discount.discountValue}% OFF`
                  : `Rs ${discount.discountValue} OFF`;
                
                return (
                  <div
                    key={discount._id}
                    className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 border-2 border-white/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{discountText}</div>
                        <div className="text-sm opacity-90">{discount.name}</div>
                      </div>
                      <div className="border-l-2 border-white/30 pl-3">
                        <div className="text-xs opacity-75">Starts in</div>
                        <div className="text-lg font-bold">
                          {daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                        </div>
                        <div className="text-xs opacity-75">
                          {startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <input
              type="text"
              placeholder="Search for food items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-6 py-4 pl-12 rounded-full border-2 border-sky-200 focus:border-sky-400 focus:outline-none text-lg placeholder:text-black"
            />
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-black"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-black">Filters</h2>
          <div className="flex flex-wrap gap-4">
            {/* Category Filter */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-black">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value as Category | 'all');
                  setSelectedSubCategory('all');
                }}
                className="px-4 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none bg-white text-black"
              >
                <option value="all">All Categories</option>
                <option value="retail">Retail</option>
                <option value="produce">Produce</option>
              </select>
            </div>

            {/* Subcategory Filter */}
            {selectedCategory !== 'all' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-black">Subcategory</label>
                <select
                  value={selectedSubCategory}
                  onChange={(e) => setSelectedSubCategory(e.target.value as SubCategory | 'all')}
                  className="px-4 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none bg-white text-black"
                >
                  <option value="all">All {selectedCategory === 'retail' ? 'Retail' : 'Produce'}</option>
                  {getSubCategories().map(subCat => (
                    <option key={subCat} value={subCat}>
                      {subCat.charAt(0).toUpperCase() + subCat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear Filters */}
            {(selectedCategory !== 'all' || selectedSubCategory !== 'all' || searchQuery) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedSubCategory('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Food Items by Sections */}
        <div className="mb-8">
          {itemsLoading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-black text-lg">Loading items...</p>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="space-y-12">
              {sectionOrder.map(({ category, subCategory, label }) => {
                const categoryGroup = groupedItems[category];
                const items = categoryGroup[subCategory] || [];
                if (!items || items.length === 0) return null;

                return (
                  <div key={`${category}-${subCategory}`} className="mb-8">
                    <div className="mb-6">
                      <h2 className="text-3xl font-bold text-black capitalize mb-2">
                        {label}
                      </h2>
                      <div className="h-1 w-24 bg-sky-300 rounded-full"></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                        >
                          <div className="relative h-48 w-full">
            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-lg font-semibold text-black flex-1">{item.name}</h3>
                              <div className="flex items-center gap-1 ml-2">
                                {(() => {
                                  const discountInfo = getDiscountedPrice(item);
                                  if (discountInfo.hasDiscount) {
                                    return (
                                      <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
                                        -{discountInfo.discountPercent}%
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                                {(() => {
                                  // Show limited stock badge for retail items with low quantity
                                  if (item.category === 'retail' && item.quantity !== undefined && item.lowStockThreshold !== undefined) {
                                    const isLowStock = item.quantity <= item.lowStockThreshold;
                                    if (isLowStock && item.quantity > 0) {
                                      return (
                                        <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
                                          ⚠️ Limited Stock
                                        </span>
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm text-black capitalize">{item.subCategory}</span>
                              <div className="flex flex-col items-end">
                                {(() => {
                                  const discountInfo = getDiscountedPrice(item);
                                  return (
                                    <>
                                      {discountInfo.hasDiscount ? (
                                        <>
                                          <span className="text-sm text-gray-400 line-through">Rs {item.price.toFixed(2)}</span>
                                          <span className="text-xl font-bold text-green-600">Rs {discountInfo.price.toFixed(2)}</span>
                                        </>
                                      ) : (
                                        <span className="text-xl font-bold text-sky-500">Rs {item.price.toFixed(2)}</span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            {(() => {
                              const cartItem = cart.find(cartItem => cartItem.id === item.id);
                              const quantity = cartItem?.quantity || 0;
                              
                              if (quantity > 0) {
                                return (
                                  <div className="flex items-center justify-center gap-3">
                                    <button
                                      onClick={() => updateQuantity(item.id, quantity - 1)}
                                      className="w-10 h-10 rounded-full bg-red-300 hover:bg-red-400 flex items-center justify-center text-white font-bold text-lg"
                                    >
                                      −
                                    </button>
                                    <span className="text-lg font-semibold text-black min-w-[2rem] text-center">
                                      {quantity} 
                                    </span>
                                    <button
                                      onClick={() => updateQuantity(item.id, quantity + 1)}
                                      className="w-10 h-10 rounded-full bg-green-300 hover:bg-green-400 flex items-center justify-center text-white font-bold text-lg"
                                    >
                                      +
                                    </button>
                                  </div>
                                );
                              }
                              
                              return (
                                <button
                                  onClick={() => addToCart(item)}
                                  className="w-full bg-sky-300 text-white py-2 rounded-lg hover:bg-sky-400 transition-colors font-medium"
                                >
                                  Add to Cart
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-2xl font-semibold text-black">No items found</p>
              <p className="text-black mt-2">Try adjusting your filters or search query</p>
            </div>
          )}
        </div>
      </main>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-gray-300 bg-opacity-30 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b-2 border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
              <h2 className="text-3xl font-bold text-black">Your Cart</h2>
              <button
                onClick={() => setShowCart(false)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-black text-2xl font-light transition-colors"
                aria-label="Close cart"
              >
                ×
              </button>
            </div>
            
            {/* Two Column Layout */}
            {cart.length > 0 ? (
              <div className="flex-1 overflow-hidden flex">
                {/* Left Side - Cart Items */}
                <div className="flex-1 overflow-y-auto p-6 border-r-2 border-sky-100">
                  <h3 className="text-xl font-bold text-black mb-4">Items ({cart.length})</h3>
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-white border-2 border-sky-100 rounded-xl hover:border-sky-200 hover:shadow-md transition-all">
                        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden shadow-sm">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-base text-black truncate">{item.name}</h3>
                            {(() => {
                              const discountInfo = getDiscountedPrice(item);
                              if (discountInfo.hasDiscount) {
                                return (
                                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded whitespace-nowrap">
                                    -{discountInfo.discountPercent}%
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          {(() => {
                            const discountInfo = getDiscountedPrice(item);
                            return (
                              <>
                                {discountInfo.hasDiscount ? (
                                  <>
                                    <p className="text-xs text-gray-400 line-through">Rs {item.price.toFixed(2)} each</p>
                                    <p className="text-xs text-green-600 font-semibold">Rs {discountInfo.price.toFixed(2)} each</p>
                                  </>
                                ) : (
                                  <p className="text-xs text-gray-600">Rs {item.price.toFixed(2)} each</p>
                                )}
                                <p className="text-sm font-semibold text-sky-500 mt-1">
                                  Rs {(discountInfo.price * item.quantity).toFixed(2)}
                                </p>
                              </>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-full bg-red-300 hover:bg-red-400 flex items-center justify-center text-white font-bold transition-colors shadow-sm"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-bold text-black">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 rounded-full bg-green-300 hover:bg-green-400 flex items-center justify-center text-white font-bold transition-colors shadow-sm"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-600 rounded-lg text-xs font-semibold transition-colors"
                          aria-label="Remove item"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Side - Order Details */}
                <div className="w-96 overflow-y-auto p-6 bg-gradient-to-br from-gray-50 to-sky-50">
                  {/* Order Type Selection */}
                  <div className="mb-6">
                    <label className="block text-base font-bold text-black mb-3">
                      Order Type <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setOrderType('takeaway')}
                        className={`w-full px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm ${
                          orderType === 'takeaway'
                            ? 'border-sky-400 bg-sky-200 text-black shadow-md'
                            : 'border-sky-200 bg-white text-black hover:border-sky-300 hover:bg-sky-50 hover:shadow-sm'
                        }`}
                      >
                        🥡 Takeaway
                      </button>
                      <button
                        onClick={() => setOrderType('dine-in')}
                        className={`w-full px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm ${
                          orderType === 'dine-in'
                            ? 'border-sky-400 bg-sky-200 text-black shadow-md'
                            : 'border-sky-200 bg-white text-black hover:border-sky-300 hover:bg-sky-50 hover:shadow-sm'
                        }`}
                      >
                        🍽️ Dine In
                      </button>
                      <button
                        onClick={() => setOrderType('delivery')}
                        className={`w-full px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm ${
                          orderType === 'delivery'
                            ? 'border-sky-400 bg-sky-200 text-black shadow-md'
                            : 'border-sky-200 bg-white text-black hover:border-sky-300 hover:bg-sky-50 hover:shadow-sm'
                        }`}
                      >
                        🚚 Delivery
                      </button>
                    </div>
                  </div>

                  {/* Customer Information */}
                  {orderType && (
                    <div className="mb-6 p-4 bg-white rounded-xl border-2 border-sky-100 shadow-sm">
                      <h3 className="text-base font-bold text-black mb-3">Customer Information</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1.5">
                            Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Enter your full name"
                            required
                            className="w-full px-3 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white text-black placeholder:text-gray-400 text-sm transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1.5">
                            Contact Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={contactNumber}
                            onChange={(e) => setContactNumber(e.target.value)}
                            placeholder="Enter your contact number"
                            required
                            className="w-full px-3 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white text-black placeholder:text-gray-400 text-sm transition-all"
                          />
                        </div>
                        {orderType === 'delivery' && (
                          <div>
                            <label className="block text-xs font-semibold text-black mb-1.5">
                              Delivery Address <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              placeholder="Enter your complete delivery address"
                              required
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white text-black placeholder:text-gray-400 text-sm resize-none transition-all"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Price Breakdown */}
                  <div className="mb-4 p-4 bg-white rounded-xl border-2 border-sky-200 shadow-sm">
                    <h3 className="text-base font-bold text-black mb-3">Price Breakdown</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-black">
                        <span>Subtotal:</span>
                        <span className="font-semibold">Rs {cartSubtotal.toFixed(2)}</span>
                      </div>
                      {orderType === 'delivery' && (
                        <>
                          <div className="flex justify-between text-black">
                            <span>Delivery Charge:</span>
                            <span className="font-semibold">Rs {deliveryCharge.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-black">
                            <span>Packing Charge:</span>
                            <span className="font-semibold">Rs {packingCharge.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      {orderType === 'takeaway' && (
                        <div className="flex justify-between text-black">
                          <span>Packing Charge:</span>
                          <span className="font-semibold">Rs {packingCharge.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t-2 border-sky-200 pt-2 mt-2">
                        <div className="flex justify-between text-black">
                          <span className="font-bold text-lg">Total:</span>
                          <span className="font-bold text-xl text-sky-500">Rs {cartTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button
                    onClick={handlePayment}
                    className="w-full bg-gradient-to-r from-sky-300 to-cyan-300 text-white py-3 rounded-xl hover:from-sky-400 hover:to-cyan-400 transition-all font-bold text-base shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    💳 Pay with Razorpay
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="text-center py-16">
                  <div className="w-32 h-32 mx-auto mb-6 bg-sky-100 rounded-full flex items-center justify-center">
                    <svg className="w-16 h-16 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-xl font-semibold text-black mb-2">Your cart is empty</p>
                  <p className="text-gray-600">Add some delicious items to get started!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && orderReceipt && (
        <div className="fixed inset-0 bg-gray-300 bg-opacity-30 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" id="receipt">
            {/* Receipt Header */}
            <div className="p-6 border-b-2 border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-black">🍕 Mr. Pizzeria</h2>
                  <p className="text-sm text-gray-600">Order Receipt</p>
                </div>
                <button
                  onClick={() => setShowReceipt(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-black text-2xl font-light transition-colors"
                >
                  ×
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Order #</span>
                  <span className="font-bold text-black ml-1">{orderReceipt.dailyOrderId}</span>
                </div>
                <div>
                  <span className="text-gray-600">Date:</span>
                  <span className="font-semibold text-black ml-1">
                    {new Date(orderReceipt.orderDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              {/* Order Status Indicator */}
              {lastOrderStatus && lastOrderStatus !== 'pending' && (
                <div className="mt-4 p-3 bg-white rounded-lg border-2 border-sky-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      lastOrderStatus === 'being_prepared' ? 'bg-blue-400 animate-pulse' :
                      lastOrderStatus === 'prepared' ? 'bg-green-400' :
                      lastOrderStatus === 'ready_for_pickup' ? 'bg-cyan-400' :
                      lastOrderStatus === 'out_for_delivery' ? 'bg-purple-400 animate-pulse' :
                      lastOrderStatus === 'delivered' ? 'bg-green-500' :
                      'bg-gray-400'
                    }`}></div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600">Order Status</p>
                      <p className="font-bold text-black">
                        {lastOrderStatus === 'being_prepared' ? '🍳 Being Prepared' :
                         lastOrderStatus === 'prepared' ? '✅ Prepared' :
                         lastOrderStatus === 'ready_for_pickup' ? '📦 Ready for Pickup' :
                         lastOrderStatus === 'out_for_delivery' ? '🚚 Out for Delivery' :
                         lastOrderStatus === 'delivered' ? '🎉 Delivered' :
                         lastOrderStatus}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {lastOrderStatus === 'delivered' 
                      ? 'Your order has been delivered. Thank you!' 
                      : 'You will receive notifications when your order status updates.'}
                  </p>
                </div>
              )}
            </div>

            {/* Receipt Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Customer Info */}
              <div className="mb-6">
                <h3 className="font-bold text-black mb-2">Customer Details</h3>
                <div className="bg-grey-50 rounded-lg p-4 space-y-1 text-black">
                  <p><span className="font-semibold">Name:</span> {orderReceipt.customerName}</p>
                  <p><span className="font-semibold">Contact:</span> {orderReceipt.contactNumber}</p>
                  <p><span className="font-semibold">Order Type:</span> <span className="capitalize">{orderReceipt.orderType}</span></p>
                  {orderReceipt.deliveryAddress && (
                    <p><span className="font-semibold">Address:</span> {orderReceipt.deliveryAddress}</p>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="mb-6">
                <h3 className="font-bold text-black mb-3">Order Items</h3>
                <div className="space-y-2">
                  {orderReceipt.items.map((item: CartItem) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold text-black">{item.name}</p>
                        <p className="text-xs text-gray-600">Qty: {item.quantity} × Rs {item.price.toFixed(2)}</p>
                      </div>
                      <p className="font-bold text-sky-500">Rs {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="border-t-2 border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-black">
                  <span>Subtotal:</span>
                  <span className="font-semibold">Rs {orderReceipt.subtotal.toFixed(2)}</span>
                </div>
                {orderReceipt.deliveryCharge > 0 && (
                  <div className="flex justify-between text-black">
                    <span>Delivery Charge:</span>
                    <span className="font-semibold">Rs {orderReceipt.deliveryCharge.toFixed(2)}</span>
                  </div>
                )}
                {orderReceipt.packingCharge > 0 && (
                  <div className="flex justify-between text-black">
                    <span>Packing Charge:</span>
                    <span className="font-semibold">Rs {orderReceipt.packingCharge.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t-2 border-sky-200 pt-2 mt-2">
                  <div className="flex justify-between text-black">
                    <span className="font-bold text-lg">Total:</span>
                    <span className="font-bold text-xl text-sky-500">Rs {orderReceipt.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="mt-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                <p className="text-sm text-green-800">
                  <span className="font-semibold">✓ Payment Successful</span>
                </p>
              </div>
            </div>

            {/* Receipt Actions */}
            <div className="border-t-2 border-sky-100 p-6 bg-gray-50 no-print">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 bg-sky-300 text-white py-3 rounded-xl hover:bg-sky-400 transition-colors font-semibold"
                >
                  🖨️ Print / Save
                </button>
                <button
                  onClick={async () => {
                    const receiptElement = document.getElementById('receipt');
                    if (receiptElement) {
                      try {
                        const canvas = await html2canvas(receiptElement, {
                          backgroundColor: '#ffffff',
                          scale: 2,
                        });
                        const link = document.createElement('a');
                        link.download = `receipt-order-${orderReceipt.dailyOrderId}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                      } catch (error) {
                        console.error('Error creating screenshot:', error);
                        showAlert('Error creating screenshot. Please try the print option.', 'error');
                      }
                    }
                  }}
                  className="flex-1 bg-cyan-300 text-white py-3 rounded-xl hover:bg-cyan-400 transition-colors font-semibold"
                >
                  📸 Screenshot
                </button>
                <button
                  onClick={() => setShowReceipt(false)}
                  className="px-6 py-3 bg-gray-200 text-black rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert */}
      {alert && (
        <Alert
          message={alert.message}
          type={alert.type}
          onClose={() => setAlert(null)}
        />
      )}

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
