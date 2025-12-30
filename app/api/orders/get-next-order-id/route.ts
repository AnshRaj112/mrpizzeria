import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Find the last order for today
    const lastOrder = await db.collection('orders').findOne(
      {
        orderDate: dateString,
      },
      {
        sort: { dailyOrderId: -1 },
      }
    );

    // Get next order ID (starts from 1 each day)
    const nextOrderId = lastOrder ? (lastOrder.dailyOrderId || 0) + 1 : 1;

    return NextResponse.json({
      orderId: nextOrderId,
      orderDate: dateString,
    });
  } catch (error) {
    console.error('Error getting next order ID:', error);
    return NextResponse.json(
      { error: 'Failed to get order ID' },
      { status: 500 }
    );
  }
}

