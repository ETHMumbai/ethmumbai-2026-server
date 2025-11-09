/*
  Warnings:

  - You are about to drop the column `cartId` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the `Cart` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `orderId` to the `Participant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('RAZORPAY', 'DAIMO');

-- DropForeignKey
ALTER TABLE "public"."Cart" DROP CONSTRAINT "Cart_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Participant" DROP CONSTRAINT "Participant_cartId_fkey";

-- AlterTable
ALTER TABLE "Participant" DROP COLUMN "cartId",
DROP COLUMN "phone",
ADD COLUMN     "orderId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."Cart";

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "daimoPaymentId" TEXT,
    "daimoTxHash" TEXT,
    "ticketId" INTEGER NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'created',
    "paymentType" "PaymentType",
    "paymentVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
