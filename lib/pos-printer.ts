/**
 * POS Printer Utility
 * 
 * This module handles automatic printing of receipts to POS printers.
 * 
 * Configuration:
 * - USB Printers: Automatically detects common POS printer brands (Epson, Star Micronics, Bixolon, etc.)
 * - Network Printers: Set environment variables:
 *   - POS_PRINTER_IP: IP address of the network printer
 *   - POS_PRINTER_PORT: Port number (default: 9100)
 * 
 * The printer will automatically print receipts when orders are successfully created.
 * If printing fails, the order will still be saved (printing errors are logged but don't fail the order).
 */

import escpos from 'escpos';
import * as net from 'net';

// Try to import USB modules, but make them optional
let escposUSB: any = null;
let usb: any = null;
let usbAvailable = false;

try {
  escposUSB = require('escpos-usb');
  usb = require('usb');
  // Configure escpos to use USB only if available
  escpos.USB = escposUSB;
  usbAvailable = true;
} catch (error) {
  console.warn('USB printer support not available. USB modules not loaded:', error);
  usbAvailable = false;
}

interface OrderData {
  dailyOrderId: number;
  orderDate: string;
  customerName: string;
  contactNumber: string;
  orderType: 'takeaway' | 'dine-in' | 'delivery';
  deliveryAddress?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  deliveryCharge: number;
  packingCharge: number;
  total: number;
  paymentId?: string;
  razorpayOrderId?: string;
  paymentMethod?: string;
}

/**
 * Find and connect to the first available USB printer
 */
function findUSBPrinter(): any | null {
  if (!usbAvailable || !usb) {
    return null;
  }
  
  try {
    const devices = usb.getDeviceList();
    // Filter for common POS printer vendor IDs
    // Common POS printer vendors: Epson (0x04b8), Star Micronics (0x0519), Bixolon (0x1504)
    const printerVendors = [0x04b8, 0x0519, 0x1504, 0x0483, 0x03f0];
    
    for (const device of devices) {
      if (printerVendors.includes(device.deviceDescriptor.idVendor)) {
        return device;
      }
    }
    
    // If no known vendor found, try to use the first USB device
    // This is a fallback - user should configure printer name/IP in production
    if (devices.length > 0) {
      console.log('Using first available USB device as printer');
      return devices[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error finding USB printer:', error);
    return null;
  }
}

/**
 * Print receipt to POS printer
 */
export async function printReceipt(orderData: OrderData): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    try {
      // Try to find USB printer (only if USB is available)
      const device = findUSBPrinter();
      
      if (!device) {
        // Fallback: Try network printer if configured
        const printerIP = process.env.POS_PRINTER_IP;
        const printerPort = process.env.POS_PRINTER_PORT || '9100';
        
        if (printerIP) {
          return printToNetworkPrinter(orderData, printerIP, parseInt(printerPort))
            .then(resolve)
            .catch((error) => {
              console.error('Network printer error:', error);
              resolve({ success: false, message: 'Failed to print: ' + error.message });
            });
        }
        
        // No printer available - this is okay, just log and return success
        console.log('No printer available. Receipt not printed. Order saved successfully.');
        resolve({ 
          success: true, 
          message: 'Order saved successfully. No printer configured.' 
        });
        return;
      }

      // Create printer instance
      const printer = new escpos.Printer(device);
      
      // Format and print receipt
      formatAndPrintReceipt(printer, orderData, () => {
        printer.close();
        resolve({ success: true, message: 'Receipt printed successfully' });
      });
      
    } catch (error: any) {
      console.error('Error printing receipt:', error);
      // Don't fail the order if printing fails - just log the error
      resolve({ 
        success: true, 
        message: 'Order saved successfully. Print error: ' + (error.message || 'Unknown error') 
      });
    }
  });
}

/**
 * Print to network printer (TCP/IP)
 */
async function printToNetworkPrinter(
  orderData: OrderData, 
  ip: string, 
  port: number
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve, reject) => {
    try {
      const client = new net.Socket();
      
      client.connect(port, ip, () => {
        const printer = new escpos.Printer(client);
        formatAndPrintReceipt(printer, orderData, () => {
          client.end();
          resolve({ success: true, message: 'Receipt printed successfully' });
        });
      });
      
      client.on('error', (error: Error) => {
        reject(error);
      });
      
      client.setTimeout(5000);
      client.on('timeout', () => {
        client.destroy();
        reject(new Error('Connection timeout'));
      });
    } catch (error: any) {
      reject(error);
    }
  });
}

/**
 * Format and print the receipt content
 */
function formatAndPrintReceipt(
  printer: any, 
  orderData: OrderData, 
  callback: () => void
) {
  try {
    // Header
    printer
      .font('a')
      .align('ct')
      .style('bu')
      .size(1, 1)
      .text('MR. PIZZERIA')
      .text('--------------------------------')
      .text('Order Receipt')
      .text('--------------------------------')
      .feed(1);

    // Order Information
    printer
      .align('lt')
      .text(`Order #: ${orderData.dailyOrderId}`)
      .text(`Date: ${new Date(orderData.orderDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`)
      .text(`Type: ${orderData.orderType.toUpperCase()}`)
      .feed(1);

    // Customer Information
    printer
      .text('--------------------------------')
      .text('CUSTOMER DETAILS')
      .text('--------------------------------')
      .text(`Name: ${orderData.customerName}`)
      .text(`Contact: ${orderData.contactNumber}`);
    
    if (orderData.deliveryAddress) {
      printer.text(`Address: ${orderData.deliveryAddress}`);
    }
    
    printer.feed(1);

    // Order Items
    printer
      .text('--------------------------------')
      .text('ITEMS')
      .text('--------------------------------');
    
    orderData.items.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      const itemLine = `${item.name} x${item.quantity}`;
      const priceLine = `Rs ${itemTotal.toFixed(2)}`;
      
      printer
        .text(itemLine)
        .text(`  ${priceLine}`)
        .feed(1);
    });

    // Price Breakdown
    printer
      .text('--------------------------------')
      .align('lt')
      .text(`Subtotal:        Rs ${orderData.subtotal.toFixed(2)}`);
    
    if (orderData.deliveryCharge > 0) {
      printer.text(`Delivery:        Rs ${orderData.deliveryCharge.toFixed(2)}`);
    }
    
    if (orderData.packingCharge > 0) {
      printer.text(`Packing:         Rs ${orderData.packingCharge.toFixed(2)}`);
    }
    
    printer
      .text('--------------------------------')
      .style('bu')
      .size(1, 1)
      .text(`TOTAL:           Rs ${orderData.total.toFixed(2)}`)
      .style('normal')
      .size(1, 1)
      .feed(1);

    // Payment Information
    printer
      .text('--------------------------------')
      .text('PAYMENT')
      .text('--------------------------------')
      .text('Status: SUCCESS');
    
    if (orderData.paymentMethod) {
      printer.text(`Method: ${orderData.paymentMethod.toUpperCase()}`);
    }
    
    if (orderData.paymentId) {
      printer.text(`Payment ID: ${orderData.paymentId.substring(0, 20)}...`);
    }
    
    printer.feed(1);

    // Footer
    printer
      .align('ct')
      .text('--------------------------------')
      .text('Thank you for your order!')
      .text('Visit us again!')
      .text('--------------------------------')
      .feed(2)
      .cut()
      .close(callback);
      
  } catch (error) {
    console.error('Error formatting receipt:', error);
    callback();
  }
}

