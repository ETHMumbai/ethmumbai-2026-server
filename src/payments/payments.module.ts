import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TicketsModule } from '../tickets/tickets.module';
import { RazorpayService } from './razorpay.service';
import { DaimoService } from './daimo.service';
import { InvoiceModule } from 'src/invoice/invoice.module';

@Module({
  imports: [TicketsModule, InvoiceModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayService, DaimoService, PrismaService],
})
export class PaymentsModule {}
