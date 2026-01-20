-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEntityTypeEnum" ADD VALUE 'MULTISIG_ACCOUNT';
ALTER TYPE "ActivityEntityTypeEnum" ADD VALUE 'MULTISIG_PROPOSAL';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "public_key" TEXT;

-- CreateTable
CREATE TABLE "multisig_account_members" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "multisig_account_id" INTEGER NOT NULL,
    "team_member_id" INTEGER NOT NULL,
    "metadata" JSON,

    CONSTRAINT "multisig_account_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "multisig_account_members_uuid_key" ON "multisig_account_members"("uuid");

-- CreateIndex
CREATE INDEX "multisig_account_members_multisig_account_id_idx" ON "multisig_account_members"("multisig_account_id");

-- CreateIndex
CREATE INDEX "multisig_account_members_team_member_id_idx" ON "multisig_account_members"("team_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "multisig_account_members_multisig_account_id_team_member_id_key" ON "multisig_account_members"("multisig_account_id", "team_member_id");

-- AddForeignKey
ALTER TABLE "multisig_account_members" ADD CONSTRAINT "multisig_account_members_multisig_account_id_fkey" FOREIGN KEY ("multisig_account_id") REFERENCES "multisig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multisig_account_members" ADD CONSTRAINT "multisig_account_members_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
