import { Injectable, BadRequestException, Logger } from '@nestjs/common';
// import { generateTicketCode } from '../utils/ticket.utils';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { RazorpayService } from './razorpay.service';
import { DaimoService } from './daimo.service';
import { PaymentType } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
    private daimoService: DaimoService,
    private ticketsService: TicketsService,
  ) {}

  // --------------------------------------------------
  // RAZORPAY ORDER
  // --------------------------------------------------
  async createRazorpayOrder(data: any) {
    const { ticketType, buyer, participants, quantity } = data;

    this.logger.log(
      `Creating Razorpay order | ticketType=${ticketType} | qty=${quantity}`,
    );

    const ticket = await this.prisma.ticket.findFirst({
      where: { type: ticketType },
    });

    if (!ticket) {
      this.logger.error(`Ticket not found | type=${ticketType}`);
      throw new BadRequestException('Ticket not found');
    }

    const totalAmount = ticket.fiat * quantity;

    this.logger.log(
      `Calculated Razorpay amount: ₹${totalAmount} (${ticket.fiat} × ${quantity})`,
    );

    // -------------------------------
    // Check for existing participant
    // -------------------------------
    const existingParticipant = await this.prisma.participant.findFirst({
      where: { email: buyer.email },
      include: { order: true },
    });

    if (existingParticipant && existingParticipant.order && !existingParticipant.order.paymentVerified) {
      // Update existing order
      const updatedRazorpayOrder = await this.razorpayService.createOrder(totalAmount);

      this.logger.log(
        `Updating existing order | orderId=${existingParticipant.order.id} | newRazorpayOrderId=${updatedRazorpayOrder.id}`,
      );

      const updatedOrder = await this.prisma.order.update({
        where: { id: existingParticipant.order.id },
        data: {
          razorpayOrderId: updatedRazorpayOrder.id,
          amount: totalAmount,
          ticket: { connect: { id: ticket.id } },
          buyer: {
            update: {
              firstName: buyer.firstName,
              lastName: buyer.lastName ?? null,
              email: buyer.email,
              address: {
                update: {
                  line1: buyer.address.line1,
                  line2: buyer.address.line2 ?? null,
                  city: buyer.address.city,
                  state: buyer.address.state,
                  country: buyer.address.country,
                  postalCode: buyer.address.postalCode,
                },
              },
            },
          },
          participants: {
            deleteMany: {}, // remove old participants
            create: participants.map((p) => ({
              firstName: p.firstName,
              lastName: p.lastName,
              email: p.email,
              isBuyer: p.isBuyer ?? false,
            })),
          },
        },
        include: { participants: true },
      });

      return {
        success: true,
        razorpayOrderId: updatedRazorpayOrder.id,
        amount: totalAmount,
        currency: 'INR',
        orderId: updatedOrder.id,
        order: updatedOrder,
      };
    }

    // -------------------------------
    // No existing participant/order → create new order
    // -------------------------------
    const razorpayOrder = await this.razorpayService.createOrder(totalAmount);

    // Save order in DB
    const order = await this.prisma.order.create({
      data: {
        razorpayOrderId: razorpayOrder.id,
        ticket: { connect: { id: ticket.id } },
        buyer: {
          create: {
            firstName: buyer.firstName,
            lastName: buyer.lastName ?? null,
            email: buyer.email,
            address: {
              create: {
                line1: buyer.address.line1,
                line2: buyer.address.line2 ?? null,
                city: buyer.address.city,
                state: buyer.address.state,
                country: buyer.address.country,
                postalCode: buyer.address.postalCode,
              },
            },
          },
        },
        amount: totalAmount,
        currency: 'INR',
        paymentType: PaymentType.RAZORPAY,
        participants: {
          create: participants.map((p) => ({
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            isBuyer: p.isBuyer ?? false,
          })),
        },
      },
      include: { participants: true },
    });

    this.logger.log(`Order saved | orderId=${order.id}`);

    return {
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
      currency: 'INR',
      orderId: order.id,
      order,
    };
  }

  // --------------------------------------------------
  // DAIMO ORDER
  // --------------------------------------------------
  async createDaimoOrder(data: any) {
    const { ticketType, buyer, participants, quantity } = data;

    this.logger.log(
      `Creating Daimo order | ticketType=${ticketType} | qty=${quantity}`,
    );

    const ticket = await this.prisma.ticket.findFirst({
      where: { type: ticketType },
    });
    if (!ticket) throw new BadRequestException('Ticket not found');

    // calculate total amount
    const totalAmount = ticket.crypto * quantity; //0.1

    this.logger.log(
      `Calculated Daimo amount: ${totalAmount} USDC (${ticket.crypto} × ${quantity})`,
    );

    // -------------------------------
    // Check for existing participant
    // -------------------------------
    const existingParticipant = await this.prisma.participant.findFirst({
      where: { email: buyer.email },
      include: { order: true },
    });

    if (existingParticipant && existingParticipant.order && !existingParticipant.order.paymentVerified) {
      // Update existing order
      const updatedDaimoOrder = await this.daimoService.createOrder(totalAmount);

      this.logger.log(
        `Updating existing Daimo order | orderId=${existingParticipant.order.id} | newPaymentId=${updatedDaimoOrder.paymentId}`,
      );

      const updatedOrder = await this.prisma.order.update({
        where: { id: existingParticipant.order.id },
        data: {
          daimoPaymentId: updatedDaimoOrder.paymentId,
          amount: totalAmount,
          ticket: { connect: { id: ticket.id } },
          buyer: {
            update: {
              firstName: buyer.firstName,
              lastName: buyer.lastName ?? null,
              email: buyer.email,
              address: {
                update: {
                  line1: buyer.address.line1,
                  line2: buyer.address.line2 ?? null,
                  city: buyer.address.city,
                  state: buyer.address.state,
                  country: buyer.address.country,
                  postalCode: buyer.address.postalCode,
                },
              },
            },
          },
          participants: {
            deleteMany: {},
            create: participants.map((p) => ({
              firstName: p.firstName,
              lastName: p.lastName,
              email: p.email,
              isBuyer: p.isBuyer ?? false,
            })),
          },
        },
        include: { participants: true },
      });

      return {
        success: true,
        paymentId: updatedDaimoOrder.paymentId,
        orderId: updatedOrder.id,
        order: updatedOrder,
      };
    }

    // -------------------------------
    // No existing participant/order → create new order
    // -------------------------------
    const daimoOrder = await this.daimoService.createOrder(totalAmount);

    this.logger.log(
      `Daimo order created | paymentId=${daimoOrder.paymentId}`,
    );

    const order = await this.prisma.order.create({
      data: {
        daimoPaymentId: daimoOrder.paymentId,
        ticket: { connect: { id: ticket.id } },
        buyer: {
          create: {
            firstName: buyer.firstName,
            lastName: buyer.lastName ?? null,
            email: buyer.email,
            address: {
              create: {
                line1: buyer.address.line1,
                line2: buyer.address.line2 ?? null,
                city: buyer.address.city,
                state: buyer.address.state,
                country: buyer.address.country,
                postalCode: buyer.address.postalCode,
              },
            },
          },
        },
        amount: totalAmount,
        currency: 'USDC',
        paymentType: PaymentType.DAIMO,
        participants: {
          create: participants.map((p) => ({
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            isBuyer: p.isBuyer ?? false,
          })),
        },
      },
      include: { participants: true },
    });

    this.logger.log(`Order saved | orderId=${order.id}`);

    return {
      success: true,
      paymentId: daimoOrder.paymentId,
      orderId: order.id,
      order,
    };
  }

  // --------------------------------------------------
  // VERIFY PAYMENT
  // --------------------------------------------------
  async verifyPayment(body: any) {
    this.logger.log(`Verifying payment | type=${body.paymentType}`);

    if (body.paymentType === 'DAIMO') {
      return await this.daimoService.verifyPayment(body.paymentId);
    }

    return this.verifySignature(body);
  }

  async verifySignature(body: any) {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    this.logger.log(
      `Verifying Razorpay signature | orderId=${razorpay_order_id}`,
    );

    const verifyResult = await this.razorpayService.verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!verifyResult.success) {
      this.logger.warn(
        `Razorpay verification failed | orderId=${razorpay_order_id}`,
      );
      return verifyResult;
    }

    const order = await this.prisma.order.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!order) {
      this.logger.error(
        `Order not found after payment | razorpayOrderId=${razorpay_order_id}`,
      );
      throw new BadRequestException('Order not found');
    }

    await this.prisma.order.update({
      where: { razorpayOrderId: razorpay_order_id },
      data: {
        paymentVerified: true,
        status: 'paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
    });

    this.logger.log(
      `Payment verified & order marked paid | orderId=${order.id}`,
    );

    this.logger.log(`Generating tickets | orderId=${order.id}`);
    await this.ticketsService.generateTicketsForOrder(order.id);

    return verifyResult;
  }
}
