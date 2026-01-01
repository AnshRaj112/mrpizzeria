// In-memory store for active SSE connections
// In production, consider using Redis for distributed systems
const subscribers = new Map<string, Set<ReadableStreamDefaultController>>();

export function subscribe(orderId: string, controller: ReadableStreamDefaultController) {
  if (!subscribers.has(orderId)) {
    subscribers.set(orderId, new Set());
  }
  subscribers.get(orderId)!.add(controller);

  // Clean up when connection closes
  const cleanup = () => {
    const controllers = subscribers.get(orderId);
    if (controllers) {
      controllers.delete(controller);
      if (controllers.size === 0) {
        subscribers.delete(orderId);
      }
    }
  };

  return cleanup;
}

export function notifyOrderUpdate(orderId: string, data: any) {
  const controllers = subscribers.get(orderId);
  if (!controllers || controllers.size === 0) {
    console.log(`No subscribers found for orderId: ${orderId}`);
    return;
  }

  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encodedMessage = new TextEncoder().encode(message);
  
  console.log(`Notifying ${controllers.size} subscriber(s) for orderId: ${orderId}`);
  
  // Send to all subscribers for this order
  const toRemove: ReadableStreamDefaultController[] = [];
  controllers.forEach((controller) => {
    try {
      controller.enqueue(encodedMessage);
    } catch (error) {
      // Connection closed, remove it
      console.error(`Error sending to subscriber for ${orderId}:`, error);
      toRemove.push(controller);
    }
  });

  // Remove closed connections
  toRemove.forEach((controller) => {
    controllers.delete(controller);
  });

  if (controllers.size === 0) {
    subscribers.delete(orderId);
  }
}

export function getSubscriberCount(orderId?: string): number {
  if (orderId) {
    return subscribers.get(orderId)?.size || 0;
  }
  // Return total subscribers across all orders
  let total = 0;
  subscribers.forEach((controllers) => {
    total += controllers.size;
  });
  return total;
}

