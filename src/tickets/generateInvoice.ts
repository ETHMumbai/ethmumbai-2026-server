import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateInvoicePDFBuffer,
  InvoiceData,
} from '../utils/generateInvoicePdf';
import { generateInvoiceNumberForOrder } from 'src/utils/ticket.utils';
@Injectable()
export class InvoiceService {
  constructor(private prisma: PrismaService) {}
  private async buildInvoiceData(
    order: any, // Prisma order with includes
  ): Promise<InvoiceData> {
    const buyer = order.buyer;
    const address = buyer.address;
    const ticket = order.ticket;

    return {
      invoiceNo: order.invoiceNumber,
      date: order.createdAt.toDateString(),

      billedTo: {
        name: `${buyer.firstName} ${buyer.lastName}`,
        addressLine1: address?.line1 || '',
        city: address?.city || '',
        state: address?.state || '',
        pincode: address?.postalCode || '',
      },

      item: {
        description: ticket.title,
        quantity: order.participants.length,
        price: ticket.fiat,
      },

      discount: 0,
      gstRate: 18,

      paymentMethod:
        order.paymentType === 'RAZORPAY'
          ? 'INR (Razorpay)'
          : 'Crypto',
    };
  }

  async generateInvoiceForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { include: { address: true } },
        ticket: true,
        participants: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (order.invoiceNumber) {
      const invoiceData = await this.buildInvoiceData(order);
      return generateInvoicePDFBuffer(invoiceData);
    }

    const invoiceNo = await generateInvoiceNumberForOrder(
      this.prisma,
      orderId,
    );

    const invoiceData = await this.buildInvoiceData({
      ...order,
      invoiceNumber: invoiceNo,
    });

    return generateInvoicePDFBuffer(invoiceData);
  }
}
