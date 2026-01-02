import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - Download sales report as CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const category = searchParams.get('category') || 'all'; // 'retail', 'produce', or 'all'

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Get all items
    const items = await db.collection('items').find({}).toArray();

    // Get all delivered orders for the date
    const orders = await db
      .collection('orders')
      .find({
        orderDate: date,
        status: 'delivered',
      })
      .toArray();

    // Calculate sales for each item
    const salesData: any[] = [];

    for (const item of items) {
      // Filter by category if specified
      if (category !== 'all' && item.category !== category) {
        continue;
      }

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
        openingQuantity: openingQuantity ?? 'N/A',
        addedQuantity: addedQuantity,
        soldQuantity: soldQuantity,
        closingQuantity: closingQuantity ?? 'N/A',
        totalRevenue: totalRevenue,
      });
    }

    // Generate CSV
    const headers = [
      'Item ID',
      'Item Name',
      'Category',
      'Sub Category',
      'Price (Rs)',
      'Opening Quantity',
      'Added Quantity',
      'Sold Quantity',
      'Closing Quantity',
      'Total Revenue (Rs)',
    ];

    const rows = salesData.map((item) => [
      item.id,
      item.name,
      item.category,
      item.subCategory,
      item.price.toFixed(2),
      item.openingQuantity,
      item.addedQuantity,
      item.soldQuantity,
      item.closingQuantity,
      item.totalRevenue.toFixed(2),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Add BOM for Excel compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    return new Response(csvWithBOM, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sales-report-${date}-${category}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating CSV report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate CSV report' },
      { status: 500 }
    );
  }
}

