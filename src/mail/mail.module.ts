import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { LoopsService } from './loops.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [],
  providers: [MailService, LoopsService, PrismaService],
  exports: [MailService],
})
export class MailModule {}
