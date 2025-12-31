import { Vonage } from '@vonage/server-sdk';

// Initialize Vonage client
const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY || "55a870d8",
  apiSecret: process.env.VONAGE_API_SECRET || "", // Should be set in environment variables
});

const FROM_NUMBER = process.env.VONAGE_FROM_NUMBER || "Vonage APIs";

/**
 * Send SMS using Vonage
 */
export async function sendSMS(to: string, text: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Ensure phone number is in correct format (remove any spaces, dashes, etc.)
    const cleanPhoneNumber = to.replace(/\D/g, '');
    
    // If number doesn't start with country code, assume it's Indian number and add 91
    const phoneNumber = cleanPhoneNumber.startsWith('91') ? cleanPhoneNumber : `91${cleanPhoneNumber}`;

    const response = await vonage.sms.send({ to: phoneNumber, from: FROM_NUMBER, text });
    
    console.log('SMS sent successfully:', response);
    return { success: true, message: 'SMS sent successfully' };
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

/**
 * Format order items for SMS
 */
export function formatOrderItems(items: Array<{ name: string; quantity: number; price: number }>): string {
  return items.map(item => 
    `• ${item.name} x${item.quantity} - Rs ${(item.price * item.quantity).toFixed(2)}`
  ).join('\n');
}

/**
 * Send order confirmation SMS
 */
export async function sendOrderConfirmationSMS(
  contactNumber: string,
  orderNumber: string,
  items: Array<{ name: string; quantity: number; price: number }>,
  total: number,
  orderType: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const itemsText = formatOrderItems(items);
  const text = `🍕 Order Confirmation - Mr. Pizzeria

Order #${orderNumber}
Type: ${orderType.charAt(0).toUpperCase() + orderType.slice(1)}

Items:
${itemsText}

Total: Rs ${total.toFixed(2)}

Thank you for your order! We'll notify you when your order is ready.`;

  return await sendSMS(contactNumber, text);
}

/**
 * Send order prepared SMS
 */
export async function sendOrderPreparedSMS(
  contactNumber: string,
  orderNumber: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const text = `✅ Your order #${orderNumber} is ready!

Thank you for choosing Mr. Pizzeria. Your order has been prepared and will be delivered/picked up soon.`;

  return await sendSMS(contactNumber, text);
}

/**
 * Send order delivered SMS
 */
export async function sendOrderDeliveredSMS(
  contactNumber: string,
  orderNumber: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const text = `🎉 Your order #${orderNumber} has been delivered!

Thank you for choosing Mr. Pizzeria. We hope you enjoyed your meal! Please visit us again.`;

  return await sendSMS(contactNumber, text);
}

