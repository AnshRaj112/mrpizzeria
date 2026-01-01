import { NextRequest } from 'next/server';
import { subscribe } from '@/lib/notifications';

// Force dynamic rendering for SSE
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Server-Sent Events endpoint for real-time order status notifications
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');
  const contactNumber = searchParams.get('contact');

  if (!orderId && !contactNumber) {
    return new Response('Missing orderId or contact parameter', { status: 400 });
  }

  // Use orderId if available, otherwise use contactNumber
  const subscriptionKey = orderId || `contact:${contactNumber}`;

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      console.log(`SSE connection established for: ${subscriptionKey}`);
      
      // Send initial connection message
      const encoder = new TextEncoder();
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to order notifications', subscriptionKey })}\n\n`));
      } catch (error) {
        console.error('Error sending initial SSE message:', error);
      }

      // Subscribe to notifications
      const cleanup = subscribe(subscriptionKey, controller);
      console.log(`Subscribed to notifications for: ${subscriptionKey}`);

      // Keep-alive interval to prevent connection timeout (every 30 seconds)
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch (error) {
          console.error('Error sending keep-alive:', error);
          clearInterval(keepAliveInterval);
        }
      }, 30000);

      // Clean up on connection close
      const abortHandler = () => {
        console.log(`SSE connection closed for: ${subscriptionKey}`);
        clearInterval(keepAliveInterval);
        cleanup();
        try {
          controller.close();
        } catch (error) {
          // Connection already closed
        }
      };

      request.signal.addEventListener('abort', abortHandler);

      // Return cleanup function
      return () => {
        console.log(`Stream cleanup for: ${subscriptionKey}`);
        clearInterval(keepAliveInterval);
        cleanup();
        request.signal.removeEventListener('abort', abortHandler);
        try {
          controller.close();
        } catch (error) {
          // Connection already closed
        }
      };
    },
    cancel() {
      console.log(`Stream cancelled for: ${subscriptionKey}`);
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    },
  });
}

