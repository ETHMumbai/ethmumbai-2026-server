import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../tickets/pdf.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private loadTemplate(templateName: string): string {
    const possiblePaths = [
      path.join(
        process.cwd(),
        'src',
        'mail',
        'templates',
        `${templateName}.html`,
      ),
      path.join(
        process.cwd(),
        'dist',
        'src',
        'mail',
        'templates',
        `${templateName}.html`,
      ),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
      }
    }

    throw new Error(`Template not found for ${templateName}`);
  }

  private inject(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
      (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val ?? ''),
      template,
    );
  }

  async sendBuyerEmail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { participants: { include: { generatedTicket: true } } },
    });

    if (!order) {
      this.logger.error(`Order not found: ${orderId}`);
      return;
    }

    const participantsList = order.participants
      .map(
        (p) =>
          `<li>${p.name} (${p.email}) - Ticket Code: <b>${
            p.generatedTicket?.ticketCode ?? 'Pending'
          }</b></li>`,
      )
      .join('');

    const html = this.inject(this.loadTemplate('buyer-email'), {
      buyerName: order.buyerName,
      orderId: order.id,
      paymentId: order.razorpayPaymentId ?? order.daimoPaymentId ?? 'N/A',
      amount: order.amount.toString(),
      currency: order.currency,
      status: order.status,
      participantsList,
    });

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: order.buyerEmail,
      subject: '🎟️ ETHMumbai Order Confirmation',
      html,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        buyerEmailSent: true,
        buyerEmailSentAt: new Date(),
      },
    });

    this.logger.log(`Buyer email sent to ${order.buyerEmail}`);
  }

  async sendParticipantEmails(orderId: string) {
    const participants = await this.prisma.participant.findMany({
      where: { orderId, emailSent: false },
      include: { generatedTicket: true },
    });

    if (participants.length === 0) {
      this.logger.warn(`No participants pending email for order ${orderId}`);
      return;
    }

    const template = this.loadTemplate('participant-email');

    for (const p of participants) {
      if (!p.email) continue;

      const ticketCode = p.generatedTicket?.ticketCode ?? 'Pending';

      const html = this.inject(template, {
        name: p.name,
        orderId,
        ticketCode: ticketCode,
      });

      // 🎯 GENERATE PDF
      const pdfBuffer = await this.pdfService.generateTicketPdf({
        name: p.name,
        ticketCode: ticketCode,
        orderId: orderId,
      });

      await this.transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: p.email,
        subject: '🎟️ Your ETHMumbai Ticket',
        html,
        attachments: [
          {
            filename: `ETHMumbai-Ticket-${ticketCode}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      await this.prisma.participant.update({
        where: { id: p.id },
        data: { emailSent: true, emailSentAt: new Date() },
      });

      this.logger.log(`Ticket email with PDF sent to ${p.email}`);
    }
  }
}