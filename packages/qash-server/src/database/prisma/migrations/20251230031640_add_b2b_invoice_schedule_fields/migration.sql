-- AlterTable
ALTER TABLE "invoice_schedules" ADD COLUMN     "auto_send" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "client_id" INTEGER,
ADD COLUMN     "company_id" INTEGER,
ALTER COLUMN "payroll_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "invoice_schedules_client_id_idx" ON "invoice_schedules"("client_id");

-- CreateIndex
CREATE INDEX "invoice_schedules_company_id_idx" ON "invoice_schedules"("company_id");

-- AddForeignKey
ALTER TABLE "invoice_schedules" ADD CONSTRAINT "invoice_schedules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_schedules" ADD CONSTRAINT "invoice_schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
