import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export function generateTicketCode(email: string): string {
  const hash = crypto.createHash('sha256').update(email).digest('hex');
  const shortHash = hash.substring(0, 8); // first 8 chars
  const random = Math.random().toString(36).substring(2, 6); // adds randomness
  return `${shortHash}-${random}`.toUpperCase();
}

export async function generateInvoiceNumberForOrder(
  prisma: PrismaService,
  orderId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.order.count({
      
    });
    console.log('Current invoice count:', count);

    const invoiceNo = `ETHM${String(count + 1).padStart(5, '0')}`;

    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { invoiceNumber: invoiceNo },
      });

      return invoiceNo;
    } catch (err: any) {
      // Prisma unique constraint error
      if (err.code !== 'P2002') throw err;
    }
  }

  throw new Error('Failed to generate unique invoice number');
}

