import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { RazorpayService } from './razorpay.service';
import { DaimoService } from './daimo.service';
import { PaymentType } from '@prisma/client';

@Injectable()
export class PaymentsService {
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
    const { ticketType, buyer, participants, quantity } =
      data;

    this.logger.log(
      `[Razorpay] Creating order | ticketType=${ticketType} | qty=${quantity} `,
    );

    const ticket = await this.prisma.ticket.findFirst({
      where: { title: ticketType },
    });

    if (!ticket) {
      this.logger.error(`[Razorpay] Ticket not found | type=${ticketType}`);
      throw new BadRequestException('Ticket not found');
    }

    const totalAmount = ticket.fiat * quantity;
    this.logger.log(`[Razorpay] Total amount calculated: ₹${totalAmount}`);

    const buyerEmail =
      participants.find((p) => p.isBuyer)?.email || buyer.email;

    if (!buyerEmail) {
      this.logger.error('[Razorpay] Buyer email not found');
      throw new BadRequestException('Buyer email not found');
    }

    this.logger.log(`[Razorpay] Checking for existing participant | email=${buyerEmail}`);
    const existingParticipant = await this.prisma.participant.findUnique({
      where: { email: buyerEmail },
      include: { order: true },
    });

    if (existingParticipant) {
      const order = existingParticipant.order;
      this.logger.log(
        `[Razorpay] Existing participant found | participantId=${existingParticipant.id} | orderId=${order.id}`,
      );

      if (order.paymentVerified) {
        this.logger.warn(`[Razorpay] Payment already verified for this email`);
        throw new BadRequestException(
          'This email has already been used to purchase a ticket',
        );
      }

      this.logger.log(`[Razorpay] Creating new Razorpay order for existing unpaid order`);
      const razorpayOrder = await this.razorpayService.createOrder(totalAmount);

      this.logger.log(`[Razorpay] Updating existing order | orderId=${order.id} | razorpayOrderId=${razorpayOrder.id}`);
      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          razorpayOrderId: razorpayOrder.id,
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
      });

      this.logger.log(`[Razorpay] Existing order updated successfully | orderId=${updatedOrder.id}`);

      return {
        success: true,
        razorpayOrderId: razorpayOrder.id,
        amount: totalAmount,
        currency: 'INR',
        orderId: updatedOrder.id,
      };
    }

    this.logger.log(`[Razorpay] No existing participant found, creating new order`);
    const razorpayOrder = await this.razorpayService.createOrder(totalAmount);

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
    });

    this.logger.log(`[Razorpay] New order created successfully | orderId=${order.id}`);

    return {
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
      currency: 'INR',
      orderId: order.id,
    };
  }

  // --------------------------------------------------
  // DAIMO ORDER
  // --------------------------------------------------
  async createDaimoOrder(data: any) {
    const { ticketType, buyer, participants, quantity } = data;

    this.logger.log(`[Daimo] Creating order | ticketType=${ticketType} | qty=${quantity}`);

    const ticket = await this.prisma.ticket.findFirst({
      where: { title: ticketType },
    });
    if (!ticket) {
      this.logger.error('[Daimo] Ticket not found');
      throw new BadRequestException('Ticket not found');
    }

    const totalAmount = ticket.crypto * quantity;
    this.logger.log(`[Daimo] Total amount calculated: ${totalAmount} USDC`);

    const buyerEmail =
      participants.find((p) => p.isBuyer)?.email || buyer.email;

    if (!buyerEmail) {
      this.logger.error('[Daimo] Buyer email not found');
      throw new BadRequestException('Buyer email not found');
    }

    this.logger.log(`[Daimo] Checking for existing participant | email=${buyerEmail}`);
    const existingParticipant = await this.prisma.participant.findUnique({
      where: { email: buyerEmail },
      include: { order: true },
    });

    if (existingParticipant) {
      const order = existingParticipant.order;
      this.logger.log(
        `[Daimo] Existing participant found | participantId=${existingParticipant.id} | orderId=${order.id}`,
      );

      if (order.paymentVerified) {
        this.logger.warn('[Daimo] Payment already verified for this email');
        throw new BadRequestException(
          'This email has already been used to purchase a ticket',
        );
      }

      this.logger.log(`[Daimo] Creating new Daimo order for existing unpaid order`);
      const daimoOrder = await this.daimoService.createOrder(totalAmount);

      this.logger.log(`[Daimo] Updating existing order | orderId=${order.id} | daimoPaymentId=${daimoOrder.paymentId}`);
      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          daimoPaymentId: daimoOrder.paymentId,
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
      });

      this.logger.log(`[Daimo] Existing order updated successfully | orderId=${updatedOrder.id}`);

      return {
        success: true,
        paymentId: daimoOrder.paymentId,
        orderId: updatedOrder.id,
      };
    }

    this.logger.log('[Daimo] No existing participant found, creating new order');
    const daimoOrder = await this.daimoService.createOrder(totalAmount);

    this.logger.log(`Daimo order created | paymentId=${daimoOrder.paymentId}`);

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
        currency: 'USD',
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
    });

    this.logger.log(`[Daimo] New order created successfully | orderId=${order.id}`);

    return {
      success: true,
      paymentId: daimoOrder.paymentId,
      orderId: order.id,
    };
  }

  // --------------------------------------------------
  // VERIFY PAYMENT (unchanged)
  // --------------------------------------------------
  async verifyPayment(body: any) {
    this.logger.log(`[VerifyPayment] Verifying payment | type=${body.paymentType}`);
    if (body.paymentType === 'DAIMO') {
      return await this.daimoService.verifyPayment(body.paymentId);
    }
    return this.verifySignature(body);
  }

  async verifySignature(body: any) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    this.logger.log(
      `Verifying Razorpay signature | orderId=${razorpay_order_id}`,
    );

    const verifyResult = await this.razorpayService.verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!verifyResult.success) {
      this.logger.warn(`[Razorpay] Signature verification failed | orderId=${razorpay_order_id}`);
      return verifyResult;
    }

    const order = await this.prisma.order.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!order) {
      this.logger.error(`[Razorpay] Order not found after payment | razorpayOrderId=${razorpay_order_id}`);
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

    this.logger.log(`[Razorpay] Payment verified & order marked paid | orderId=${order.id}`);
    this.logger.log(`[Tickets] Generating tickets | orderId=${order.id}`);
    await this.ticketsService.generateTicketsForOrder(order.id);
    //generate Invoice for order
    return verifyResult;
  }
}
