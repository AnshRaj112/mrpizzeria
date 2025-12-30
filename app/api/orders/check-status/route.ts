import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - Check order status by contact number
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactNumber = searchParams.get('contact');

    if (!contactNumber) {
      return NextResponse.json(
        { error: 'Contact number is required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Get the most recent order for this contact number
    const order = await db
      .collection('orders')
      .findOne(
        { contactNumber },
        { sort: { createdAt: -1 } }
      );

    if (!order) {
      return NextResponse.json({ order: null });
    }

    return NextResponse.json({
      order: {
        _id: order._id.toString(),
        dailyOrderId: order.dailyOrderId,
        status: order.status,
        orderType: order.orderType,
        customerName: order.customerName,
        total: order.total,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error checking order status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check order status' },
      { status: 500 }
    );
  }
}

