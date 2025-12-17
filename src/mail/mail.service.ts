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
  // BUYER CONFIRMATION EMAIL WITH INVOICE
  // ---------------------------------------------
  async sendBuyerEmail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        ticket: true,
        participants: { include: { generatedTicket: true } },
      },
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
          `${p.firstName} ${p.lastName} (${p.email}) - Ticket: ${p.generatedTicket?.ticketCode ?? 'Pending'}`,
      )
      .join('\n');

    // Read invoice PDF and convert to base64
    const invoicePath = path.join(process.cwd(), 'invoices', `${orderId}.pdf`);
    const invoiceAttachments: Array<{
      filename: string;
      contentType: string;
      data: string;
    }> = [];

    if (fs.existsSync(invoicePath)) {
      try {
        const fileData = fs.readFileSync(invoicePath);
        if (fileData.length > 0) {
          invoiceAttachments.push({
            filename: `invoice-${orderId}.pdf`,
            contentType: 'application/pdf',
            data: fileData.toString('base64'),
          });
          this.logger.log(`Invoice attached: ${invoicePath}`);
        } else {
          this.logger.error(`Invoice file is empty: ${invoicePath}`);
        }
      } catch (err) {
        this.logger.error(`Error reading invoice file: ${err}`);
      }
    } else {
      this.logger.warn(`Invoice not found at: ${invoicePath}`);
    }

    // Send email with invoice attachment
    const resp = await this.loops.sendTransactionalEmail(
      BUYER_TEMPLATE,
      order.buyer.email,
      {
        buyerName: `${order.buyer.firstName} ${order.buyer.lastName}`,
        orderId: order.id,
        paymentId: order.razorpayPaymentId ?? order.daimoPaymentId ?? 'N/A',
        amount: order.amount.toString(),
        currency: order.currency,
        status: order.status,
        ticketType: order.ticket.title,
        participantsList,
      },
      invoiceAttachments,
    );

    if (!resp?.success) {
      this.logger.error(
        `Failed to send buyer confirmation → ${order.buyer.email}`,
      );
      return;
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { buyerEmailSent: true, buyerEmailSentAt: new Date() },
    });

    this.logger.log(
      `Buyer email sent to ${order.buyer.email} with ${invoiceAttachments.length} attachment(s)`,
    );
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
      const qrPath = path.join(
        process.cwd(),
        'qr',
        'tickets',
        `${ticketCode}.png`,
      );
      const qrAttachments: Array<{
        filename: string;
        contentType: string;
        data: string;
      }> = [];

      // Read QR file as base64
      if (fs.existsSync(qrPath)) {
        try {
          const fileData = fs.readFileSync(qrPath);

          if (fileData.length === 0) {
            this.logger.error(`QR file is empty: ${qrPath}`);
          } else {
            qrAttachments.push({
              filename: `ticket-${ticketCode}.png`,
              contentType: 'image/png',
              data: fileData.toString('base64'),
            });
            this.logger.log(`QR code attached: ${qrPath}`);
          }
        } catch (err) {
          this.logger.error(`Error reading QR file for ${ticketCode}: ${err}`);
        }
      } else {
        this.logger.warn(`QR code not found at: ${qrPath}`);
      }

      // SEND EMAIL with QR attachment
      const resp = await this.loops.sendTransactionalEmail(
        PARTICIPANT_TEMPLATE,
        p.email,
        {
          name: `${p.firstName} ${p.lastName}`,
          orderId,
          ticketCode: ticketCode || 'Pending',
        },
        qrAttachments,
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

      this.logger.log(
        `Participant email sent to ${p.email} with ${qrAttachments.length} attachment(s)`,
      );
    }
  }
}

// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as nodemailer from 'nodemailer';
// import { PrismaService } from '../prisma/prisma.service';
// import * as fs from 'fs';
// import * as path from 'path';

// @Injectable()
// export class MailService {
//   private readonly logger = new Logger(MailService.name);
//   private transporter: nodemailer.Transporter;

//   constructor(
//     private configService: ConfigService,
//     private prisma: PrismaService,
//   ) {
//     // Create SMTP transporter
//     this.transporter = nodemailer.createTransport({
//       host: this.configService.get('SMTP_HOST'),
//       port: this.configService.get('SMTP_PORT'),
//       secure: false, // use TLS
//       auth: {
//         user: this.configService.get('SMTP_USER'),
//         pass: this.configService.get('SMTP_PASS'),
//       },
//     });
//   }

//   async sendBuyerEmail(orderId: string): Promise<void> {
//     try {
//       const order = await this.prisma.order.findUnique({
//         where: { id: orderId },
//         include: {
//           buyer: true,
//           ticket: true,
//           participants: {
//             include: { generatedTicket: true },
//           },
//         },
//       });

//       if (!order) {
//         throw new Error(`Order not found: ${orderId}`);
//       }

//       // Read invoice PDF
//       const invoicePath = path.join(process.cwd(), 'invoices', `${orderId}.pdf`);
//       const attachments: Array<{ filename: string; path: string }> = [];

//       if (fs.existsSync(invoicePath)) {
//         attachments.push({
//           filename: `invoice-${orderId}.pdf`,
//           path: invoicePath,
//         });
//         this.logger.log(`Invoice attached: ${invoicePath}`);
//       } else {
//         this.logger.warn(`Invoice not found at: ${invoicePath}`);
//       }

//       const participantsList = order.participants
//         .map((p, i) => `${i + 1}. ${p.firstName} ${p.lastName} (${p.email}) - Ticket: ${p.generatedTicket?.ticketCode || 'Pending'}`)
//         .join('\n');

