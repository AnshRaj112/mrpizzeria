import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - Fetch all items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const visibleOnly = searchParams.get('visibleOnly') === 'true';
    
    const client = await clientPromise;
    const db = client.db('mrpizzeria');
    
    let query: any = {};
    if (visibleOnly) {
      query.isVisible = { $ne: false }; // Include items where isVisible is true or undefined
    }
    
    const items = await db.collection('items').find(query).sort({ displayOrder: 1, id: 1 }).toArray();
    
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
    const { name, category, subCategory, price, image, sizes, extraCheesePrice, lowStockThreshold } = body;

    // Basic validation
    if (!name || !category || !subCategory || !image) {
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

    // Check if it's a pizza item
    const isPizza = category === 'produce' && subCategory.toLowerCase() === 'pizza';

    // Validate pizza items
    if (isPizza) {
      if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
        return NextResponse.json(
          { error: 'Pizza items must have at least one size configured' },
          { status: 400 }
        );
      }
      for (const size of sizes) {
        if (!size.name || typeof size.price !== 'number' || size.price <= 0) {
          return NextResponse.json(
            { error: 'Invalid size configuration. Each size must have a name and a positive price.' },
            { status: 400 }
          );
        }
      }
    } else {
      // Non-pizza items must have a price
      if (typeof price !== 'number' || price <= 0) {
        return NextResponse.json(
          { error: 'Price is required and must be greater than 0' },
          { status: 400 }
        );
      }
    }

    // Validate extra cheese price if provided
    if (extraCheesePrice !== undefined && (typeof extraCheesePrice !== 'number' || extraCheesePrice < 0)) {
      return NextResponse.json(
        { error: 'Extra cheese price must be a non-negative number' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Get the highest ID and increment
    const lastItem = await db.collection('items').findOne({}, { sort: { id: -1 } });
    const newId = lastItem ? lastItem.id + 1 : 1;

    // Calculate price for pizza items (lowest size price) or use provided price
    let itemPrice = 0;
    if (isPizza && sizes && sizes.length > 0) {
      itemPrice = Math.min(...sizes.map((s: any) => s.price));
    } else {
      itemPrice = parseFloat(price.toFixed(2));
    }

    // Get max displayOrder for this subcategory to set default order
    const maxOrderItem = await db.collection('items').findOne(
      { category, subCategory: subCategory.trim() },
      { sort: { displayOrder: -1 } }
    );
    const defaultDisplayOrder = maxOrderItem?.displayOrder !== undefined 
      ? (maxOrderItem.displayOrder + 1) 
      : newId;

    const newItem: any = {
      id: newId,
      name: name.trim(),
      category,
      subCategory: subCategory.trim(),
      price: itemPrice,
      image: image.trim(),
      isVisible: true, // Default to visible
      displayOrder: defaultDisplayOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add quantity fields for retail items
    if (category === 'retail') {
      newItem.quantity = 0;
      // Use provided threshold or default to 10, but allow 0 as valid value
      if (lowStockThreshold !== undefined && typeof lowStockThreshold === 'number' && lowStockThreshold >= 0) {
        newItem.lowStockThreshold = Math.floor(lowStockThreshold);
      } else {
        newItem.lowStockThreshold = 10; // Default low stock threshold
      }
    }

    // Add pizza-specific fields if provided
    if (sizes && Array.isArray(sizes) && sizes.length > 0) {
      newItem.sizes = sizes.map((s: any) => ({
        name: s.name.trim(),
        price: parseFloat(s.price.toFixed(2))
      }));
    }

    if (extraCheesePrice !== undefined) {
      newItem.extraCheesePrice = parseFloat(extraCheesePrice.toFixed(2));
    }

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
    const { id, name, category, subCategory, price, image, quantity, lowStockThreshold, isVisible, sizes, extraCheesePrice } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Fast path: If only visibility is being updated, do a simple update
    const onlyVisibilityUpdate = 
      isVisible !== undefined &&
      name === undefined &&
      category === undefined &&
      subCategory === undefined &&
      price === undefined &&
      image === undefined &&
      quantity === undefined &&
      lowStockThreshold === undefined &&
      sizes === undefined &&
      extraCheesePrice === undefined;

    if (onlyVisibilityUpdate) {
      const result = await db.collection('items').updateOne(
        { id },
        { $set: { isVisible, updatedAt: new Date() } }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json(
          { error: 'Item not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Full update path for other changes
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

    // Validate pizza sizes if provided
    if (sizes !== undefined) {
      if (!Array.isArray(sizes)) {
        return NextResponse.json(
          { error: 'Sizes must be an array' },
          { status: 400 }
        );
      }
      for (const size of sizes) {
        if (!size.name || typeof size.price !== 'number' || size.price < 0) {
          return NextResponse.json(
            { error: 'Invalid size configuration. Each size must have a name and non-negative price.' },
            { status: 400 }
          );
        }
      }
    }

    // Validate extra cheese price if provided
    if (extraCheesePrice !== undefined && (typeof extraCheesePrice !== 'number' || extraCheesePrice < 0)) {
      return NextResponse.json(
        { error: 'Extra cheese price must be a non-negative number' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name) updateData.name = name.trim();
    if (category) updateData.category = category;
    if (subCategory) updateData.subCategory = subCategory.trim();
    if (price !== undefined) updateData.price = parseFloat(price.toFixed(2));
    if (image) updateData.image = image.trim();
    if (isVisible !== undefined) updateData.isVisible = isVisible;
    
    // Quantity management for retail items
    if (category === 'retail' || quantity !== undefined) {
      if (quantity !== undefined) {
        updateData.quantity = Math.max(0, Math.floor(Number(quantity)));
      }
      if (lowStockThreshold !== undefined) {
        updateData.lowStockThreshold = Math.max(0, Math.floor(Number(lowStockThreshold)));
      }
    }

    // Pizza-specific fields
    const unsetFields: any = {};
    if (sizes !== undefined) {
      if (sizes.length === 0) {
        // Remove sizes field if empty array
        unsetFields.sizes = '';
      } else {
        updateData.sizes = sizes.map((s: any) => ({
          name: s.name.trim(),
          price: parseFloat(s.price.toFixed(2))
        }));
      }
    }

    if (extraCheesePrice !== undefined) {
      if (extraCheesePrice === null || extraCheesePrice === '') {
        // Remove extraCheesePrice field if null or empty
        unsetFields.extraCheesePrice = '';
      } else {
        updateData.extraCheesePrice = parseFloat(extraCheesePrice.toFixed(2));
      }
    }

    // Build update operation
    const updateOperation: any = { $set: updateData };
    if (Object.keys(unsetFields).length > 0) {
      updateOperation.$unset = unsetFields;
    }

    const result = await db.collection('items').updateOne(
      { id },
      updateOperation
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Check for low stock if quantity was updated for retail items
    if (quantity !== undefined && category === 'retail') {
      const updatedItem = await db.collection('items').findOne({ id });
      if (updatedItem && updatedItem.quantity <= (updatedItem.lowStockThreshold || 10)) {
        // Store low stock notification (can be checked by admin)
        await db.collection('notifications').insertOne({
          type: 'low_stock',
          itemId: id,
          itemName: updatedItem.name,
          quantity: updatedItem.quantity,
          threshold: updatedItem.lowStockThreshold || 10,
          createdAt: new Date(),
          read: false,
        });
      }
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

