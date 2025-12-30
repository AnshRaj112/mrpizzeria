import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import clientPromise from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment details' },
        { status: 400 }
      );
    }

    // Verify the payment signature
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    const isSignatureValid = generatedSignature === razorpay_signature;

    if (!isSignatureValid) {
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Get daily order ID
    let dailyOrderId = 1;
    let orderDate = new Date().toISOString().split('T')[0];
    
    if (orderData) {
      try {
        const client = await clientPromise;
        const db = client.db('mrpizzeria');

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
        dailyOrderId = lastOrder ? (lastOrder.dailyOrderId || 0) + 1 : 1;
        
        // Save order to database with daily order ID
        await db.collection('orders').insertOne({
          ...orderData,
          dailyOrderId,
          orderDate,
          status: 'pending', // Initial status
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          paymentStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (dbError) {
        console.error('Error saving order to database:', dbError);
        // Don't fail the payment verification if DB save fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      dailyOrderId,
      orderDate,
      razorpayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify payment' },
      { status: 500 }
    );
  }
}

