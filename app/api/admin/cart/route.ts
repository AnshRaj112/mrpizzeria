import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - Fetch admin cart
export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Get admin cart (we'll use a single admin cart for now)
    const cart = await db.collection('admin_cart').findOne({ type: 'admin' });

    if (!cart) {
      return NextResponse.json({ items: [], total: 0 });
    }

    return NextResponse.json({
      items: cart.items || [],
      total: cart.total || 0,
      updatedAt: cart.updatedAt,
    });
  } catch (error: any) {
    console.error('Error fetching admin cart:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cart' },
      { status: 500 }
    );
  }
}

// POST - Add item to cart
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item } = body;

    if (!item || !item.id) {
      return NextResponse.json(
        { error: 'Item is required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Get current cart
    let cart: any = await db.collection('admin_cart').findOne({ type: 'admin' });

    if (!cart) {
      cart = {
        type: 'admin',
        items: [],
        total: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (cartItem: any) => cartItem.id === item.id
    );

    // Always add quantity 1 when adding to cart (don't use item.quantity which might be stock quantity)
    const quantityToAdd = 1;

    if (existingItemIndex >= 0) {
      // Update quantity - add 1 more
      cart.items[existingItemIndex].quantity += quantityToAdd;
    } else {
      // Add new item with quantity 1
      cart.items.push({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        category: item.category,
        subCategory: item.subCategory,
        quantity: quantityToAdd,
      });
    }

    // Calculate total
    cart.total = cart.items.reduce(
      (sum: number, cartItem: any) => sum + cartItem.price * cartItem.quantity,
      0
    );
    cart.updatedAt = new Date();

    // Save cart
    await db.collection('admin_cart').updateOne(
      { type: 'admin' },
      { $set: cart },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      items: cart.items,
      total: cart.total,
    });
  } catch (error: any) {
    console.error('Error adding item to cart:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add item to cart' },
      { status: 500 }
    );
  }
}

// PUT - Update cart item quantity
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, quantity } = body;

    if (!itemId || quantity === undefined) {
      return NextResponse.json(
        { error: 'Item ID and quantity are required' },
        { status: 400 }
      );
    }

    if (quantity < 0) {
      return NextResponse.json(
        { error: 'Quantity cannot be negative' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    const cart = await db.collection('admin_cart').findOne({ type: 'admin' });

    if (!cart || !cart.items) {
      return NextResponse.json(
        { error: 'Cart not found' },
        { status: 404 }
      );
    }

    if (quantity === 0) {
      // Remove item
      cart.items = cart.items.filter((item: any) => item.id !== itemId);
    } else {
      // Update quantity
      const itemIndex = cart.items.findIndex((item: any) => item.id === itemId);
      if (itemIndex >= 0) {
        cart.items[itemIndex].quantity = quantity;
      } else {
        return NextResponse.json(
          { error: 'Item not found in cart' },
          { status: 404 }
        );
      }
    }

    // Calculate total
    cart.total = cart.items.reduce(
      (sum: number, cartItem: any) => sum + cartItem.price * cartItem.quantity,
      0
    );
    cart.updatedAt = new Date();

    await db.collection('admin_cart').updateOne(
      { type: 'admin' },
      { $set: cart }
    );

    return NextResponse.json({
      success: true,
      items: cart.items,
      total: cart.total,
    });
  } catch (error: any) {
    console.error('Error updating cart:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update cart' },
      { status: 500 }
    );
  }
}

// DELETE - Clear cart or remove item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    if (itemId) {
      // Remove specific item
      const cart = await db.collection('admin_cart').findOne({ type: 'admin' });

      if (!cart || !cart.items) {
        return NextResponse.json(
          { error: 'Cart not found' },
          { status: 404 }
        );
      }

      cart.items = cart.items.filter((item: any) => item.id !== Number(itemId));
      cart.total = cart.items.reduce(
        (sum: number, cartItem: any) => sum + cartItem.price * cartItem.quantity,
        0
      );
      cart.updatedAt = new Date();

      await db.collection('admin_cart').updateOne(
        { type: 'admin' },
        { $set: cart }
      );
    } else {
      // Clear entire cart
      await db.collection('admin_cart').updateOne(
        { type: 'admin' },
        { $set: { items: [], total: 0, updatedAt: new Date() } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error clearing cart:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clear cart' },
      { status: 500 }
    );
  }
}

