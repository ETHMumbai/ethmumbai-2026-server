import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';


@Controller('internal')
// @UseGuards(AdminGuard)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // --- Participants ---

  @Get('participants')
  async getAllParticipants() {
    return this.prisma.participant.findMany({
      include: { generatedTicket: true, order: true },
      orderBy: { id: 'desc' },
    });
  }

  @Get('participants/:id/tickets')
  async getTicketsForParticipant(@Param('id') id: string) {
    const tickets = await this.prisma.generatedTicket.findMany({
      where: { participantId: id },
    });
    if (!tickets.length)
      throw new BadRequestException('No tickets found for this participant');
    return tickets;
  }

  // --- Orders ---

  @Get('orders')
  async getAllOrders() {
    return this.prisma.order.findMany({
      include: { participants: { include: { generatedTicket: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('orders/buyer/:email')
  async getOrderByBuyer(@Param('email') email: string) {
    return this.prisma.order.findMany({
      where: { buyerEmail: email },
      include: { participants: { include: { generatedTicket: true } } },
    });
  }

  @Get('orders/participant/:participantId')
  async getOrderByParticipant(@Param('participantId') participantId: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: { order: true, generatedTicket: true },
    });
    if (!participant) throw new BadRequestException('Participant not found');
    return {
      participant,
      order: participant.order,
      ticket: participant.generatedTicket,
    };
  }

  @Get('orders/success/:orderId')
  async getOrderForSuccessPage(@Param('orderId') orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
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
        paymentMethod: order.paymentType,
        purchaseDate: order.createdAt,
        totalAmount: order.amount,
        currency: order.currency,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        participants: order.participants.map(p => ({
          name: p.name,
          email: p.email,
          ticketCode: p.generatedTicket?.ticketCode || 'Pending'
        }))
      }
    };
  }

  // --- Transactions ---

  @Get('transactions')
  async getAllTransactions() {
    return this.prisma.order.findMany({
      where: { status: { in: ['paid', 'completed', 'success'] } },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentType: true,
        razorpayPaymentId: true,
        daimoPaymentId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Emails ---

  @Post('email/buyer/:orderId')
  async resendBuyerEmail(@Param('orderId') orderId: string) {
    await this.mailService.sendBuyerEmail(orderId);
    return { success: true, message: 'Buyer email resent' };
  }

  @Post('email/participants/:orderId')
  async resendParticipantEmails(@Param('orderId') orderId: string) {
    await this.mailService.sendParticipantEmails(orderId);
    return { success: true, message: 'Participant emails resent' };
  }
}
