/*
  Warnings:

  - Added the required column `remainingQuantity` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 99,
ADD COLUMN     "remainingQuantity" INTEGER NOT NULL;
