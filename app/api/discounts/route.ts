import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

// GET - Fetch all active discounts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const includeUpcoming = searchParams.get('includeUpcoming') === 'true';
    const includeExpired = searchParams.get('includeExpired') === 'true';

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    let query: any = {};

    if (activeOnly) {
      const now = new Date();
      query = {
        isActive: true,
        $or: [
          { endDate: null },
          { endDate: { $gte: now } }
        ],
        startDate: { $lte: now }
      };
    } else if (includeUpcoming) {
      // Fetch both active and upcoming discounts
      const now = new Date();
      query = {
        isActive: true,
        $or: [
          // Active discounts (started and not ended)
          {
            startDate: { $lte: now },
            $or: [
              { endDate: null },
              { endDate: { $gte: now } }
            ]
          },
          // Upcoming discounts (not started yet)
          {
            startDate: { $gt: now }
          }
        ]
      };
    }

    const discounts = await db
      .collection('discounts')
      .find(query)
      .sort({ startDate: 1 }) // Sort by start date (upcoming first)
      .toArray();

    return NextResponse.json(discounts);
  } catch (error: any) {
    console.error('Error fetching discounts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch discounts' },
      { status: 500 }
    );
  }
}

// POST - Create a new discount
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      discountType,
      discountValue,
      applyTo,
      productIds,
      startDate,
      endDate,
      isActive,
    } = body;

    // Validation
    if (!name || !discountType || discountValue === undefined || !applyTo) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (discountType !== 'percentage' && discountType !== 'fixed') {
      return NextResponse.json(
        { error: 'Discount type must be either "percentage" or "fixed"' },
        { status: 400 }
      );
    }

    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return NextResponse.json(
        { error: 'Percentage discount must be between 0 and 100' },
        { status: 400 }
      );
    }

    if (discountType === 'fixed' && discountValue < 0) {
      return NextResponse.json(
        { error: 'Fixed discount cannot be negative' },
        { status: 400 }
      );
    }

    if (applyTo !== 'all' && applyTo !== 'specific') {
      return NextResponse.json(
        { error: 'Apply to must be either "all" or "specific"' },
        { status: 400 }
      );
    }

    if (applyTo === 'specific' && (!productIds || !Array.isArray(productIds) || productIds.length === 0)) {
      return NextResponse.json(
        { error: 'Product IDs are required when applying to specific products' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    const newDiscount = {
      name: name.trim(),
      description: description?.trim() || '',
      discountType,
      discountValue: parseFloat(discountValue.toFixed(2)),
      applyTo,
      productIds: applyTo === 'specific' ? productIds.map((id: number) => parseInt(id)) : [],
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      isActive: isActive !== undefined ? isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('discounts').insertOne(newDiscount);

    return NextResponse.json(
      { success: true, discount: { ...newDiscount, _id: result.insertedId } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating discount:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create discount' },
      { status: 500 }
    );
  }
}

// PUT - Update a discount
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      discountId,
      name,
      description,
      discountType,
      discountValue,
      applyTo,
      productIds,
      startDate,
      endDate,
      isActive,
    } = body;

    if (!discountId) {
      return NextResponse.json(
        { error: 'Discount ID is required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    let query: any;
    try {
      query = { _id: new ObjectId(discountId) };
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid discount ID format' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || '';
    if (discountType !== undefined) {
      if (discountType !== 'percentage' && discountType !== 'fixed') {
        return NextResponse.json(
          { error: 'Discount type must be either "percentage" or "fixed"' },
          { status: 400 }
        );
      }
      updateData.discountType = discountType;
    }
    if (discountValue !== undefined) {
      if (updateData.discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
        return NextResponse.json(
          { error: 'Percentage discount must be between 0 and 100' },
          { status: 400 }
        );
      }
      if (updateData.discountType === 'fixed' && discountValue < 0) {
        return NextResponse.json(
          { error: 'Fixed discount cannot be negative' },
          { status: 400 }
        );
      }
      updateData.discountValue = parseFloat(discountValue.toFixed(2));
    }
    if (applyTo !== undefined) {
      if (applyTo !== 'all' && applyTo !== 'specific') {
        return NextResponse.json(
          { error: 'Apply to must be either "all" or "specific"' },
          { status: 400 }
        );
      }
      updateData.applyTo = applyTo;
      if (applyTo === 'specific') {
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
          return NextResponse.json(
            { error: 'Product IDs are required when applying to specific products' },
            { status: 400 }
          );
        }
        updateData.productIds = productIds.map((id: number) => parseInt(id));
      } else {
        updateData.productIds = [];
      }
    }
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : new Date();
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const result = await db.collection('discounts').updateOne(query, { $set: updateData });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Discount not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating discount:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update discount' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a discount
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const discountId = searchParams.get('id');

    if (!discountId) {
      return NextResponse.json(
        { error: 'Discount ID is required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    let query: any;
    try {
      query = { _id: new ObjectId(discountId) };
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid discount ID format' },
        { status: 400 }
      );
    }

    const result = await db.collection('discounts').deleteOne(query);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Discount not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting discount:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete discount' },
      { status: 500 }
    );
  }
}

