'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';

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

  // Fetch items function (can be called from anywhere)
  const fetchItems = useCallback(async () => {
    try {
      setItemsLoading(true);
      const response = await fetch('/api/items', {
        cache: 'no-store', // Prevent caching
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched items:', data); // Debug log
        setFoodItems(data);
      } else {
        console.error('Failed to fetch items:', response.status);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  // Fetch charges and items from API
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

    fetchCharges();
    fetchItems();
    
    // Refresh items every 30 seconds to get new items
    const itemsInterval = setInterval(() => {
      fetchItems();
    }, 30000);
    
    // Refresh items when window regains focus (user comes back to tab)
    const handleFocus = () => {
      fetchItems();
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
    const filtered = foodItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSubCategory = selectedSubCategory === 'all' || item.subCategory.toLowerCase() === selectedSubCategory.toLowerCase();
      
      return matchesSearch && matchesCategory && matchesSubCategory;
    });
    console.log('Filtered items:', filtered, 'Total items:', foodItems.length); // Debug log
    return filtered;
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

  // Calculate subtotal
  const cartSubtotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [cart]);

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
                            <h3 className="text-lg font-semibold text-black mb-2">{item.name}</h3>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm text-black capitalize">{item.subCategory}</span>
                              <span className="text-xl font-bold text-sky-500">Rs {item.price.toFixed(2)}</span>
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
                          <h3 className="font-bold text-base text-black mb-1 truncate">{item.name}</h3>
                          <p className="text-xs text-gray-600">Rs {item.price.toFixed(2)} each</p>
                          <p className="text-sm font-semibold text-sky-500 mt-1">
                            Rs {(item.price * item.quantity).toFixed(2)}
                          </p>
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
                    onClick={() => {
                      // Validate all required fields
                      if (!orderType) {
                        alert('Please select an order type');
                        return;
                      }
                      if (!customerName.trim()) {
                        alert('Please enter your name');
                        return;
                      }
                      if (!contactNumber.trim()) {
                        alert('Please enter your contact number');
                        return;
                      }
                      if (orderType === 'delivery' && !deliveryAddress.trim()) {
                        alert('Please enter your delivery address');
                        return;
                      }
                      // Here you would typically send the order data to your backend
                      const chargesText = orderType === 'delivery' 
                        ? `\nDelivery Charge: Rs ${deliveryCharge.toFixed(2)}\nPacking Charge: Rs ${packingCharge.toFixed(2)}`
                        : orderType === 'takeaway' 
                        ? `\nPacking Charge: Rs ${packingCharge.toFixed(2)}`
                        : '';
                      alert(`Order placed successfully!\nOrder Type: ${orderType}\nName: ${customerName}\nContact: ${contactNumber}${orderType === 'delivery' ? `\nAddress: ${deliveryAddress}` : ''}\nSubtotal: Rs ${cartSubtotal.toFixed(2)}${chargesText}\nTotal: Rs ${cartTotal.toFixed(2)}`);
                      // Reset form and cart
                      setCart([]);
                      setOrderType('');
                      setCustomerName('');
                      setContactNumber('');
                      setDeliveryAddress('');
                      setShowCart(false);
                    }}
                    className="w-full bg-gradient-to-r from-sky-300 to-cyan-300 text-white py-3 rounded-xl hover:from-sky-400 hover:to-cyan-400 transition-all font-bold text-base shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    🛒 Proceed to Checkout
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
    </div>
  );
}
