'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Charges {
  deliveryCharge: number;
  packingCharge: number;
}

interface FoodItem {
  id: number;
  name: string;
  category: 'retail' | 'produce';
  subCategory: string;
  price: number;
  image: string;
}

type Tab = 'charges' | 'items';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('charges');
  const [charges, setCharges] = useState<Charges>({
    deliveryCharge: 5.00,
    packingCharge: 2.00,
  });
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Item form state
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'retail' as 'retail' | 'produce',
    subCategory: '',
    price: '',
    image: '',
  });
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [showSubcategorySuggestions, setShowSubcategorySuggestions] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchCharges();
    fetchItems();
  }, []);

  const fetchCharges = async () => {
    try {
      const response = await fetch('/api/charges');
      if (response.ok) {
        const data = await response.json();
        setCharges(data);
      }
    } catch (error) {
      console.error('Error fetching charges:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/items');
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const handleChargesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/charges', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(charges),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Charges updated successfully!' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to update charges' });
      }
    } catch (error) {
      console.error('Error updating charges:', error);
      setMessage({ type: 'error', text: 'Error updating charges' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Charges, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setCharges((prev) => ({
        ...prev,
        [field]: numValue,
      }));
    }
  };

  const handleItemFormChange = (field: string, value: string) => {
    setItemForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (field === 'image') {
      setImagePreview(value);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
      return;
    }

    setUploadingImage(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setItemForm((prev) => ({
          ...prev,
          image: data.url,
        }));
        setImagePreview(data.url);
        setMessage({ type: 'success', text: 'Image uploaded successfully!' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to upload image' });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setMessage({ type: 'error', text: 'Error uploading image' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const itemData = {
        ...itemForm,
        price: parseFloat(itemForm.price),
      };

      const url = editingItem ? '/api/items' : '/api/items';
      const method = editingItem ? 'PUT' : 'POST';
      const body = editingItem ? { id: editingItem.id, ...itemData } : itemData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setMessage({
          type: 'success',
          text: editingItem ? 'Item updated successfully!' : 'Item added successfully!',
        });
        resetItemForm();
        fetchItems();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save item' });
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setMessage({ type: 'error', text: 'Error saving item' });
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = (item: FoodItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      category: item.category,
      subCategory: item.subCategory,
      price: item.price.toString(),
      image: item.image,
    });
    setImagePreview(item.image);
    setImageMode('url');
    setActiveTab('items');
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      const response = await fetch(`/api/items?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Item deleted successfully!' });
        fetchItems();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to delete item' });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      setMessage({ type: 'error', text: 'Error deleting item' });
    }
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      category: 'retail',
      subCategory: '',
      price: '',
      image: '',
    });
    setEditingItem(null);
    setImagePreview('');
    setImageMode('url');
  };

  // Get unique subcategories for each category
  const getSubCategories = (category: 'retail' | 'produce'): string[] => {
    const subcats = items
      .filter((item) => item.category === category)
      .map((item) => item.subCategory);
    return Array.from(new Set(subcats)).sort();
  };

  // Get filtered subcategory suggestions based on input
  const getSubcategorySuggestions = (): string[] => {
    const existingSubcats = getSubCategories(itemForm.category);
    if (!itemForm.subCategory.trim()) {
      return existingSubcats;
    }
    return existingSubcats.filter((subcat) =>
      subcat.toLowerCase().includes(itemForm.subCategory.toLowerCase())
    );
  };

  const handleSubcategorySelect = (subcategory: string) => {
    setItemForm((prev) => ({
      ...prev,
      subCategory: subcategory,
    }));
    setShowSubcategorySuggestions(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-black text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-black mb-2">Admin Panel</h1>
            <p className="text-gray-600">Manage charges and items</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b-2 border-gray-200">
            <button
              onClick={() => {
                setActiveTab('charges');
                setMessage(null);
              }}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'charges'
                  ? 'text-sky-500 border-b-2 border-sky-500'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Charges
            </button>
            <button
              onClick={() => {
                setActiveTab('items');
                setMessage(null);
              }}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'items'
                  ? 'text-sky-500 border-b-2 border-sky-500'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Items
            </button>
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

          {/* Charges Tab */}
          {activeTab === 'charges' && (
            <form onSubmit={handleChargesSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="p-6 bg-sky-50 rounded-xl border-2 border-sky-200">
                  <label className="block text-sm font-bold text-black mb-3">
                    Delivery Charge (Rs)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-black font-semibold">
                      Rs
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={charges.deliveryCharge}
                      onChange={(e) => handleChange('deliveryCharge', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white text-black text-lg font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="p-6 bg-sky-50 rounded-xl border-2 border-sky-200">
                  <label className="block text-sm font-bold text-black mb-3">
                    Packing Charge (Rs)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-black font-semibold">
                      Rs
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={charges.packingCharge}
                      onChange={(e) => handleChange('packingCharge', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white text-black text-lg font-semibold"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-sky-300 to-cyan-300 text-white py-4 rounded-xl hover:from-sky-400 hover:to-cyan-400 transition-all font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={fetchCharges}
                  disabled={saving}
                  className="px-6 py-4 bg-gray-200 text-black rounded-xl hover:bg-gray-300 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Refresh
                </button>
              </div>
            </form>
          )}

          {/* Items Tab */}
          {activeTab === 'items' && (
            <div className="space-y-6">
              {/* Add/Edit Item Form */}
              <div className="p-6 bg-sky-50 rounded-xl border-2 border-sky-200">
                <h2 className="text-2xl font-bold text-black mb-4">
                  {editingItem ? 'Edit Item' : 'Add New Item'}
                </h2>
                <form onSubmit={handleItemSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Item Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={itemForm.name}
                        onChange={(e) => handleItemFormChange('name', e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none bg-white text-black"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={itemForm.category}
                        onChange={(e) => {
                          handleItemFormChange('category', e.target.value);
                          // Clear subcategory when category changes
                          handleItemFormChange('subCategory', '');
                          setShowSubcategorySuggestions(false);
                        }}
                        className="w-full px-4 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none bg-white text-black"
                        required
                      >
                        <option value="retail">Retail</option>
                        <option value="produce">Produce</option>
                      </select>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-semibold text-black mb-2">
                        Subcategory <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={itemForm.subCategory}
                          onChange={(e) => {
                            handleItemFormChange('subCategory', e.target.value);
                            setShowSubcategorySuggestions(true);
                          }}
                          onFocus={() => setShowSubcategorySuggestions(true)}
                          onBlur={() => {
                            // Delay hiding to allow click on suggestions
                            setTimeout(() => setShowSubcategorySuggestions(false), 200);
                          }}
                          placeholder="e.g., pizza, burger, cake, snacks"
                          className="w-full px-4 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none bg-white text-black"
                          required
                        />
                        
                        {/* Suggestions Dropdown */}
                        {showSubcategorySuggestions && getSubcategorySuggestions().length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border-2 border-sky-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            <div className="p-2">
                              <p className="text-xs font-semibold text-gray-500 mb-2 px-2">
                                Existing Subcategories ({getSubcategorySuggestions().length}):
                              </p>
                              {getSubcategorySuggestions().map((subcat, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => handleSubcategorySelect(subcat)}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-sky-50 text-black transition-colors flex items-center gap-2"
                                >
                                  <span className="text-sm">📁</span>
                                  <span className="font-medium capitalize">{subcat}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Existing subcategories count */}
                      {getSubCategories(itemForm.category).length > 0 && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-gray-600">
                            Existing subcategories for {itemForm.category}:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {getSubCategories(itemForm.category).slice(0, 5).map((subcat, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => handleSubcategorySelect(subcat)}
                                className="px-2 py-1 text-xs bg-sky-100 text-sky-700 rounded-md hover:bg-sky-200 transition-colors capitalize"
                              >
                                {subcat}
                              </button>
                            ))}
                            {getSubCategories(itemForm.category).length > 5 && (
                              <span className="text-xs text-gray-500">
                                +{getSubCategories(itemForm.category).length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-600 mt-1">
                        Type to search existing subcategories or create a new one
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Price (Rs) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-black font-semibold">
                          Rs
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={itemForm.price}
                          onChange={(e) => handleItemFormChange('price', e.target.value)}
                          className="w-full pl-12 pr-4 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none bg-white text-black"
                          required
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-black mb-2">
                        Image <span className="text-red-500">*</span>
                      </label>
                      
                      {/* Image Mode Toggle */}
                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => {
                            setImageMode('url');
                            setImagePreview('');
                          }}
                          className={`px-4 py-2 rounded-lg border-2 transition-all font-semibold text-sm ${
                            imageMode === 'url'
                              ? 'border-sky-400 bg-sky-200 text-black'
                              : 'border-sky-200 bg-white text-black hover:border-sky-300'
                          }`}
                        >
                          Enter URL
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImageMode('upload');
                            setImagePreview('');
                          }}
                          className={`px-4 py-2 rounded-lg border-2 transition-all font-semibold text-sm ${
                            imageMode === 'upload'
                              ? 'border-sky-400 bg-sky-200 text-black'
                              : 'border-sky-200 bg-white text-black hover:border-sky-300'
                          }`}
                        >
                          Upload Image
                        </button>
                      </div>

                      {/* URL Input */}
                      {imageMode === 'url' && (
                        <input
                          type="url"
                          value={itemForm.image}
                          onChange={(e) => handleItemFormChange('image', e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="w-full px-4 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none bg-white text-black"
                          required
                        />
                      )}

                      {/* File Upload */}
                      {imageMode === 'upload' && (
                        <div className="space-y-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                            className="w-full px-4 py-2 rounded-lg border-2 border-sky-200 focus:border-sky-400 focus:outline-none bg-white text-black disabled:opacity-50 disabled:cursor-not-allowed"
                            required={!itemForm.image}
                          />
                          {uploadingImage && (
                            <p className="text-sm text-sky-600">Uploading and compressing image...</p>
                          )}
                          {itemForm.image && imageMode === 'upload' && (
                            <p className="text-sm text-green-600">✓ Image uploaded successfully</p>
                          )}
                        </div>
                      )}

                      {/* Image Preview */}
                      {imagePreview && (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-black mb-2">Preview:</p>
                          <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-sky-200">
                            <Image
                              src={imagePreview}
                              alt="Preview"
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-gradient-to-r from-sky-300 to-cyan-300 text-white py-3 rounded-xl hover:from-sky-400 hover:to-cyan-400 transition-all font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving
                        ? 'Saving...'
                        : editingItem
                        ? 'Update Item'
                        : 'Add Item'}
                    </button>
                    {editingItem && (
                      <button
                        type="button"
                        onClick={resetItemForm}
                        className="px-6 py-3 bg-gray-200 text-black rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Items List */}
              <div>
                <h2 className="text-2xl font-bold text-black mb-4">All Items ({items.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border-2 border-sky-100 rounded-xl p-4 hover:border-sky-200 hover:shadow-md transition-all"
                    >
                      <div className="relative w-full h-32 mb-3 rounded-lg overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <h3 className="font-bold text-black mb-1">{item.name}</h3>
                      <p className="text-sm text-gray-600 capitalize mb-2">
                        {item.category} - {item.subCategory}
                      </p>
                      <p className="text-lg font-bold text-sky-500 mb-3">
                        Rs {item.price.toFixed(2)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditItem(item)}
                          className="flex-1 px-3 py-2 bg-sky-200 text-black rounded-lg hover:bg-sky-300 transition-colors text-sm font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="flex-1 px-3 py-2 bg-red-200 text-red-800 rounded-lg hover:bg-red-300 transition-colors text-sm font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {items.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <p className="text-gray-600">No items yet. Add your first item above!</p>
                  </div>
                )}
              </div>
            </div>
          )}

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
    </div>
  );
}
