/*
  Warnings:

  - You are about to drop the column `checkoutSessionId` on the `Order` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Order_checkoutSessionId_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "checkoutSessionId";
