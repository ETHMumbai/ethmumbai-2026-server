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
  BadRequestException,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
// import { generateTicketsForOrder } from ./TicketsService
import { generateTicketPDF } from './generateTicket';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { ApiKeyGuard } from '../utils/api-key-auth';

registerFont('assets/fonts/MPLUSRounded1c-Bold.ttf', {
  family: 'Rounded Mplus 1c',
  weight: 'bold',
  style: 'not-rotated',
});

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
  @Get('/visual/')
  async visualTicket(
    @Query('firstName') firstName: string,
    @Res() res: Response,
  ) {
    await this.ticketService.visualTicketGeneration(firstName, res);
    // if (!firstName) {
    //   throw new BadRequestException('Missing firstName (f) parameter');
    // }

    // const width = 1920;
    // const height = 1080;

    // const canvas = createCanvas(width, height);
    // const ctx = canvas.getContext('2d');

    // // OPTIONAL: use a PNG template
    // const bg = await loadImage('src/assets/visual/early bird ticket.png');
    // ctx.drawImage(bg, 0, 0, width, height);

    // // Background (remove if using template)
    // // ctx.fillStyle = '#ffffff';
    // // ctx.fillRect(0, 0, width, height);

    // // Text styling
    // ctx.fillStyle = '#000000';
    // ctx.font = 'bold 64px "Rounded Mplus 1c"';
    // ctx.textAlign = 'left';

    // // Fixed position
    // const x = 576;
    // const y = 365;

    // ctx.fillText(firstName, x, y);

    // // Send PNG response
    // res.set({
    //   'Content-Type': 'image/png',
    //   'Content-Disposition': 'inline; filename="ticket.png"',
    // });

    // canvas.createPNGStream().pipe(res);
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
}
