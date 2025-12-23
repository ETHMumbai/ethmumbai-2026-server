import {
  Body,
  Controller,
  HttpCode,
  Post,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
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
  @HttpCode(200)
  async daimoWebhook(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
  ) {
    // Verify webhook token
    if (!authorization || authorization !== process.env.DAIMO_WEBHOOK_TOKEN) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    await this.paymentsService.paymentEventHandler(body);

    // Return success immediately
    return { received: true };

    // console.log('🔔 Daimo Event:', body.type);
    //for payment Started -> create order with payId
    // for payment completed -> verify payment + update order status, daimo txn hash
    //for payment_bounced-> update order status to pending
    //for payment_refunded -> update order status to refunded (failed payment ui with data - )
    // switch (body.event) {
    //   case 'payment.succeeded':
    //     console.log('✅ Payment success:', body.data);
    //     break;

    //   case 'payment.failed':
    //     console.log('❌ Payment failed:', body.data);
    //     break;

    //   default:
    //     console.log('⚠️ Unknown event:', body);
    // }

    // return { received: true };
  }
}
