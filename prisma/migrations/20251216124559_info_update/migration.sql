/*
  Warnings:

  - A unique constraint covering the columns `[buyerId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Buyer" DROP CONSTRAINT "Buyer_orderId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerId" TEXT;

-- AlterTable
ALTER TABLE "Participant" ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "lastName" DROP NOT NULL,
ALTER COLUMN "organisation" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_buyerId_key" ON "Order"("buyerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
