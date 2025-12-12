import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  providers: [TicketsService, PdfService, PrismaService],
  exports: [TicketsService, PdfService],
})
export class TicketsModule {}