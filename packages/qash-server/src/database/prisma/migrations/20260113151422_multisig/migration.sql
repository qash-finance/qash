-- CreateEnum
CREATE TYPE "MultisigProposalTypeEnum" AS ENUM ('CONSUME', 'SEND');

-- CreateEnum
CREATE TYPE "MultisigProposalStatusEnum" AS ENUM ('PENDING', 'READY', 'EXECUTED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "multisig_accounts" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "account_id" VARCHAR(255) NOT NULL,
    "public_keys" VARCHAR(255)[],
    "threshold" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "metadata" JSON,

    CONSTRAINT "multisig_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multisig_proposals" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "account_id" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "proposal_type" "MultisigProposalTypeEnum" NOT NULL DEFAULT 'CONSUME',
    "summary_commitment" VARCHAR(255) NOT NULL,
    "summary_bytes_hex" TEXT NOT NULL,
    "request_bytes_hex" TEXT NOT NULL,
    "note_ids" VARCHAR(255)[],
    "recipient_id" VARCHAR(255),
    "faucet_id" VARCHAR(255),
    "amount" VARCHAR(50),
    "status" "MultisigProposalStatusEnum" NOT NULL DEFAULT 'PENDING',
    "transaction_id" VARCHAR(255),
    "metadata" JSON,

    CONSTRAINT "multisig_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multisig_signatures" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "proposal_id" INTEGER NOT NULL,
    "approver_index" INTEGER NOT NULL,
    "approver_public_key" VARCHAR(255) NOT NULL,
    "signature_hex" TEXT NOT NULL,
    "metadata" JSON,

    CONSTRAINT "multisig_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "multisig_accounts_uuid_key" ON "multisig_accounts"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "multisig_accounts_account_id_key" ON "multisig_accounts"("account_id");

-- CreateIndex
CREATE INDEX "multisig_accounts_company_id_idx" ON "multisig_accounts"("company_id");

-- CreateIndex
CREATE INDEX "multisig_accounts_account_id_idx" ON "multisig_accounts"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "multisig_proposals_uuid_key" ON "multisig_proposals"("uuid");

-- CreateIndex
CREATE INDEX "multisig_proposals_account_id_idx" ON "multisig_proposals"("account_id");

-- CreateIndex
CREATE INDEX "multisig_proposals_status_idx" ON "multisig_proposals"("status");

-- CreateIndex
CREATE INDEX "multisig_proposals_created_at_idx" ON "multisig_proposals"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "multisig_signatures_uuid_key" ON "multisig_signatures"("uuid");

-- CreateIndex
CREATE INDEX "multisig_signatures_proposal_id_idx" ON "multisig_signatures"("proposal_id");

-- CreateIndex
CREATE UNIQUE INDEX "multisig_signatures_proposal_id_approver_index_key" ON "multisig_signatures"("proposal_id", "approver_index");

-- AddForeignKey
ALTER TABLE "multisig_accounts" ADD CONSTRAINT "multisig_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multisig_proposals" ADD CONSTRAINT "multisig_proposals_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "multisig_accounts"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multisig_signatures" ADD CONSTRAINT "multisig_signatures_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "multisig_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
