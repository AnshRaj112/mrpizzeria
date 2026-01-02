import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

// POST - Create Razorpay order for admin checkout
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, contactNumber, orderType, discountType, discountValue } = body;

    if (!customerName || !contactNumber) {
      return NextResponse.json(
        { error: 'Customer name and contact number are required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Get cart items
    const cart = await db.collection('admin_cart').findOne({ type: 'admin' });

    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      );
    }

    // Get charges
    const charges = await db.collection('charges').findOne({});
    const deliveryCharge = charges?.deliveryCharge || 5.00;
    const packingCharge = charges?.packingCharge || 2.00;

    // Calculate subtotal
    const subtotal = cart.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );

    // Calculate total based on order type
    let total = subtotal;
    if (orderType === 'delivery') {
      total += deliveryCharge + packingCharge;
    } else if (orderType === 'takeaway') {
      total += packingCharge;
    }
    // Dine-in has no additional charges

    // Apply discount if provided
    let discountAmount = 0;
    if (discountType && discountValue) {
      const discountVal = parseFloat(discountValue);
      if (!isNaN(discountVal) && discountVal > 0) {
        if (discountType === 'percentage') {
          discountAmount = (total * discountVal) / 100;
        } else if (discountType === 'fixed') {
          discountAmount = discountVal;
        }
        total = Math.max(0, total - discountAmount);
      }
    }

    if (total <= 0) {
      return NextResponse.json(
        { error: 'Invalid total amount' },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(total * 100), // Convert to paise
      currency: 'INR',
      receipt: `admin_${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: total,
      items: cart.items,
    });
  } catch (error: any) {
    console.error('Error creating checkout order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout order' },
      { status: 500 }
    );
  }
}

