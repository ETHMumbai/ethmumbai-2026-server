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
  ) {}

  // ---------------------------------------------
  // BUYER CONFIRMATION EMAIL
  // ---------------------------------------------
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

  // ---------------------------------------------
  // PARTICIPANT TICKET EMAILS (with QR attachment)
  // ---------------------------------------------
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

      // Path to QR file
      const qrPath = path.join(__dirname, '../qr/tickets', `${ticketCode}.png`);
      let attachment: {
        filename: string;
        contentType: string;
        data: string;
      } | null = null;

      // Read QR file as base64
      if (fs.existsSync(qrPath)) {
        try {
          const fileData = fs.readFileSync(qrPath);

          if (fileData.length === 0) {
            this.logger.error(`QR file is empty: ${qrPath}`);
          } else {
            attachment = {
              filename: `${ticketCode}.png`,
              contentType: 'image/png',
              data: fileData.toString('base64'),
            };
          }
        } catch (err) {
          this.logger.error(`Error reading QR file for ${ticketCode}: ${err}`);
        }
      } else {
        this.logger.warn(`QR code missing → ${qrPath}`);
      }

      // SEND EMAIL
      const resp = await this.loops.sendTransactionalEmail(
        PARTICIPANT_TEMPLATE,
        p.email,
        {
          name: p.name,
          orderId,
          ticketCode: ticketCode,
        },
        attachment ? [attachment] : [],
      );

      if (!resp?.success) {
        this.logger.error(`Failed sending participant email → ${p.email}`);
        continue;
      }

      // Mark as sent
      await this.prisma.participant.update({
        where: { id: p.id },
        data: { emailSent: true, emailSentAt: new Date() },
      });

      this.logger.log(`Participant email sent → ${p.email}`);
    }
  }
}
