/*
  Warnings:

  - A unique constraint covering the columns `[invoiceNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "invoiceNumber" TEXT;

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last" INTEGER NOT NULL,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");
