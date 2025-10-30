import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from './razorpay.service';
import { PaymentType } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
  ) {}

  async createRazorpayOrder(data: any) {
    const { ticketId, buyerName, buyerEmail, buyerPhone, participants, quantity } = data;

    // 1️⃣ Fetch the ticket
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    // 2️⃣ Calculate total amount
    const totalAmount = ticket.price * quantity;

    // 3️⃣ Create order in Razorpay
    const razorpayOrder = await this.razorpayService.createOrder(totalAmount);

    // 4️⃣ Save order in DB
    const order = await this.prisma.order.create({
      data: {
        razorpayOrderId: razorpayOrder.id,
        ticketId,
        buyerName,
        buyerEmail,
        buyerPhone,
        amount: totalAmount,
        paymentType: PaymentType.RAZORPAY,
        participants: {
          create: participants.map((p) => ({
            name: p.name,
            email: p.email,
            isBuyer: p.isBuyer ?? false,
          })),
        },
      },
      include: { participants: true },
    });

    // 5️⃣ Return combined response
    return {
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
      currency: 'INR',
      order,
    };
  }
}
