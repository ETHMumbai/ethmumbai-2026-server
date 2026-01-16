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
  BadRequestException,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { getDiscount } from '../utils/discount';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
// import { generateTicketsForOrder } from ./TicketsService
import { generateTicketPDF } from './generateTicket';
import {
  generateInvoicePDFBuffer,
  InvoiceData,
} from '../utils/generateInvoicePdf';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';
import { ApiKeyGuard } from '../utils/api-key-auth';
import Razorpay from 'razorpay';
import { generateInvoiceNumberForOrder } from 'src/utils/ticket.utils';

@Controller('t')
export class TicketsController {
  private razorpay: Razorpay;
  constructor(
    private readonly ticketService: TicketsService,
    private readonly prisma: PrismaService,
  ) {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  @Get('/current')
  async getCurrentTicket() {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        isActive: true,
        remainingQuantity: { gt: 0 },
      },
      orderBy: { priority: 'asc' },
    });

    if (!ticket) {
      return { message: 'No active tickets available.' };
    }

    return {
      ...ticket,
      discount: getDiscount(ticket.fiat),
    };
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

  @Get('preview-invoice/:orderId')
  async previewInvoice(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: {
          include: { address: true },
        },
        ticket: true,
        participants: true,
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    const buyer = order.buyer;
    const address = buyer.address;
    const ticket = order.ticket;

    let rzpLabel = '';

    if (order.paymentType == 'RAZORPAY' && order.razorpayPaymentId != null) {
      const payment = await this.razorpay.payments.fetch(
        order.razorpayPaymentId,
      );

      // Convert to nice label for UI
      switch (payment.method) {
        case 'upi':
          rzpLabel = 'UPI via Razorpay';
          break;
        case 'card':
          rzpLabel = 'Card via Razorpay';
          break;
        case 'netbanking':
          rzpLabel = 'Netbanking via Razorpay';
          break;
        case 'wallet':
          rzpLabel = 'Razorpay';
          break;
        default:
          rzpLabel = payment.method;
      }
    }

    const invoiceData: InvoiceData = {
      invoiceNo: order.invoiceNumber,
      date: order.createdAt.toDateString(),

      billedTo: {
        name: `${buyer.firstName} ${buyer.lastName}`,
        addressLine1: address?.line1 || '',
        city: address?.city || '',
        state: address?.state || '',
        pincode: address?.postalCode || '',
      },

      item: {
        description: ticket.title,
        quantity: order.participants.length,
        price: ticket.fiat,
      },

      discount: 0,
      gstRate: 18,

      paymentMethod:
        order.paymentType === 'RAZORPAY'
          ? `INR (${rzpLabel || 'Unknown'})`
          : 'Crypto',
    };

    const pdfBuffer = await generateInvoicePDFBuffer(invoiceData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="invoice.pdf"',
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  @Get('invoice/generate/:orderId')
  async generateInvoice(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    if (!orderId) {
      throw new BadRequestException('orderId is required');
    }

    const pdfBuffer = await this.ticketService.generateInvoiceForOrder(orderId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${orderId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

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
}
