import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { baseUSDC, ethereumUSDC } from '@daimo/pay-common';

@Injectable()
export class DaimoService {
  private readonly DAIMO_API_URL = 'https://pay.daimo.com/api/payment';
  private readonly DAIMO_API_KEY = process.env.DAIMO_API_KEY;
  private readonly DESTINATION_ADDRESS = process.env.DAIMO_DESTINATION_ADDRESS;
  private readonly REFUND_ADDRESS = process.env.DAIMO_REFUND_ADDRESS;

  constructor(
    private prisma: PrismaService,
    private ticketsService: TicketsService,
  ) {}

  /**
   * Create a Daimo payment order
   */
  async createOrder(amount: number, currency = 'USD') {
    if (!this.DAIMO_API_KEY || !this.DESTINATION_ADDRESS) {
      throw new InternalServerErrorException('Missing Daimo configuration');
    }

    try {
      // Daimo expects amount in string, and USDC token address on Base (mainnet)
      const payload = {
        display: {
          intent: 'Checkout',
          // redirectUri: 'http://localhost:3000/conference/payment-success',
        },
        destination: {
          destinationAddress: this.DESTINATION_ADDRESS,
          chainId: baseUSDC.chainId, // Base mainnet
          tokenAddress: baseUSDC.token, // USDC
          amountUnits: '0.1', //amount.toString(), // <-- FIXED: amount passed from argument
        },
        refundAddress: this.REFUND_ADDRESS,
        metadata: {
          system: 'ETHMumbai',
          currency: currency,
        },
      };

      const response = await axios.post(this.DAIMO_API_URL, payload, {
        headers: {
          'Api-Key': this.DAIMO_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;
      const payId = data.payment?.id;

      console.log('✅ Daimo Payment Created:', payId);

      return {
        success: true,
        paymentId: payId,
      };
    } catch (error) {
      console.error(
        '❌ Daimo createOrder error:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException('Failed to create Daimo order');
    }
  }

  async daimoWebhookHandler(eventBody: any) {
    console.log('🔔 Daimo Event:', eventBody.data.type);

    switch (eventBody.data.type) {
      case 'payment_started':
        console.log('🟡 Payment started:', eventBody.data);
        // await this.verifyPayment(eventBody, eventBody.data.paymentId);
        break;

      case 'payment_completed':
        console.log('✅ Payment completed:', eventBody.data);
        // update order → generate tickets → send emails
        // await this.verifyPayment(eventBody, eventBody.data.paymentId);
        break;

      case 'payment_bounced':
        console.log('❌ Payment failed:', eventBody.data);
        break;

      case 'payment_refunded':
        console.log('❌ Payment failed:', eventBody.data);
        break;

      default:
        console.log('⚠️ Unknown event:', eventBody);
    }
  }

  /**
   * Verify Daimo Payment by Payment ID
   */
  async verifyPayment(eventBody: any, paymentId: string) {
    if (!paymentId) throw new BadRequestException('Missing Daimo paymentId');

    try {
      // const response = await axios.get(`${this.DAIMO_API_URL}/${paymentId}`, {
      //   headers: { 'Api-Key': this.DAIMO_API_KEY },
      // });

      // const payment = response.data?.payment || response.data;

      // console.log('🧾 Daimo payment fetched:', payment);

      const isComplete = eventBody.data.payment.status;

      // ✅ Update the order in DB based on paymentId
      await this.prisma.order.updateMany({
        where: { daimoPaymentId: paymentId },
        data: {
          status: isComplete == 'payment_completed' ? 'paid' : 'pending',
          daimoTxHash: eventBody.data.destination.txHash,
          paymentVerified: true,
        },
      });

      // Ticket Generation
      if (isComplete == true) {
        const orderComplete = await this.prisma.order.findFirst({
          where: { daimoPaymentId: paymentId },
        });
        if (orderComplete?.id) {
          await this.ticketsService.generateTicketsForOrder(orderComplete.id);
        }
      }

      return {
        success: isComplete,
        status: eventBody.data.payment.status,
        message: isComplete
          ? '✅ Payment verified successfully'
          : `⚠️ Payment not completed. Status: ${eventBody.data.payment.status}`,
      };
    } catch (error) {
      console.error(
        '❌ Error verifying Daimo payment:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException('Failed to verify Daimo payment');
    }
  }
}
