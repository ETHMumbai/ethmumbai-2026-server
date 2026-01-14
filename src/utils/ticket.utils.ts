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
  return prisma.$transaction(async (tx) => {
    // Step 1: Atomically increment counter
    const counter = await tx.invoiceCounter.update({
      where: { id: 1 },
      data: { last: { increment: 1 } },
    });

    const invoiceNo = `ETHM${String(counter.last).padStart(5, '0')}`;

    // Step 2: Attach invoice to order
    await tx.order.update({
      where: { id: orderId },
      data: { invoiceNumber: invoiceNo },
    });

    return invoiceNo;
  });
}
