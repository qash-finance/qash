-- AlterEnum
ALTER TYPE "MultisigProposalStatusEnum" ADD VALUE 'REJECTED';

-- CreateTable
CREATE TABLE "multisig_rejections" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "proposal_id" INTEGER NOT NULL,
    "team_member_id" INTEGER NOT NULL,
    "reason" TEXT,

    CONSTRAINT "multisig_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "multisig_rejections_uuid_key" ON "multisig_rejections"("uuid");

-- CreateIndex
CREATE INDEX "multisig_rejections_proposal_id_idx" ON "multisig_rejections"("proposal_id");

-- CreateIndex
CREATE INDEX "multisig_rejections_team_member_id_idx" ON "multisig_rejections"("team_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "multisig_rejections_proposal_id_team_member_id_key" ON "multisig_rejections"("proposal_id", "team_member_id");

-- AddForeignKey
ALTER TABLE "multisig_rejections" ADD CONSTRAINT "multisig_rejections_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "multisig_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multisig_rejections" ADD CONSTRAINT "multisig_rejections_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
