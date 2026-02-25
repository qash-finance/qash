/*
  Warnings:

  - You are about to drop the column `amount` on the `multisig_proposals` table. All the data in the column will be lost.
  - You are about to drop the column `faucet_id` on the `multisig_proposals` table. All the data in the column will be lost.
  - You are about to drop the column `recipient_id` on the `multisig_proposals` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "BillStatusEnum" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "multisig_proposal_id" INTEGER;

-- AlterTable
ALTER TABLE "multisig_proposals" DROP COLUMN "amount",
DROP COLUMN "faucet_id",
DROP COLUMN "recipient_id";

-- CreateIndex
CREATE INDEX "bills_multisig_proposal_id_idx" ON "bills"("multisig_proposal_id");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_multisig_proposal_id_fkey" FOREIGN KEY ("multisig_proposal_id") REFERENCES "multisig_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
