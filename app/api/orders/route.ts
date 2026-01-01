import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { notifyOrderUpdate } from '@/lib/notifications';

// GET - Fetch orders by status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type'); // 'active' or 'past'
    const date = searchParams.get('date'); // Optional date filter

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    let query: any = {};

    if (type === 'active') {
      // Active orders: not delivered
      query = { status: { $ne: 'delivered' } };
    } else if (type === 'past') {
      // Past orders: delivered
      query = { status: 'delivered' };
      // Add date filter if provided
      if (date) {
        query.orderDate = date;
      }
    } else if (status) {
      // Specific status
      query = { status };
    }

    const orders = await db
      .collection('orders')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// PUT - Update order status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { error: 'Order ID and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = [
      'pending',
      'being_prepared',
      'prepared',
      'ready_for_pickup',
      'out_for_delivery',
      'delivered',
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    let query: any;
    try {
      query = { _id: new ObjectId(orderId) };
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    // Get the order before updating to check current status and get contact info
    const order = await db.collection('orders').findOne(query);

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Update order status
    const result = await db.collection('orders').updateOne(
      query,
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Broadcast notification to subscribers
    try {
      // Get updated order with all details
      const updatedOrder = await db.collection('orders').findOne(query);
      
      if (!updatedOrder) {
        console.error('Order not found after update');
        return NextResponse.json({
          success: true,
          message: 'Order status updated successfully',
        });
      }

      const notificationData = {
        type: 'status_update',
        orderId: orderId,
        dailyOrderId: updatedOrder.dailyOrderId,
        status: status,
        orderType: updatedOrder.orderType,
        customerName: updatedOrder.customerName,
        updatedAt: new Date().toISOString(),
      };

      // Notify by orderId (MongoDB ObjectId string)
      console.log(`Sending notification for orderId: ${orderId}`);
      notifyOrderUpdate(orderId, notificationData);

      // Also notify by contact number (for backwards compatibility)
      if (updatedOrder.contactNumber) {
        const contactKey = `contact:${updatedOrder.contactNumber}`;
        console.log(`Sending notification for contact: ${contactKey}`);
        notifyOrderUpdate(contactKey, {
          ...notificationData,
          contactNumber: updatedOrder.contactNumber,
        });
      }
    } catch (notifyError) {
      // Don't fail the request if notification fails
      console.error('Error sending notification:', notifyError);
    }

    return NextResponse.json({
      success: true,
      message: 'Order status updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update order status' },
      { status: 500 }
    );
  }
}

