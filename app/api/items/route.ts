import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - Fetch all items
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('mrpizzeria');
    const items = await db.collection('items').find({}).toArray();
    
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

// POST - Create a new item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, subCategory, price, image } = body;

    // Validation
    if (!name || !category || !subCategory || typeof price !== 'number' || !image) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (category !== 'retail' && category !== 'produce') {
      return NextResponse.json(
        { error: 'Category must be either "retail" or "produce"' },
        { status: 400 }
      );
    }

    if (price < 0) {
      return NextResponse.json(
        { error: 'Price cannot be negative' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Get the highest ID and increment
    const lastItem = await db.collection('items').findOne({}, { sort: { id: -1 } });
    const newId = lastItem ? lastItem.id + 1 : 1;

    const newItem = {
      id: newId,
      name: name.trim(),
      category,
      subCategory: subCategory.trim(),
      price: parseFloat(price.toFixed(2)),
      image: image.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('items').insertOne(newItem);

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    );
  }
}

// PUT - Update an item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, category, subCategory, price, image } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    if (category && category !== 'retail' && category !== 'produce') {
      return NextResponse.json(
        { error: 'Category must be either "retail" or "produce"' },
        { status: 400 }
      );
    }

    if (price !== undefined && price < 0) {
      return NextResponse.json(
        { error: 'Price cannot be negative' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name) updateData.name = name.trim();
    if (category) updateData.category = category;
    if (subCategory) updateData.subCategory = subCategory.trim();
    if (price !== undefined) updateData.price = parseFloat(price.toFixed(2));
    if (image) updateData.image = image.trim();

    const result = await db.collection('items').updateOne(
      { id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    const result = await db.collection('items').deleteOne({ id: parseInt(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}

