import { NextRequest } from 'next/server';
import { subscribe } from '@/lib/notifications';

// Force dynamic rendering for SSE
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Server-Sent Events endpoint for admin order notifications
export async function GET(request: NextRequest) {
  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      console.log('SSE connection established for admin notifications');
      
      // Send initial connection message
      const encoder = new TextEncoder();
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to admin notifications' })}\n\n`));
      } catch (error) {
        console.error('Error sending initial SSE message:', error);
      }

      // Subscribe to admin notifications (using a special key for all admins)
      const subscriptionKey = 'admin:new-orders';
      const cleanup = subscribe(subscriptionKey, controller);
      console.log(`Subscribed to admin notifications for: ${subscriptionKey}`);

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
        console.log('SSE connection closed for admin notifications');
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
        console.log('Stream cleanup for admin notifications');
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
      console.log('Stream cancelled for admin notifications');
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

