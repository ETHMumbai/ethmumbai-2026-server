// tickets.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';
import { generateTicketPDFBuffer } from './generateTicket';
import {
  getPngBufferFromDataUrl,
  savePngFromDataUrl,
} from 'src/utils/handle-png';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  private async generateTicketCode(): Promise<string> {
    while (true) {
      const code = crypto
        .randomBytes(4)
        .toString('hex')
        .substring(0, 6)
        .toUpperCase();

      const exists = await this.prisma.generatedTicket.findUnique({
        where: { ticketCode: code },
      });

      if (!exists) return code;
    }
  }

  async generateTicketsForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { participants: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    const ticketQty = order.participants.length;

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        isActive: true,
        remainingQuantity: { gt: 0 },
      },
      orderBy: { priority: 'asc' },
    });

    if (!ticket || ticket.remainingQuantity < ticketQty) {
      throw new BadRequestException('Tickets sold out');
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        remainingQuantity: {
          decrement: ticketQty,
        },
      },
    });

    const pdfMap = new Map<string, Buffer>();

    await Promise.all(
      order.participants.map(async (participant) => {
        const ticketCode = await this.generateTicketCode();

        const { ticketUrl, qrHash } =
          await this.generateQRforTicket(ticketCode);

        await this.prisma.generatedTicket.create({
          data: {
            ticketCode,
            participantId: participant.id,
            qrHash,
            qrUrl: ticketUrl,
            orderId: order.id,
          },
        });

        // QR AS BUFFER ONLY
        const qrImageBuffer = await QRCode.toBuffer(ticketUrl, {
          width: 220,
          errorCorrectionLevel: 'M',
        });

        // PDF BUFFER
        const pdfBuffer = await generateTicketPDFBuffer({
          name: participant.firstName || 'Participant',
          ticketId: ticketCode,
          qrImage: qrImageBuffer,
        });

        pdfMap.set(ticketCode, pdfBuffer);
        // convert dataURL → PNG file (example path)
        // const filePath = `./qr/tickets/${ticketCode}.png`;

        // Get PNG buffer for QR image
        // getPngBufferFromDataUrl(dataUrl);

        //save QR as PNG
        // savePngFromDataUrl(dataUrl, filePath);

        //for validation in dev with x-scanner-key
        console.log(ticketUrl);
      }),
    );

    // SEND ALL PARTICIPANT PDFs
    await this.mailService.sendParticipantEmails(orderId, pdfMap);

    // SEND BUYER CONFIRMATION
    await this.mailService.sendBuyerEmail(orderId);

    await this.prisma.ticket.update({
      where: { id: order.ticketId },
      data: {
        quantity: { decrement: order.participants.length },
      },
    });
  }

  async generateQRforTicket(ticketCode: string) {
    const qrHash = crypto.createHash('sha256').update(ticketCode).digest('hex');

    const ticketUrl = `${
      process.env.APP_BASE_URL || 'https://www.ethmumbai.in'
    }/t/${ticketCode}`;

    return { ticketUrl, qrHash };
  }

  async getOrderStatusByUsers(users: { email: string }[]) {
    if (!users?.length) {
      throw new BadRequestException('User list is required');
    }

    const emails = users.map((u) => u.email);

    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          {
            participants: {
              some: {
                email: { in: emails },
              },
            },
          },
          {
            buyer: {
              email: { in: emails },
            },
          },
        ],
      },
      select: {
        id: true,
        status: true,
        paymentVerified: true,
        paymentType: true,
        amount: true,
        currency: true,
        createdAt: true,

        buyer: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },

        participants: {
          where: {
            email: { in: emails },
          },
          select: {
            email: true,
            firstName: true,
            lastName: true,
            emailSent: true,
            generatedTicket: {
              select: {
                ticketCode: true,
                checkedIn: true,
              },
            },
          },
        },
      },
    });

    return {
      inputCount: users.length,
      matchedOrders: orders.length,
      orders,
    };
  }

  async generateAndSendTicketForParticipant(input: {
    firstName?: string;
    email: string;
  }) {
    const { firstName, email } = input;

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const pdfMap = new Map<string, Buffer>();

    // 1. Generate ticket code
    const ticketCode = await this.generateTicketCode();

    // 2. Generate QR
    const { ticketUrl, qrHash } = await this.generateQRforTicket(ticketCode);

    // 3. Generate QR image buffer
    const qrImageBuffer = await QRCode.toBuffer(ticketUrl, {
      width: 220,
      errorCorrectionLevel: 'M',
    });

    // 4. Generate PDF buffer
    const pdfBuffer = await generateTicketPDFBuffer({
      name: firstName || 'Participant',
      ticketId: ticketCode,
      qrImage: qrImageBuffer,
    });

    // 5. Store in pdfMap
    pdfMap.set(ticketCode, pdfBuffer);

    // 6. Send email (NO DB CHECKS / UPDATES)
    await this.mailService.sendSingleParticipantEmail(
      {
        firstName,
        email,
        ticketCode,
      },
      pdfMap,
    );

    return {
      status: 'SUCCESS',
      email,
      ticketCode,
      ticketUrl,
      qrHash,
    };
  }

  async verifyAndMark(token: string) {
    if (!token) throw new BadRequestException('token required');

    const qrHash = crypto.createHash('sha256').update(token).digest('hex');

    const ticket = await this.prisma.generatedTicket.findFirst({
      where: { qrHash },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.checkedIn) {
      return { ok: false, reason: 'Participant is already checked in' };
    }

    const result = await this.prisma.generatedTicket.update({
      where: { qrHash, checkedIn: false },
      data: { checkedIn: true },
    });

    if (result) {
      //get ticket type and buyer info
      const orderInfo = await this.prisma.order.findFirst({
        where: { id: result.orderId },
        include: {
          buyer: true,
        },
      });
      const ticketType = await this.prisma.ticket.findFirst({
        where: { id: orderInfo?.ticketId },
      });
      // get participant info
      const p = await this.prisma.participant.findFirst({
        where: { id: result.participantId },
      });
      if (!p) throw new NotFoundException('Invalid token');
      return {
        participantName: p?.firstName || 'Participant',
        ticketTypeTitle: ticketType?.title || 'Ticket',
        buyerName: orderInfo?.buyer.firstName || 'Buyer',
      };
    }
  }

  async getTicketCount(ticketType: string) {
    // Total earlybird tickets available
    const ticket = await this.prisma.ticket.findFirst({
      where: { type: ticketType },
      select: { quantity: true },
    });

    if (!ticket) {
      return { ticketCount: 0 };
    }

    // Tickets already generated / sold (ONLY earlybird)
    const usedCount = await this.prisma.generatedTicket.findMany({
      where: { order: { ticket: { type: 'earlybird' } } },
    });

    return {
      ticketCount: Math.max(ticket.quantity - usedCount.length, 0),
    };
  }

  async generateInvoiceForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { participants: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    const ticketQty = order.participants.length;

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        isActive: true,
        remainingQuantity: { gt: 0 },
      },
      orderBy: { priority: 'asc' },
    });

    if (!ticket || ticket.remainingQuantity < ticketQty) {
      throw new BadRequestException('Tickets sold out');
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        remainingQuantity: {
          decrement: ticketQty,
        },
      },
    });

    const pdfMap = new Map<string, Buffer>();

    await Promise.all(
      order.participants.map(async (participant) => {
        const ticketCode = await this.generateTicketCode();

        const { ticketUrl, qrHash } =
          await this.generateQRforTicket(ticketCode);

        await this.prisma.generatedTicket.create({
          data: {
            ticketCode,
            participantId: participant.id,
            qrHash,
            qrUrl: ticketUrl,
            orderId: order.id,
          },
        });

        // QR AS BUFFER ONLY
        const qrImageBuffer = await QRCode.toBuffer(ticketUrl, {
          width: 220,
          errorCorrectionLevel: 'M',
        });

        // PDF BUFFER
        const pdfBuffer = await generateTicketPDFBuffer({
          name: participant.firstName || 'Participant',
          ticketId: ticketCode,
          qrImage: qrImageBuffer,
        });

        pdfMap.set(ticketCode, pdfBuffer);
        // convert dataURL → PNG file (example path)
        // const filePath = `./qr/tickets/${ticketCode}.png`;

        // Get PNG buffer for QR image
        // getPngBufferFromDataUrl(dataUrl);

        //save QR as PNG
        // savePngFromDataUrl(dataUrl, filePath);

        //for validation in dev with x-scanner-key
        console.log(ticketUrl);
      }),
    );

    // SEND ALL PARTICIPANT PDFs
    await this.mailService.sendParticipantEmails(orderId, pdfMap);

    // SEND BUYER CONFIRMATION
    await this.mailService.sendBuyerEmail(orderId);

    await this.prisma.ticket.update({
      where: { id: order.ticketId },
      data: {
        quantity: { decrement: order.participants.length },
      },
    });
  }
}
