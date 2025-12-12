import { Controller, Get, Response } from '@nestjs/common';
import { AppService } from './app.service';
import { PdfService } from './tickets/pdf.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // 🎯 Test PDF endpoint
  @Get('test-pdf')
  async testPdf(@Response() res) {
    const pdfBuffer = await this.pdfService.generateTicketPdf({
      name: 'John Doe',
      ticketCode: 'TEST123',
      orderId: 'ORDER-456',
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=test-ticket.pdf',
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
}