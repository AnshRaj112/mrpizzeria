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
    `${item.name} x${item.quantity} - Rs ${(item.price * item.quantity).toFixed(2)}`
  ).join('\n');
}

/**
 * Get customer title (Mr./Mrs.) - simple heuristic based on name
 */
function getCustomerTitle(name: string): string {
  if (!name) return 'Mr./Mrs.';
  
  const trimmedName = name.trim().toLowerCase();
  // Common female name endings in Indian names
  const femaleEndings = ['a', 'i', 'ee', 'ya', 'iya'];
  const lastChar = trimmedName.slice(-1);
  
  // Simple heuristic: if name ends with common female endings, use Mrs., otherwise Mr.
  if (femaleEndings.includes(lastChar) && trimmedName.length > 2) {
    return 'Mrs.';
  }
  return 'Mr.';
}

/**
 * Send order confirmation SMS with detailed bill
 */
export async function sendOrderConfirmationSMS(
  contactNumber: string,
  customerName: string,
  orderNumber: string,
  items: Array<{ name: string; quantity: number; price: number }>,
  subtotal: number,
  deliveryCharge: number,
  packingCharge: number,
  total: number,
  orderType: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const itemsText = formatOrderItems(items);
  const orderTypeFormatted = orderType.charAt(0).toUpperCase() + orderType.slice(1).replace('-', ' ');
  
  let chargesText = '';
  if (deliveryCharge > 0) {
    chargesText += `Delivery Charge: Rs ${deliveryCharge.toFixed(2)}\n`;
  }
  if (packingCharge > 0) {
    chargesText += `Packing Charge: Rs ${packingCharge.toFixed(2)}\n`;
  }
  
  const text = `🍕 Mr. Pizzeria - Order Confirmation

Dear ${customerName},

Your order #${orderNumber} has been confirmed!

Order Type: ${orderTypeFormatted}

Items:
${itemsText}

Subtotal: Rs ${subtotal.toFixed(2)}
${chargesText}Total: Rs ${total.toFixed(2)}

We'll notify you when your order is ready.

Thank you for choosing Mr. Pizzeria!`;

  return await sendSMS(contactNumber, text);
}

/**
 * Send order prepared SMS
 */
export async function sendOrderPreparedSMS(
  contactNumber: string,
  customerName: string,
  orderNumber: string,
  orderType: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const title = getCustomerTitle(customerName);
  
  let message = '';
  if (orderType === 'delivery') {
    message = `${title} ${customerName}, your order #${orderNumber} is out for delivery.`;
  } else {
    message = `${title} ${customerName}, your order #${orderNumber} is prepared please take it.`;
  }
  
  const text = `✅ ${message}

Thank you for choosing Mr. Pizzeria!`;

  return await sendSMS(contactNumber, text);
}

/**
 * Send order delivered SMS
 */
export async function sendOrderDeliveredSMS(
  contactNumber: string,
  customerName: string,
  orderNumber: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const title = getCustomerTitle(customerName);
  
  const text = `🎉 ${title} ${customerName}, your order #${orderNumber} has been completed!

Thank you for using our service at Mr. Pizzeria. We hope you enjoyed your meal and look forward to serving you again soon!

Your satisfaction is our priority. Have a great day!`;

  return await sendSMS(contactNumber, text);
}

