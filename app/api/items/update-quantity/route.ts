import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// PUT - Update quantity for retail items (daily basis)
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

    if (typeof quantity !== 'number' || quantity < 0) {
      return NextResponse.json(
        { error: 'Quantity must be a non-negative number' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    const item = await db.collection('items').findOne({ id: itemId });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    if (item.category !== 'retail') {
      return NextResponse.json(
        { error: 'Quantity can only be set for retail items' },
        { status: 400 }
      );
    }

    const newQuantity = Math.floor(quantity);
    const lowStockThreshold = item.lowStockThreshold || 10;
    const oldQuantity = item.quantity || 0;
    const quantityChange = newQuantity - oldQuantity;
    const today = new Date().toISOString().split('T')[0];

    // Track quantity change for daily reports
    if (quantityChange !== 0) {
      // Store quantity change record
      await db.collection('quantity_changes').insertOne({
        itemId: itemId,
        itemName: item.name,
        date: today,
        oldQuantity: oldQuantity,
        newQuantity: newQuantity,
        change: quantityChange,
        type: quantityChange > 0 ? 'added' : 'removed',
        createdAt: new Date(),
      });
    }

    // Update quantity
    const result = await db.collection('items').updateOne(
      { id: itemId },
      {
        $set: {
          quantity: newQuantity,
          quantityUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Check for low stock and create notification
    if (newQuantity <= lowStockThreshold) {
      // Check if notification already exists for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingNotification = await db.collection('notifications').findOne({
        type: 'low_stock',
        itemId: itemId,
        createdAt: { $gte: today },
        read: false,
      });

      if (!existingNotification) {
        await db.collection('notifications').insertOne({
          type: 'low_stock',
          itemId: itemId,
          itemName: item.name,
          quantity: newQuantity,
          threshold: lowStockThreshold,
          createdAt: new Date(),
          read: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      quantity: newQuantity,
      isLowStock: newQuantity <= lowStockThreshold,
    });
  } catch (error: any) {
    console.error('Error updating quantity:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update quantity' },
      { status: 500 }
    );
  }
}

