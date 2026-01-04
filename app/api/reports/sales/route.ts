import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - Generate sales report for a specific date
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Get all items
    const items = await db.collection('items').find({}).toArray();

    // Get all orders for the date (count all orders since stock decreases immediately on order placement)
    const orders = await db
      .collection('orders')
      .find({
        orderDate: date,
      })
      .toArray();

    // Calculate sales for each item
    const salesData: any[] = [];

    for (const item of items) {
      // Calculate sold quantity from orders
      let soldQuantity = 0;
      let totalRevenue = 0;

      orders.forEach((order) => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((orderItem: any) => {
            if (orderItem.id === item.id) {
              soldQuantity += orderItem.quantity || 0;
              totalRevenue += (orderItem.price || 0) * (orderItem.quantity || 0);
            }
          });
        }
      });

      // Get quantity changes for the date
      const quantityChanges = await db
        .collection('quantity_changes')
        .find({
          itemId: item.id,
          date: date,
        })
        .toArray();

      // Calculate added quantity (positive changes)
      const addedQuantity = quantityChanges
        .filter((change) => change.change > 0)
        .reduce((sum, change) => sum + change.change, 0);

      // Calculate removed quantity (negative changes)
      const removedQuantity = Math.abs(
        quantityChanges
          .filter((change) => change.change < 0)
          .reduce((sum, change) => sum + change.change, 0)
      );

      // Get opening quantity (quantity at start of day)
      // Opening = Closing - Added + Sold + Removed
      const currentQuantity = item.category === 'retail' ? (item.quantity || 0) : null;
      const closingQuantity = currentQuantity;
      const openingQuantity =
        currentQuantity !== null
          ? currentQuantity - addedQuantity + soldQuantity + removedQuantity
          : null;

      salesData.push({
        id: item.id,
        name: item.name,
        category: item.category,
        subCategory: item.subCategory,
        price: item.price,
        openingQuantity: openingQuantity,
        addedQuantity: addedQuantity,
        soldQuantity: soldQuantity,
        closingQuantity: closingQuantity,
        totalRevenue: totalRevenue,
      });
    }

    // Separate retail and produce
    const retailData = salesData.filter((item) => item.category === 'retail');
    const produceData = salesData.filter((item) => item.category === 'produce');

    return NextResponse.json({
      date,
      retail: retailData,
      produce: produceData,
      summary: {
        totalRetailItems: retailData.length,
        totalProduceItems: produceData.length,
        totalRevenue: salesData.reduce((sum, item) => sum + item.totalRevenue, 0),
        totalSold: salesData.reduce((sum, item) => sum + item.soldQuantity, 0),
      },
    });
  } catch (error: any) {
    console.error('Error generating sales report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate sales report' },
      { status: 500 }
    );
  }
}

