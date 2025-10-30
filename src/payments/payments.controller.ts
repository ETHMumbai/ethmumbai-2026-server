import { Controller, Post, Body, Get } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  getPage(): string {
    return 'Reached Payment controller';
  }

  @Post('create-order')
  async createOrder(
    @Body()
    dto: {
      cartId: string;
      paymentType: 'RAZORPAY' | 'DAIMO';
    },
  ) {
    // console.log('The cart Id from request is: ', dto.cartId);
    return this.paymentsService.createOrder(dto.cartId, dto.paymentType);
  }

  @Post('verify')
  async verifyPayment(@Body() dto: any) {
    return this.paymentsService.verifyPayment(dto);
  }
}
