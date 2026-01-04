import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - Get subcategory order
export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    const orderDoc = await db.collection('settings').findOne({ type: 'subcategory_order' });
    
    if (!orderDoc) {
      return NextResponse.json({ order: {} });
    }

    return NextResponse.json({ order: orderDoc.order || {} });
  } catch (error) {
    console.error('Error fetching subcategory order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subcategory order' },
      { status: 500 }
    );
  }
}

// POST - Update subcategory order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order } = body; // Object with category and subcategory as keys, order as values

    if (!order || typeof order !== 'object') {
      return NextResponse.json(
        { error: 'Order must be an object' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Upsert the subcategory order
    await db.collection('settings').updateOne(
      { type: 'subcategory_order' },
      { 
        $set: { 
          order,
          updatedAt: new Date() 
        } 
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating subcategory order:', error);
    return NextResponse.json(
      { error: 'Failed to update subcategory order' },
      { status: 500 }
    );
  }
}

