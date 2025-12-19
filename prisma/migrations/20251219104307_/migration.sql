/*
  Warnings:

  - A unique constraint covering the columns `[checkoutSessionId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `checkoutSessionId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `Participant` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."Order_buyerId_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "checkoutSessionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Participant" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutSessionId_key" ON "Order"("checkoutSessionId");