//       // Send email
//       await this.transporter.sendMail({
//         from: this.configService.get('MAIL_FROM'),
//         to: order.buyer.email,
//         subject: '🎟️ ETHMumbai Order Confirmation',
//         html: `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//             <h2 style="color: #E2231A;">Thanks for purchasing ETHMumbai tickets!</h2>
            
//             <h3>Order Details:</h3>
//             <table style="width: 100%; border-collapse: collapse;">
//               <tr>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Order ID:</strong></td>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;">${order.id}</td>
//               </tr>
//               <tr>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Payment ID:</strong></td>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;">${order.razorpayPaymentId || order.daimoPaymentId || 'N/A'}</td>
//               </tr>
//               <tr>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Amount:</strong></td>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;">${order.currency === 'INR' ? '₹' : '$'}${order.amount}</td>
//               </tr>
//               <tr>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Status:</strong></td>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;">${order.status}</td>
//               </tr>
//               <tr>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Ticket Type:</strong></td>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;">${order.ticket.title}</td>
//               </tr>
//             </table>

//             <h3 style="margin-top: 30px;">Participants:</h3>
//             <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${participantsList}</pre>

//             <p style="margin-top: 30px;">📎 <strong>Your invoice is attached to this email.</strong></p>

//             <p style="margin-top: 30px; color: #666;">
//               Each participant will receive a separate email with their individual ticket and QR code.
//             </p>

//             <div style="margin-top: 40px; padding: 20px; background: #E2231A; color: white; text-align: center; border-radius: 5px;">
//               <h3 style="margin: 0;">See you at ETHMumbai 2026! 💜</h3>
//             </div>
//           </div>
//         `,
//         attachments: attachments,
//       });

//       // Mark as sent
//       await this.prisma.order.update({
//         where: { id: orderId },
//         data: { buyerEmailSent: true },
//       });

//       this.logger.log(`Buyer email sent successfully to ${order.buyer.email} with ${attachments.length} attachment(s)`);
//     } catch (error) {
//       this.logger.error(`Failed to send buyer email for order ${orderId}:`, error);
//       throw error;
//     }
//   }

//   async sendParticipantEmails(orderId: string): Promise<void> {
//     try {
//       const order = await this.prisma.order.findUnique({
//         where: { id: orderId },
//         include: {
//           participants: {
//             include: { generatedTicket: true },
//           },
//         },
//       });

//       if (!order) {
//         throw new Error(`Order not found: ${orderId}`);
//       }

//       for (const participant of order.participants) {
//         if (!participant.generatedTicket) {
//           this.logger.warn(`No ticket generated for participant ${participant.id}`);
//           continue;
//         }

//         const qrPath = path.join(
//         process.cwd(),
//         'qr',
//         'tickets',
//         `${participant.generatedTicket.ticketCode}.png`
//       );

//       const attachments: Array<{ filename: string; path: string; cid?: string }> = [];

//       if (fs.existsSync(qrPath)) {
//         attachments.push({
//           filename: `ticket-${participant.generatedTicket.ticketCode}.png`,
//           path: qrPath,
//           cid: 'qrcode', // Content ID for embedding in email
//         });
//         this.logger.log(`QR code found at: ${qrPath}`);
//       } else {
//         this.logger.warn(`QR code not found at: ${qrPath}`);
//       }

//         // Send email with QR code embedded
//       await this.transporter.sendMail({
//         from: this.configService.get('MAIL_FROM'),
//         to: participant.email,
//         subject: '🎟️ Your ETHMumbai Ticket',
//         html: `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//             <h2 style="color: #E2231A;">Hi ${participant.firstName} ${participant.lastName}!</h2>
            
//             <p style="font-size: 16px;">Here's your ETHMumbai ticket!</p>

//             <h3>Ticket Details:</h3>
//             <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
//               <tr>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Order ID:</strong></td>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;">${order.id}</td>
//               </tr>
//               <tr>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Ticket Code:</strong></td>
//                 <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong style="font-size: 18px; color: #E2231A;">${participant.generatedTicket.ticketCode}</strong></td>
//               </tr>
//             </table>

//             ${attachments.length > 0 ? `
//               <div style="margin: 30px 0; padding: 30px; background: #f5f5f5; border-radius: 10px; text-align: center;">
//                 <p style="margin: 0 0 20px 0; font-weight: bold; font-size: 16px;">Your QR Code Ticket:</p>
//                 <img src="cid:qrcode" alt="QR Code" style="max-width: 300px; width: 100%; height: auto; border: 2px solid #E2231A; border-radius: 8px;" />
//               </div>
//               <p style="color: #666; text-align: center;">
//                 <strong>Please bring this QR code to the event for check-in.</strong><br/>
//                 You can print this email or show it on your phone.
//               </p>
//             ` : `
//               <div style="margin: 30px 0; padding: 20px; background: #fff3cd; border-radius: 5px; text-align: center;">
//                 <p style="margin: 0; color: #856404;">
//                   Your QR code is being generated. You'll receive it shortly.
//                 </p>
//               </div>
//             `}

//             <div style="margin-top: 40px; padding: 20px; background: #E2231A; color: white; text-align: center; border-radius: 5px;">
//               <h3 style="margin: 0;">See you at ETHMumbai 2026! 🎉</h3>
//             </div>
//           </div>
//         `,
//         attachments: attachments,
//       });

//         // Mark as sent
//         await this.prisma.participant.update({
//           where: { id: participant.id },
//           data: { emailSent: true },
//         });

//         this.logger.log(`Participant email sent to ${participant.email} with ${attachments.length} attachment(s)`);

//       }
//     } catch (error) {
//       this.logger.error(`Failed to send participant emails for order ${orderId}:`, error);
//       throw error;
//     }
//   }
// }
