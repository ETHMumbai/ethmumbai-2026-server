import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private prisma: PrismaService) {}

  async generateInvoice(orderId: string): Promise<string> {
    try {
      this.logger.log(`Starting invoice generation for order: ${orderId}`);

      // 1. Fetch order data from database
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          buyer: {
            include: { address: true }
          },
          ticket: true,
          participants: true,
        },
      });

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (!order.buyer || !order.buyer.address) {
        throw new Error(`Buyer or address not found for order: ${orderId}`);
      }

      this.logger.log(`Order found for buyer: ${order.buyer.email}`);

      // 2. Generate invoice number (using timestamp)
      const invoiceNumber = `ETHM${String(order.createdAt.getTime()).slice(-6)}`;

      // 3. Create invoices directory if doesn't exist
      const invoicesDir = path.join(process.cwd(), 'invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
        this.logger.log(`Created invoices directory: ${invoicesDir}`);
      }

      const invoicePath = path.join(invoicesDir, `${orderId}.pdf`);

      // 4. Create PDF document
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: `Invoice ${invoiceNumber}`,
          Author: 'ETHMumbai',
        }
      });

      // Pipe to file
      const writeStream = fs.createWriteStream(invoicePath);
      doc.pipe(writeStream);

      // 5. Add content to PDF (matching Canva design)
      
      // Header - INVOICE text
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .text('INVOICE', 50, 50);

      // Invoice number and date (right side)
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Invoice No: ${invoiceNumber}`, 400, 80, { align: 'right' })
         .text(`Date: ${order.createdAt.toLocaleDateString('en-GB', {
           day: 'numeric',
           month: 'long', 
           year: 'numeric'
         })}`, 400, 100, { align: 'right' });

      // Move down
      doc.moveDown(3);

      // Billed To section
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('BILLED TO:', 50, 150);

      const address = order.buyer.address;
      
      doc.fontSize(11)
         .font('Helvetica')
         .text(`${order.buyer.firstName} ${order.buyer.lastName}`, 50, 170)
         .text(address.line1, 50, 185);

      let currentY = 200;
      if (address.line2) {
        doc.text(address.line2, 50, currentY);
        currentY += 15;
      }

      doc.text(`${address.city}, ${address.state} ${address.postalCode}`, 50, currentY)
         .text(address.country, 50, currentY + 15);

      // Table Header
      doc.moveDown(3);
      const tableTop = 280;
      
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('DESCRIPTION', 50, tableTop)
         .text('QTY', 300, tableTop)
         .text('PRICE', 380, tableTop)
         .text('TOTAL', 480, tableTop, { align: 'right' });

      // Line under header
      doc.moveTo(50, tableTop + 20)
         .lineTo(545, tableTop + 20)
         .stroke();

      // Table content
      const itemY = tableTop + 35;
      const currency = order.currency === 'INR' ? '₹' : '$';
      const pricePerTicket = order.currency === 'INR' ? order.ticket.fiat : order.ticket.crypto;

      doc.fontSize(11)
         .font('Helvetica')
         .text(`ETHMumbai Conference - ${order.ticket.title}`, 50, itemY, { width: 200 })
         .text(order.participants.length.toString(), 300, itemY)
         .text(`${currency}${pricePerTicket}`, 380, itemY)
         .text(`${currency}${order.amount}`, 480, itemY, { align: 'right' });

      // Summary section
      const summaryTop = itemY + 80;
      
      doc.moveTo(50, summaryTop - 10)
         .lineTo(545, summaryTop - 10)
         .stroke();

      const subtotal = order.amount;
      const discount = 0;

      doc.fontSize(11)
         .font('Helvetica')
         .text('SUB TOTAL', 350, summaryTop)
         .text(`${currency}${subtotal}`, 480, summaryTop, { align: 'right' });

      doc.text('DISCOUNT', 350, summaryTop + 20)
         .text(`${currency}${discount}`, 480, summaryTop + 20, { align: 'right' });

      // Total
      doc.moveTo(350, summaryTop + 45)
         .lineTo(545, summaryTop + 45)
         .stroke();

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('TOTAL', 350, summaryTop + 55)
         .text(`${currency}${order.amount}`, 480, summaryTop + 55, { align: 'right' });

      // Tax breakdown (only for INR)
      if (order.currency === 'INR') {
        const taxTop = summaryTop + 100;
        const excludingGST = (order.amount / 1.18).toFixed(2);
        const cgst = (parseFloat(excludingGST) * 0.09).toFixed(2);
        const sgst = (parseFloat(excludingGST) * 0.09).toFixed(2);

        doc.fontSize(10)
           .font('Helvetica')
           .text('EXCLUDING GST', 350, taxTop)
           .text(`₹${excludingGST}`, 480, taxTop, { align: 'right' })
           .text('CGST 9%', 350, taxTop + 15)
           .text(`₹${cgst}`, 480, taxTop + 15, { align: 'right' })
           .text('SGST 9%', 350, taxTop + 30)
           .text(`₹${sgst}`, 480, taxTop + 30, { align: 'right' });
      }

      // Payment method
      const paymentMethodY = order.currency === 'INR' ? summaryTop + 200 : summaryTop + 130;
      
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Payment Method:', 50, paymentMethodY);

      doc.font('Helvetica')
         .text(
           order.paymentType === 'RAZORPAY' 
             ? 'Credit/Debit Card (Razorpay)' 
             : 'Crypto (DaimoPay)',
           50, 
           paymentMethodY + 20
         );

      // Footer
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#E2231A')
         .text('See you at the BEST Ethereum Conference', 50, 700, { 
           align: 'center',
           width: 495
         });

      // Finalize PDF
      doc.end();

      // Wait for PDF to be written
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', (err) => reject(err));
      });

      this.logger.log(`Invoice generated successfully: ${invoicePath}`);
      return invoicePath;

    } catch (error) {
      this.logger.error(`Failed to generate invoice for order ${orderId}:`, error);
      throw error;
    }
  }
}