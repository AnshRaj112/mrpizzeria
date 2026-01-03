import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import clientPromise from '@/lib/mongodb';
import { notifyOrderUpdate } from '@/lib/notifications';
import { printReceipt } from '@/lib/pos-printer';

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
    let orderId: string | null = null;
    
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
        const insertResult = await db.collection('orders').insertOne({
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

        orderId = insertResult.insertedId.toString();

        // Notify admin about new order
        try {
          const notificationData = {
            type: 'new_order',
            orderId: orderId,
            dailyOrderId: dailyOrderId,
            customerName: orderData.customerName || 'Customer',
            contactNumber: orderData.contactNumber || '',
            orderType: orderData.orderType || 'takeaway',
            total: orderData.total || 0,
            createdAt: new Date().toISOString(),
          };
          notifyOrderUpdate('admin:new-orders', notificationData);
          console.log('Admin notified about new order:', dailyOrderId);
        } catch (notifyError) {
          console.error('Error notifying admin about new order:', notifyError);
          // Don't fail the order if notification fails
        }

        // Print receipt automatically (fire and forget - don't wait for response)
        try {
          const printData = {
            dailyOrderId,
            orderDate,
            customerName: orderData.customerName || 'Customer',
            contactNumber: orderData.contactNumber || '',
            orderType: orderData.orderType || 'takeaway',
            deliveryAddress: orderData.deliveryAddress || null,
            items: orderData.items || [],
            subtotal: orderData.subtotal || 0,
            deliveryCharge: orderData.deliveryCharge || 0,
            packingCharge: orderData.packingCharge || 0,
            total: orderData.total || 0,
            paymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            paymentMethod: 'online',
          };

          // Print asynchronously (don't await - fire and forget)
          printReceipt(printData).catch((printError) => {
            console.error('Error printing receipt:', printError);
            // Don't fail the order if printing fails
          });
        } catch (printError) {
          console.error('Error initiating receipt print:', printError);
          // Don't fail the order if printing fails
        }

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
      orderId: orderId,
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

