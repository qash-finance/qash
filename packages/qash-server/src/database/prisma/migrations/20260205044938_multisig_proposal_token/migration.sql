/*
  Warnings:

  - Added the required column `tokens` to the `multisig_proposals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "multisig_proposals" ADD COLUMN     "tokens" JSON NOT NULL;
