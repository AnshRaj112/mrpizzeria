import { NextRequest, NextResponse } from 'next/server';
import { printReceipt } from '@/lib/pos-printer';

export async function POST(request: NextRequest) {
  try {
    const orderData = await request.json();

    // Validate required fields
    if (!orderData.dailyOrderId || !orderData.customerName || !orderData.items || !orderData.total) {
      return NextResponse.json(
        { error: 'Missing required order data' },
        { status: 400 }
      );
    }

    // Print receipt
    const result = await printReceipt(orderData);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } else {
      // Don't fail the request if printing fails - just log it
      console.warn('Receipt printing failed:', result.message);
      return NextResponse.json({
        success: false,
        message: result.message,
        warning: 'Order was saved but receipt printing failed. Please check printer connection.',
      }, { status: 200 }); // Still return 200 so order isn't considered failed
    }
  } catch (error: any) {
    console.error('Error in print endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to print receipt',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

