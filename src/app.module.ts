import { Module } from '@nestjs/common';
import { CartModule } from './cart/cart.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [PrismaModule, CartModule, PaymentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
