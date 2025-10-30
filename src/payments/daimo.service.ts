'use client';

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { baseUSDC } from '@daimo/pay-common';
import { getAddress } from 'viem';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DaimoService {
  private readonly DAIMO_API_URL = 'https://pay.daimo.com/api/payment';
  private readonly DAIMO_API_KEY = process.env.DAIMO_API_KEY; // stored in .env
  private readonly DESTINATION_ADDRESS = process.env.DAIMO_DESTINATION_ADDRESS; // your wallet address
  // private readonly REFUND_ADDRESS = process.env.DAIMO_REFUND_ADDRESS; // refund wallet

  constructor(private prisma: PrismaService) {}

  async createOrder(order: any) {
    // You can generate a Daimo payment payload here
    try {
      // ✅ Build the DaimoPay payload
      const payload = {
        display: {
          intent: 'Checkout',
        },
        destination: {
          destinationAddress: this.DESTINATION_ADDRESS,
          chainId: 8453,
          tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amountUnits: '0.1',
        },
        // refundAddress: this.REFUND_ADDRESS,
        metadata: {
          mySystemId: 'ETHMumbai',
          name: 'ETHMumbai',
        },
      };

      // ✅ Send POST request to DaimoPay API
      const response = await axios.post(this.DAIMO_API_URL, payload, {
        headers: {
          'Api-Key': this.DAIMO_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      // DaimoPay returns a JSON with payment info (e.g. paymentId or URL)
      const data = response.data;
      const payId = data.payment.id; // or response.data.id

      console.log('✅ DaimoPay Payment Created with payId:', payId);

      // Optionally, store order in DB here
      // await this.prisma.payment.create({
      //   data: {
      //     orderId: order.id,
      //     vendor: order.paymentType,
      //     vendorPaymentId: data.id,
      //     rawPayload: data,
      //     status: 'created',
      //   },
      // });

      // const verification = await this.verifyDaimoPayment(payId);

      // if (verification.success) {
      //   await this.prisma.order.update({
      //     where: { id: order.id },
      //     data: { status: 'paid' },
      //   });
      // }

      return {
        success: true,
        payment: data,
      };
    } catch (error) {
      console.error(
        '❌ DaimoPay createOrder error:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException('Payment initialization failed');
    }
  }

  async verify(dto: any) {
    //   // Call Daimo API / check on-chain transaction
    //   // const { payment } = await this.createOrder(dto);

    //    // Fetch Payment record
    //   const payment = await this.prisma.payment.findFirst({
    //         where: { vendorPaymentId : data.id },
    //         include: { order: true },
    //       });

    //   if (!payment) throw new BadRequestException('Payment record not found');

    //   if (payment && payment.status === 'payment_complete') {
    //     return { success: true };
    //   }
    return { success: false };
  }

  async verifyDaimoPayment(payId: string) {
    try {
      if (!payId) throw new NotFoundException('Missing payId');

      // 1️⃣ Call Daimo Payments API
      const response = await axios.get(
        `https://pay.daimo.com/api/payment/${payId}`,
        {
          headers: {
            'Api-Key': this.DAIMO_API_KEY,
          },
        },
      );

      const payment = response.data;

      console.log('🧾 Daimo payment fetched:', payment);

      // 2️⃣ Check payment status
      if (payment.status === 'payment_complete') {
        // 3️⃣ Update DB (mark as paid)
        // await this.prisma.payment.update({
        //   where: { vendorPaymentId: payId },
        //   data: {
        //     status: 'paid',
        //     verified: true,
        //   },
        // });

        return { success: true, message: '✅ Payment verified successfully' };
      } else {
        return {
          success: false,
          message: `⚠️ Payment not completed. Current status: ${payment.status}`,
        };
      }
    } catch (error) {
      console.error(
        '❌ Error verifying Daimo payment:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to verify Daimo payment');
    }
  }
}
