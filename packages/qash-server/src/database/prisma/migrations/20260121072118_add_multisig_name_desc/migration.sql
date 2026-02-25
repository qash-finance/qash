/*
  Warnings:

  - Added the required column `name` to the `multisig_accounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "multisig_accounts" ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" VARCHAR(255) NOT NULL;
