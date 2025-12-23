import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Razorpay order creation
  @Post('order')
  async createRazorpayOrder(@Body() body: any) {
    console.log('BODY RECEIVED AT /payments/order:', body);
    return await this.paymentsService.createRazorpayOrder(body);
  }

  // Daimo order creation
  @Post('create-order')
  async createDaimoOrder(@Body() body: any) {
    return await this.paymentsService.createDaimoOrder(body);
  }

  // Verify payments (both Razorpay & Daimo)
  @Post('verify')
  async verifyPayment(@Body() body: any) {
    return await this.paymentsService.verifyPayment(body);
  }

  @Post('daimo/webhook')
  async daimoWebhook(@Body() body: any) {
    console.log('🔔 Daimo Event:', body.event);

    switch (body.event) {
      case 'payment.succeeded':
        console.log('✅ Payment success:', body.data);
        break;

      case 'payment.failed':
        console.log('❌ Payment failed:', body.data);
        break;

      default:
        console.log('⚠️ Unknown event:', body);
    }

    return { received: true };
  }
}
