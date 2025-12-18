/*
  Warnings:

  - You are about to drop the column `orderId` on the `Buyer` table. All the data in the column will be lost.
  - Made the column `buyerId` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_buyerId_fkey";

-- DropIndex
DROP INDEX "public"."Buyer_orderId_key";

-- AlterTable
ALTER TABLE "Buyer" DROP COLUMN "orderId";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "buyerId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
