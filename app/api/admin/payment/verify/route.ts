import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import crypto from 'crypto';

// POST - Verify admin payment and create order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customerName,
      contactNumber,
      orderType,
      deliveryAddress,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Payment verification failed: Missing payment details' },
        { status: 400 }
      );
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Payment verification failed: Invalid signature' },
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

    // Get order date
    const orderDate = new Date().toISOString().split('T')[0];

    // Get the last order for today to determine next order ID
    const lastOrder = await db.collection('orders').findOne(
      {
        orderDate: orderDate,
      },
      {
        sort: { dailyOrderId: -1 },
      }
    );

    // Get next order ID (starts from 1 each day)
    const dailyOrderId = lastOrder ? (lastOrder.dailyOrderId || 0) + 1 : 1;

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
    let finalDeliveryCharge = 0;
    let finalPackingCharge = 0;

    if (orderType === 'delivery') {
      finalDeliveryCharge = deliveryCharge;
      finalPackingCharge = packingCharge;
      total += deliveryCharge + packingCharge;
    } else if (orderType === 'takeaway') {
      finalPackingCharge = packingCharge;
      total += packingCharge;
    }
    // Dine-in has no additional charges

    // Create order
    const orderData = {
      items: cart.items,
      customerName: customerName || 'Admin Order',
      contactNumber: contactNumber || '',
      orderType: orderType || 'takeaway',
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
      subtotal: subtotal,
      deliveryCharge: finalDeliveryCharge,
      packingCharge: finalPackingCharge,
      total: total,
      dailyOrderId,
      orderDate,
      status: 'pending',
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentStatus: 'success',
      isAdminOrder: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await db.collection('orders').insertOne(orderData);

    // Clear cart after successful order
    await db.collection('admin_cart').updateOne(
      { type: 'admin' },
      { $set: { items: [], total: 0, updatedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      message: 'Payment verified and order created successfully',
      dailyOrderId,
      orderDate,
      orderId: insertResult.insertedId.toString(),
      razorpayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
  } catch (error: any) {
    console.error('Error verifying admin payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify payment' },
      { status: 500 }
    );
  }
}

