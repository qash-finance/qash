/*
  Warnings:

  - You are about to drop the column `is_active` on the `team_members` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[invitation_token]` on the table `team_members` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ActivityActionEnum" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'INVITE', 'ACCEPT_INVITATION', 'REJECT_INVITATION', 'CHANGE_ROLE', 'SUSPEND', 'ACTIVATE', 'SEND', 'APPROVE', 'REJECT', 'PAY', 'CANCEL');

-- CreateEnum
CREATE TYPE "ActivityEntityTypeEnum" AS ENUM ('TEAM_MEMBER', 'EMPLOYEE', 'CLIENT', 'PAYROLL', 'INVOICE', 'BILL', 'PAYMENT_LINK', 'EMPLOYEE_GROUP', 'COMPANY');

-- CreateEnum
CREATE TYPE "TeamMemberStatusEnum" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "TeamMemberRoleEnum" ADD VALUE 'REVIEWER';

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "created_by_team_member_id" INTEGER,
ADD COLUMN     "updated_by_team_member_id" INTEGER;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "created_by_team_member_id" INTEGER,
ADD COLUMN     "updated_by_team_member_id" INTEGER;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "created_by_team_member_id" INTEGER,
ADD COLUMN     "updated_by_team_member_id" INTEGER;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "created_by_team_member_id" INTEGER,
ADD COLUMN     "updated_by_team_member_id" INTEGER;

-- AlterTable
ALTER TABLE "payment_link" ADD COLUMN     "created_by_team_member_id" INTEGER,
ADD COLUMN     "updated_by_team_member_id" INTEGER;

-- AlterTable
ALTER TABLE "payrolls" ADD COLUMN     "created_by_team_member_id" INTEGER,
ADD COLUMN     "updated_by_team_member_id" INTEGER;

-- AlterTable
ALTER TABLE "team_members" DROP COLUMN "is_active",
ADD COLUMN     "invitation_expires_at" TIMESTAMP(6),
ADD COLUMN     "invitation_token" VARCHAR(255),
ADD COLUMN     "status" "TeamMemberStatusEnum" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" INTEGER NOT NULL,
    "team_member_id" INTEGER NOT NULL,
    "action" "ActivityActionEnum" NOT NULL,
    "entity_type" "ActivityEntityTypeEnum" NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "entity_uuid" VARCHAR(255),
    "previous_values" JSON,
    "new_values" JSON,
    "description" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "metadata" JSON,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_logs_uuid_key" ON "activity_logs"("uuid");

-- CreateIndex
CREATE INDEX "activity_logs_company_id_idx" ON "activity_logs"("company_id");

-- CreateIndex
CREATE INDEX "activity_logs_team_member_id_idx" ON "activity_logs"("team_member_id");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_idx" ON "activity_logs"("entity_type");

-- CreateIndex
CREATE INDEX "activity_logs_entity_id_idx" ON "activity_logs"("entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_company_id_created_at_idx" ON "activity_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_company_id_entity_type_idx" ON "activity_logs"("company_id", "entity_type");

-- CreateIndex
CREATE INDEX "bills_created_by_team_member_id_idx" ON "bills"("created_by_team_member_id");

-- CreateIndex
CREATE INDEX "bills_updated_by_team_member_id_idx" ON "bills"("updated_by_team_member_id");

-- CreateIndex
CREATE INDEX "clients_created_by_team_member_id_idx" ON "clients"("created_by_team_member_id");

-- CreateIndex
CREATE INDEX "clients_updated_by_team_member_id_idx" ON "clients"("updated_by_team_member_id");

-- CreateIndex
CREATE INDEX "employees_created_by_team_member_id_idx" ON "employees"("created_by_team_member_id");

-- CreateIndex
CREATE INDEX "employees_updated_by_team_member_id_idx" ON "employees"("updated_by_team_member_id");

-- CreateIndex
CREATE INDEX "invoices_created_by_team_member_id_idx" ON "invoices"("created_by_team_member_id");

-- CreateIndex
CREATE INDEX "invoices_updated_by_team_member_id_idx" ON "invoices"("updated_by_team_member_id");

-- CreateIndex
CREATE INDEX "payment_link_created_by_team_member_id_idx" ON "payment_link"("created_by_team_member_id");

-- CreateIndex
CREATE INDEX "payment_link_updated_by_team_member_id_idx" ON "payment_link"("updated_by_team_member_id");

-- CreateIndex
CREATE INDEX "payrolls_created_by_team_member_id_idx" ON "payrolls"("created_by_team_member_id");

-- CreateIndex
CREATE INDEX "payrolls_updated_by_team_member_id_idx" ON "payrolls"("updated_by_team_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_invitation_token_key" ON "team_members"("invitation_token");

-- CreateIndex
CREATE INDEX "team_members_status_idx" ON "team_members"("status");

-- CreateIndex
CREATE INDEX "team_members_invitation_token_idx" ON "team_members"("invitation_token");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_team_member_id_fkey" FOREIGN KEY ("created_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_updated_by_team_member_id_fkey" FOREIGN KEY ("updated_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_team_member_id_fkey" FOREIGN KEY ("created_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_updated_by_team_member_id_fkey" FOREIGN KEY ("updated_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_created_by_team_member_id_fkey" FOREIGN KEY ("created_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_updated_by_team_member_id_fkey" FOREIGN KEY ("updated_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_team_member_id_fkey" FOREIGN KEY ("created_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updated_by_team_member_id_fkey" FOREIGN KEY ("updated_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_team_member_id_fkey" FOREIGN KEY ("created_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_updated_by_team_member_id_fkey" FOREIGN KEY ("updated_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_link" ADD CONSTRAINT "payment_link_created_by_team_member_id_fkey" FOREIGN KEY ("created_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_link" ADD CONSTRAINT "payment_link_updated_by_team_member_id_fkey" FOREIGN KEY ("updated_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
