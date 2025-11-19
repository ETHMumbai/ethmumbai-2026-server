import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';
import { savePngFromDataUrl } from 'src/utils/save-png';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  //Generates a unique, non-reversible ticket code based on participant email + randomness
  private generateTicketCode(email: string): string {
    const hash = crypto.createHash('sha256').update(email).digest('hex');
    const shortHash = hash.substring(0, 8);
    const random = Math.random().toString(36).substring(2, 6);
    return `${shortHash}-${random}`.toUpperCase();
  }

  // Generates a ticket for each participant in a given order.
  async generateTicketsForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { participants: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    const generatedTickets = await Promise.all(
      order.participants.map(async (participant) => {
        // Generate unique ticket code
        const ticketCode = this.generateTicketCode(participant.email ?? '');
        // Call QR generation function
        const { dataUrl, ticketUrl, qrHash } =
          await this.generateQRforTicket(ticketCode);
        // Create ticket entry
        await this.prisma.generatedTicket.create({
          data: {
            ticketCode: ticketCode,
            participantId: participant.id,
            qrHash: qrHash,
            qrUrl: ticketUrl,
            orderId: order.id,
          },
        });

        // convert dataURL → PNG file (example path)
        const filePath = `./qr/tickets/${ticketCode}.png`;

        savePngFromDataUrl(dataUrl, filePath);
        //for validation in dev with x-scanner-key
        console.log(ticketUrl);
      }),
    );

    await this.mailService.sendBuyerEmail(orderId);
    await this.mailService.sendParticipantEmails(orderId);

    return generatedTickets;
  }

  async generateQRforTicket(ticketCode: string) {
    // store ticketCode hash in DB for checkIn
    const qrHash = crypto.createHash('sha256').update(ticketCode).digest('hex');

    // build ticket URL and QR (embedded with ticketCode)
    const ticketUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/t?token=${ticketCode}`;

    // QR as base64
    const dataUrl = await QRCode.toDataURL(ticketUrl, {
      width: 200,
      errorCorrectionLevel: 'M',
    });

    return { dataUrl, ticketUrl, qrHash };
  }

  async verifyAndMark(token: string) {
    if (!token) throw new BadRequestException('token required');

    //get ticketCode hash
    const qrHash = crypto.createHash('sha256').update(token).digest('hex');

    const ticket = await this.prisma.generatedTicket.findFirst({
      where: { qrHash: qrHash },
    });

    //check if participant doesn't exist
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    //check if participant already checked-in
    if (ticket.checkedIn) {
      return { ok: false, reason: 'Participant is already checked in' };
    }

    // atomic update: only mark used when checkedIn = false
    const result = await this.prisma.generatedTicket.update({
      where: { qrHash: qrHash, checkedIn: false },
      data: { checkedIn: true },
    });

    if (result) {
      // check existence and display check in details
      const p = await this.prisma.participant.findFirst({
        where: { id: result.participantId },
      });
      if (!p) throw new NotFoundException('Invalid token');
      return (
        'Hello ' + p.name + '! Welcome to ETHMumbai. You have been checked in.'
      );
    }

    return 'Token Invalid' + token;
  }
  //Fallback for Manual Check In
  async checkInFallback(token: string) {
    const ticket = await this.prisma.generatedTicket.findFirst({
      where: {
        ticketCode: token,
      },
    });

    const participant = await this.prisma.participant.findFirst({
      where: {
        id: ticket?.participantId,
      },
    });

    const order = await this.prisma.order.findFirst({
      where: {
        id: ticket?.orderId,
      },
    });

    const ticketType = await this.prisma.ticket.findFirst({
      where: {
        id: order?.ticketId,
      },
    });

    const participantName = participant?.name || 'Participant';
    const buyerName = order?.buyerName || 'Buyer';
    const ticketTypeTitle = ticketType?.title || 'Ticket';

    return { participantName, ticketTypeTitle, buyerName };
  }
}
