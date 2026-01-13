/*
  Warnings:

  - You are about to drop the column `nvoiceNumber` on the `Order` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Order_nvoiceNumber_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "nvoiceNumber",
ADD COLUMN     "invoiceNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");
