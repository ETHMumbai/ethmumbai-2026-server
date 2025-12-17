import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { PaymentsModule } from './payments/payments.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InvoiceModule } from './invoice/invoice.module';
import { InternalModule } from './internal/internal.module';

@Module({
  imports: [
    PrismaModule, 
    ConfigModule.forRoot({ isGlobal: true }),
    PaymentsModule,
    InvoiceModule,
    InternalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
