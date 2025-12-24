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
  }

  async generateQRforTicket(ticketCode: string) {
    const qrHash = crypto.createHash('sha256').update(ticketCode).digest('hex');

    const ticketUrl = `${
      process.env.APP_BASE_URL || 'https://www.ethmumbai.in'
    }/t/${ticketCode}`;

    return { ticketUrl, qrHash };
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
      where: { order: { ticket: { type: ticketType } } },
    });

    return {
      ticketCount: Math.max(ticket.quantity - usedCount.length, 0),
    };
  }
}
