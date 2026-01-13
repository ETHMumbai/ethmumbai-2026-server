import {
  Controller,
  Get,
  Query,
  UseGuards,
  Headers,
  Body,
  Post,
  Param,
  Res,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
// import { generateTicketsForOrder } from ./TicketsService
import { generateTicketPDF } from './generateTicket';
import { generateInvoicePDFBuffer, InvoiceData } from '../utils/generateInvoicePdf';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';
import { ApiKeyGuard } from '../utils/api-key-auth';

@Controller('t')
export class TicketsController {
  constructor(
    private readonly ticketService: TicketsService,
    private readonly prisma: PrismaService,
  ) {}

@Get('/current')
async getCurrentTicket() {
  try {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        isActive: true,
        remainingQuantity: { gt: 0 },
      },
      orderBy: { priority: 'asc' },
    });

    if (!ticket) {
      console.log('[DEBUG] No active tickets found.');
      return { message: 'No active tickets available.' };
    }

    // console.log('[DEBUG] Current active ticket:', ticket);
    return ticket;
  } catch (error) {
    console.error('[ERROR] Failed to fetch current ticket:', error);
    throw new InternalServerErrorException('Could not fetch current ticket');
  }
}


  @Get('/preview/pdf')
  async previewTicketPdf(
    @Query('name') name: string,
    @Query('ticketId') ticketId: string,
    @Res() res: Response,
  ) {
    if (!name || !ticketId) {
      return res.status(400).json({
        error: 'name and ticketId are required',
      });
    }

    const qrBuffer = await QRCode.toBuffer(ticketId);

    const pdfDoc = generateTicketPDF({
      name,
      ticketId,
      qrImage: qrBuffer,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="ticket-${ticketId}.pdf"`,
    });

    pdfDoc.pipe(res);
  }

  // @Get('/ticketCount/:ticketType')
  // async getTicketCountByType(@Param('ticketType') ticketType: string) {
  //   return await this.ticketService.getTicketCount(ticketType);
  // }

  // @Get('/ticketCount')
  // async getTicketCount(@Param('ticketType') ticketType: string) {
  //   return await this.ticketService.getTicketCount();
  // }

  //check-in is happening when this endpoint is hit -> change this to include a button/check that can be used by the team to check-in
  @UseGuards(ApiKeyGuard)
  @Get('/:token')
  async verify(@Param('token') token: string) {
    const resp = await this.ticketService.verifyAndMark(token);
    if (resp?.ok == false) {
      return 'Check-in failed: ' + resp?.reason;
    }
    return (
      'Hi ' +
      resp?.participantName +
      ', Welcome to ETHMumbai! You have received the ' +
      resp?.ticketTypeTitle +
      ' ETHMumbai Conference ticket with ticket code : ' +
      token +
      ' paid for by ' +
      resp?.buyerName
    );
  }

  @Get("/preview/invoice")
async previewInvoice(@Res() res: Response) {
  const invoiceData: InvoiceData = {
    invoiceNo: "ETHM00899",
    date: new Date().toDateString(),
    billedTo: {
      name: "Tanushree",
      addressLine1: "Some Street",
      city: "Kolkata",
      state: "WB",
      pincode: "700001",
    },
    item: {
      description: "ETHMumbai Conference Ticket",
      quantity: 1,
      price: 4999,
    },
    discount: 0,
    gstRate: 18,
    paymentMethod: "UPI",
  };

  const pdfBuffer = await generateInvoicePDFBuffer(invoiceData);

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": 'inline; filename="invoice.pdf"',
    "Content-Length": pdfBuffer.length,
  });

  res.send(pdfBuffer);
}

}
