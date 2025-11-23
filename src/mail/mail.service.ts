import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { LoopsService } from './loops.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private prisma: PrismaService,
    private loops: LoopsService,
  ) { }

  // send buyer confirmatiom email with order summary
  async sendBuyerEmail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { participants: { include: { generatedTicket: true } } },
    });

    if (!order) {
      this.logger.error(`Order not found: ${orderId}`);
      return;
    }

    const BUYER_TEMPLATE = process.env.LOOPS_BUYER_EMAIL_ID;
    if (!BUYER_TEMPLATE) {
      this.logger.error('Missing env: LOOPS_BUYER_EMAIL_ID');
      return;
    }

    const participantsList = order.participants
      .map(
        (p) =>
          `${p.name} (${p.email}) - Ticket: ${p.generatedTicket?.ticketCode ?? 'Pending'}`
      )
      .join('\n');

    const resp = await this.loops.sendTransactionalEmail(
      BUYER_TEMPLATE,
      order.buyerEmail,
      {
        buyerName: order.buyerName,
        orderId: order.id,
        paymentId: order.razorpayPaymentId ?? order.daimoPaymentId ?? 'N/A',
        amount: order.amount.toString(),
        currency: order.currency,
        status: order.status,
        participantsList,
      }
    );

    if (!resp?.success) {
      this.logger.error(`Failed to send buyer confirmation → ${order.buyerEmail}`);
      return;
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { buyerEmailSent: true, buyerEmailSentAt: new Date() },
    });

    this.logger.log(`Buyer email sent → ${order.buyerEmail}`);
  }

  // Send ticket emails to each participant with their unique ticket code.
  async sendParticipantEmails(orderId: string) {
    const participants = await this.prisma.participant.findMany({
      where: { orderId, emailSent: false },
      include: { generatedTicket: true },
    });

    if (!participants.length) {
      this.logger.warn(`No participants pending email for order ${orderId}`);
      return;
    }

    const PARTICIPANT_TEMPLATE = process.env.LOOPS_PARTICIPANT_EMAIL_ID;
    if (!PARTICIPANT_TEMPLATE) {
      this.logger.error('Missing env: LOOPS_PARTICIPANT_EMAIL_ID');
      return;
    }

    for (const p of participants) {
      if (!p.email) continue;

      const ticketCode = p.generatedTicket?.ticketCode;

      // Load QR file as base64
      const qrPath = path.join(process.cwd(), 'src', 'qr', `${ticketCode}.png`);
      let attachment: {
        filename: string;
        contentType: string;
        data: string;
      } | null = null;

      if (fs.existsSync(qrPath)) {
        const fileData = fs.readFileSync(qrPath);
        attachment = {
          filename: `${ticketCode}.png`,
          contentType: 'image/png',
          data: fileData.toString('base64'),
        };
      }

      const resp = await this.loops.sendTransactionalEmail(
        PARTICIPANT_TEMPLATE,
        p.email,
        {
          name: p.name,
          orderId,
          ticketCode: ticketCode,
          tickectCode: ticketCode,
        },
        attachment ? [attachment] : [],
      );

      if (!resp?.success) {
        this.logger.error(`Failed sending participant email → ${p.email}`);
        continue;
      }

      await this.prisma.participant.update({
        where: { id: p.id },
        data: { emailSent: true, emailSentAt: new Date() },
      });

      this.logger.log(`Participant email sent → ${p.email}`);
    }
  }
}
