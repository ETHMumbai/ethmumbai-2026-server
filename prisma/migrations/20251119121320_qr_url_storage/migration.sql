/*
  Warnings:

  - A unique constraint covering the columns `[qrHash]` on the table `GeneratedTicket` will be added. If there are existing duplicate values, this will fail.
  - Made the column `qrHash` on table `GeneratedTicket` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "GeneratedTicket" ALTER COLUMN "qrHash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedTicket_qrHash_key" ON "GeneratedTicket"("qrHash");
