import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { PdfService } from '../tickets/pdf.service';

@Module({
  providers: [MailService, PdfService],
  exports: [MailService],
})
export class MailModule {}