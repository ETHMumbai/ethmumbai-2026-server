import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  payment: any;
  async onModuleInit() {
    await this.$connect();
    console.log('Connected to the database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Disconnected from the database');
  }
}
