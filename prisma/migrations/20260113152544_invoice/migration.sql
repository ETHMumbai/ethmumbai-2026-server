/*
  Warnings:

  - A unique constraint covering the columns `[nvoiceNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "nvoiceNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_nvoiceNumber_key" ON "Order"("nvoiceNumber");
