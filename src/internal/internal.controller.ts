import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('internal')
export class InternalController {
  constructor(private prisma: PrismaService) {}

  @Get('orders/success/:orderId')
  async getOrderForSuccessPage(@Param('orderId') orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: {
          include: { address: true }
        },
        participants: {
          include: { generatedTicket: true }
        },
        ticket: true
      }
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    return {
      success: true,
      order: {
        orderId: order.id,
        transactionId: order.razorpayPaymentId || order.daimoPaymentId || 'N/A',
        status: order.status,
        ticketType: order.ticket.title,
        quantity: order.participants.length,
        paymentMethod: order.paymentType === 'RAZORPAY' ? 'Credit/Debit Card' : 'Crypto (USDC)',
        purchaseDate: order.createdAt,
        totalAmount: order.amount,
        currency: order.currency,
        buyerEmail: order.buyer.email,
        buyerName: `${order.buyer.firstName} ${order.buyer.lastName}`,
        participants: order.participants.map(p => ({
          name: `${p.firstName} ${p.lastName}`,
          email: p.email,
          ticketCode: p.generatedTicket?.ticketCode || 'Pending'
        }))
      }
    };
  }
}