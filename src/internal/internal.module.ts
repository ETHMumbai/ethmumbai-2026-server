import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Module({
  controllers: [InternalController],
  providers: [PrismaService, MailService],
})
export class InternalModule {}
