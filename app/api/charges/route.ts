import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - Fetch charges
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('mrpizzeria');
    const charges = await db.collection('charges').findOne({});

    if (!charges) {
      // Initialize with default values if no charges exist
      const defaultCharges = {
        deliveryCharge: 5.00,
        packingCharge: 2.00,
      };
      await db.collection('charges').insertOne(defaultCharges);
      return NextResponse.json(defaultCharges);
    }

    return NextResponse.json({
      deliveryCharge: charges.deliveryCharge || 5.00,
      packingCharge: charges.packingCharge || 2.00,
    });
  } catch (error) {
    console.error('Error fetching charges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch charges' },
      { status: 500 }
    );
  }
}

// PUT - Update charges
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { deliveryCharge, packingCharge } = body;

    if (typeof deliveryCharge !== 'number' || typeof packingCharge !== 'number') {
      return NextResponse.json(
        { error: 'Invalid charge values' },
        { status: 400 }
      );
    }

    if (deliveryCharge < 0 || packingCharge < 0) {
      return NextResponse.json(
        { error: 'Charges cannot be negative' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Update or insert charges
    await db.collection('charges').updateOne(
      {},
      {
        $set: {
          deliveryCharge,
          packingCharge,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      deliveryCharge,
      packingCharge,
    });
  } catch (error) {
    console.error('Error updating charges:', error);
    return NextResponse.json(
      { error: 'Failed to update charges' },
      { status: 500 }
    );
  }
}

