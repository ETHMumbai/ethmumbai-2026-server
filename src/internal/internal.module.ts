import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoopsService } from 'src/mail/loops.service';

@Module({
  controllers: [InternalController],
  providers: [PrismaService, MailService, LoopsService],
})
export class InternalModule {}
