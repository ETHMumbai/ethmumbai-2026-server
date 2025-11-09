/*
  Warnings:

  - You are about to drop the column `price` on the `Ticket` table. All the data in the column will be lost.
  - Added the required column `crypto` to the `Ticket` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fiat` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "price",
ADD COLUMN     "crypto" DOUBLE PRECISION NOT NULL DEFAULT 12,
ADD COLUMN     "fiat" DOUBLE PRECISION NOT NULL DEFAULT 999;
