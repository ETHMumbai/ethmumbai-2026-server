import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

@Injectable()
export class PdfService {
  async generateTicketPdf(ticketData: {
    name: string;
    ticketCode: string;
    orderId: string;
  }): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [400, 700], // Single page size
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
        });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Background
        doc.rect(0, 0, 400, 700).fill('#E0F7FA');

        // ETHGlobal logo text
        doc
          .fontSize(16)
          .fillColor('#1F2937')
          .font('Helvetica-Bold')
          .text('ETHGlobal', 0, 50, { align: 'center', width: 400 });

        // Greeting
        doc
          .fontSize(20)
          .fillColor('#000000')
          .font('Helvetica-Bold')
          .text(`Hey ${ticketData.name}`, 0, 90, { align: 'center', width: 400 });

        // Subtitle
        doc
          .fontSize(11)
          .fillColor('#4B5563')
          .font('Helvetica')
          .text('This is your ticket to', 0, 120, { align: 'center', width: 400 });

        // Event logo diamond
        doc
          .fontSize(18)
          .fillColor('#6366F1')
          .text('◆', 0, 145, { align: 'center', width: 400 });

        // Event name
        doc
          .fontSize(22)
          .fillColor('#000000')
          .font('Helvetica-Bold')
          .text('ETHMumbai Conference', 0, 170, { align: 'center', width: 400 });

        // Generate QR code
        const qrUrl = `https://ethmumbai.xyz/ticket/${ticketData.ticketCode}`;
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 130,
          margin: 0,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        // Convert base64 to buffer
        const qrBase64 = qrDataUrl.split(',')[1];
        const qrBuffer = Buffer.from(qrBase64, 'base64');

        // QR Code position
        const qrX = 135;
        const qrY = 220;
        const qrSize = 130;

        // Draw QR border
        doc
          .rect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10)
          .lineWidth(3)
          .strokeColor('#10B981')
          .stroke();

        // Insert QR code image
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

        // ATTENDEE badge
        const badgeY = qrY + qrSize - 22;
        doc
          .rect(qrX + 30, badgeY, 70, 18)
          .fill('#10B981');

        doc
          .fontSize(9)
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .text('ATTENDEE', qrX + 38, badgeY + 4);

        // Name
        doc
          .fontSize(11)
          .fillColor('#000000')
          .font('Helvetica-Bold')
          .text('Name', 50, 390);

        doc
          .fontSize(15)
          .fillColor('#000000')
          .font('Helvetica')
          .text(ticketData.name, 50, 410);

        // Ticket ID
        doc
          .fontSize(11)
          .fillColor('#000000')
          .font('Helvetica-Bold')
          .text('Ticket ID', 50, 450);

        doc
          .fontSize(13)
          .fillColor('#000000')
          .font('Helvetica')
          .text(ticketData.ticketCode, 50, 470);

        // Date
        doc
          .fontSize(11)
          .fillColor('#000000')
          .font('Helvetica-Bold')
          .text('Date', 50, 510);

        doc
          .fontSize(13)
          .fillColor('#000000')
          .font('Helvetica')
          .text('Thursday, 12 March 2026', 50, 530);

        // Footer (small disclaimer at bottom)
        doc
          .fontSize(8)
          .fillColor('#6B7280')
          .font('Helvetica')
          .text(
            'This is your e-ticket for ETHMumbai',
            50,
            600,
            { align: 'left', width: 300 }
          );

        doc
          .fontSize(7)
          .fillColor('#9CA3AF')
          .text(
            'Remember, the name on your ticket MUST match the name on your ID.',
            50,
            620,
            { align: 'left', width: 300 }
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}