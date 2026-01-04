import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// POST - Update item display order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemOrders } = body; // Array of { id: number, displayOrder: number }

    if (!itemOrders || !Array.isArray(itemOrders)) {
      return NextResponse.json(
        { error: 'itemOrders must be an array' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Update each item's displayOrder
    const updatePromises = itemOrders.map(({ id, displayOrder }: { id: number; displayOrder: number }) =>
      db.collection('items').updateOne(
        { id },
        { $set: { displayOrder, updatedAt: new Date() } }
      )
    );

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating item order:', error);
    return NextResponse.json(
      { error: 'Failed to update item order' },
      { status: 500 }
    );
  }
}

