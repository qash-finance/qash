-- CreateEnum
CREATE TYPE "ContractTermEnum" AS ENUM ('PERMANENT', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "PayrollStatusEnum" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'DELETED');

-- CreateEnum
CREATE TYPE "InvoiceTypeEnum" AS ENUM ('EMPLOYEE', 'B2B');

-- CreateEnum
CREATE TYPE "InvoiceStatusEnum" AS ENUM ('DRAFT', 'SENT', 'REVIEWED', 'CONFIRMED', 'CANCELLED', 'PAID', 'OVERDUE', 'DELETED');

-- CreateEnum
CREATE TYPE "BillStatusEnum" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CategoryShapeEnum" AS ENUM ('CIRCLE', 'DIAMOND', 'SQUARE', 'TRIANGLE');

-- CreateEnum
CREATE TYPE "NotificationsStatusEnum" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "NotificationsTypeEnum" AS ENUM ('NOP');

-- CreateEnum
CREATE TYPE "PaymentLinkStatusEnum" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "CompanyTypeEnum" AS ENUM ('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'LLC', 'PRIVATE_LIMITED_COMPANY', 'CORPORATION', 'PUBLIC_LIMITED_COMPANY', 'NON_PROFIT', 'OTHER');

-- CreateEnum
CREATE TYPE "CompanyVerificationStatusEnum" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TeamMemberRoleEnum" AS ENUM ('OWNER', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserRoleEnum" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "GenderEnum" AS ENUM ('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "UserRoleEnum" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "position" VARCHAR(100),
    "profile_picture" TEXT,
    "role" "TeamMemberRoleEnum" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "company_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "invited_by" INTEGER,
    "invited_at" TIMESTAMP(6),
    "joined_at" TIMESTAMP(6),
    "metadata" JSON,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "registration_number" VARCHAR(100) NOT NULL,
    "company_type" "CompanyTypeEnum" NOT NULL,
    "tax_id" VARCHAR(100),
    "notification_email" VARCHAR(255),
    "cc_notifications" VARCHAR(255)[],
    "country" VARCHAR(100) NOT NULL,
    "address_1" VARCHAR(255) NOT NULL,
    "address_2" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(20) NOT NULL,
    "verification_status" "CompanyVerificationStatusEnum" NOT NULL DEFAULT 'PENDING',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSON,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "walletAddress" VARCHAR NOT NULL,
    "email" VARCHAR NOT NULL,
    "token" JSON NOT NULL,
    "network" JSON NOT NULL,
    "gender" "GenderEnum" DEFAULT 'PREFER_NOT_TO_SAY',
    "nationality" VARCHAR(100),
    "tax_id" TEXT,
    "address" VARCHAR(255),
    "city" VARCHAR(100),
    "country" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "order" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "metadata" JSON,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_groups" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "name" VARCHAR NOT NULL,
    "shape" "CategoryShapeEnum" NOT NULL DEFAULT 'CIRCLE',
    "color" VARCHAR NOT NULL,
    "order" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,

    CONSTRAINT "employee_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrolls" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "network" JSON NOT NULL,
    "token" JSON NOT NULL,
    "amount" VARCHAR(50) NOT NULL,
    "contractTerm" "ContractTermEnum" NOT NULL,
    "payroll_cycle" INTEGER NOT NULL,
    "current_cycle_number" INTEGER NOT NULL DEFAULT 0,
    "payday_day" INTEGER NOT NULL,
    "joining_date" TIMESTAMP(6) NOT NULL,
    "pay_start_date" TIMESTAMP(6) NOT NULL,
    "pay_end_date" TIMESTAMP(6) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PayrollStatusEnum" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "metadata" JSON,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "invoice_type" "InvoiceTypeEnum" NOT NULL DEFAULT 'EMPLOYEE',
    "invoice_number" VARCHAR(50) NOT NULL,
    "issue_date" TIMESTAMP(6) NOT NULL,
    "due_date" TIMESTAMP(6) NOT NULL,
    "is_auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "auto_generate_from_payroll_id" INTEGER,
    "next_auto_generate_date" TIMESTAMP(6),
    "payroll_id" INTEGER,
    "employee_id" INTEGER,
    "from_company_id" INTEGER,
    "to_company_id" INTEGER,
    "to_company_name" VARCHAR(255),
    "to_company_email" VARCHAR(255),
    "to_company_address" TEXT,
    "to_company_tax_id" VARCHAR(100),
    "to_company_contact_name" VARCHAR(255),
    "to_company_metadata" JSON,
    "email_to" VARCHAR(255) NOT NULL,
    "email_cc" VARCHAR(255)[],
    "email_bcc" VARCHAR(255)[],
    "email_subject" VARCHAR(500),
    "email_body" TEXT,
    "from_details" JSON,
    "to_details" JSON,
    "subtotal" VARCHAR(50) NOT NULL,
    "taxRate" VARCHAR(10) NOT NULL,
    "taxAmount" VARCHAR(50) NOT NULL,
    "discount" VARCHAR(50) NOT NULL DEFAULT '0.00',
    "total" VARCHAR(50) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "payment_network" JSON NOT NULL,
    "payment_token" JSON NOT NULL,
    "payment_wallet_address" VARCHAR(255) NOT NULL,
    "status" "InvoiceStatusEnum" NOT NULL DEFAULT 'DRAFT',
    "sent_at" TIMESTAMP(6),
    "reviewed_at" TIMESTAMP(6),
    "confirmed_at" TIMESTAMP(6),
    "paid_at" TIMESTAMP(6),
    "metadata" JSON,
    "memo" JSON,
    "footer" JSON,
    "terms" JSON,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" VARCHAR(50) NOT NULL,
    "unitPrice" VARCHAR(50) NOT NULL,
    "unit" VARCHAR(50),
    "taxRate" VARCHAR(10) NOT NULL DEFAULT '0.00',
    "discount" VARCHAR(50) NOT NULL DEFAULT '0.00',
    "total" VARCHAR(50) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSON,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_schedules" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "payroll_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "frequency" VARCHAR(50) NOT NULL,
    "day_of_month" INTEGER,
    "day_of_week" INTEGER,
    "generate_days_before" INTEGER NOT NULL DEFAULT 0,
    "next_generate_date" TIMESTAMP(6),
    "last_generated_at" TIMESTAMP(6),
    "invoice_template" JSON,
    "metadata" JSON,

    CONSTRAINT "invoice_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "status" "BillStatusEnum" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(6),
    "transaction_hash" VARCHAR(100),
    "metadata" JSON,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_link" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "code" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "title" VARCHAR NOT NULL,
    "description" VARCHAR NOT NULL,
    "amount" VARCHAR NOT NULL,
    "status" "PaymentLinkStatusEnum" NOT NULL DEFAULT 'ACTIVE',
    "order" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "payment_wallet_address" VARCHAR NOT NULL,
    "accepted_tokens" JSONB NOT NULL,
    "accepted_chains" JSONB,

    CONSTRAINT "payment_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_link_record" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "payer" VARCHAR NOT NULL,
    "txid" VARCHAR,
    "payment_link_id" INTEGER NOT NULL,
    "token" JSONB,
    "chain" JSONB,

    CONSTRAINT "payment_link_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "type" "NotificationsTypeEnum" NOT NULL,
    "status" "NotificationsStatusEnum" NOT NULL DEFAULT 'UNREAD',
    "metadata" JSONB,
    "action_url" VARCHAR,
    "wallet_address" VARCHAR NOT NULL,
    "read_at" TIMESTAMP(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_uuid_key" ON "team_members"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_user_id_key" ON "team_members"("user_id");

-- CreateIndex
CREATE INDEX "team_members_company_id_idx" ON "team_members"("company_id");

-- CreateIndex
CREATE INDEX "team_members_role_idx" ON "team_members"("role");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_uuid_key" ON "companies"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "companies_registration_number_key" ON "companies"("registration_number");

-- CreateIndex
CREATE INDEX "companies_registration_number_idx" ON "companies"("registration_number");

-- CreateIndex
CREATE INDEX "companies_company_name_idx" ON "companies"("company_name");

-- CreateIndex
CREATE INDEX "companies_verification_status_idx" ON "companies"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_uuid_key" ON "employees"("uuid");

-- CreateIndex
CREATE INDEX "employees_company_id_idx" ON "employees"("company_id");

-- CreateIndex
CREATE INDEX "employees_groupId_idx" ON "employees"("groupId");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employee_groups_uuid_key" ON "employee_groups"("uuid");

-- CreateIndex
CREATE INDEX "employee_groups_company_id_idx" ON "employee_groups"("company_id");

-- CreateIndex
CREATE INDEX "employee_groups_order_idx" ON "employee_groups"("order");

-- CreateIndex
CREATE UNIQUE INDEX "employee_groups_company_id_name_key" ON "employee_groups"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_uuid_key" ON "payrolls"("uuid");

-- CreateIndex
CREATE INDEX "payrolls_company_id_idx" ON "payrolls"("company_id");

-- CreateIndex
CREATE INDEX "payrolls_employee_id_idx" ON "payrolls"("employee_id");

-- CreateIndex
CREATE INDEX "payrolls_status_idx" ON "payrolls"("status");

-- CreateIndex
CREATE INDEX "payrolls_pay_start_date_idx" ON "payrolls"("pay_start_date");

-- CreateIndex
CREATE INDEX "payrolls_pay_end_date_idx" ON "payrolls"("pay_end_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_uuid_key" ON "invoices"("uuid");

-- CreateIndex
CREATE INDEX "invoices_payroll_id_idx" ON "invoices"("payroll_id");

-- CreateIndex
CREATE INDEX "invoices_employee_id_idx" ON "invoices"("employee_id");

-- CreateIndex
CREATE INDEX "invoices_from_company_id_idx" ON "invoices"("from_company_id");

-- CreateIndex
CREATE INDEX "invoices_to_company_id_idx" ON "invoices"("to_company_id");

-- CreateIndex
CREATE INDEX "invoices_invoice_type_idx" ON "invoices"("invoice_type");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_invoice_number_idx" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX "invoices_is_auto_generated_idx" ON "invoices"("is_auto_generated");

-- CreateIndex
CREATE INDEX "invoices_auto_generate_from_payroll_id_idx" ON "invoices"("auto_generate_from_payroll_id");

-- CreateIndex
CREATE INDEX "invoices_next_auto_generate_date_idx" ON "invoices"("next_auto_generate_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_items_uuid_key" ON "invoice_items"("uuid");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_items_order_idx" ON "invoice_items"("order");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_schedules_uuid_key" ON "invoice_schedules"("uuid");

-- CreateIndex
CREATE INDEX "invoice_schedules_payroll_id_idx" ON "invoice_schedules"("payroll_id");

-- CreateIndex
CREATE INDEX "invoice_schedules_is_active_idx" ON "invoice_schedules"("is_active");

-- CreateIndex
CREATE INDEX "invoice_schedules_next_generate_date_idx" ON "invoice_schedules"("next_generate_date");

-- CreateIndex
CREATE UNIQUE INDEX "bills_uuid_key" ON "bills"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "bills_invoice_id_key" ON "bills"("invoice_id");

-- CreateIndex
CREATE INDEX "bills_company_id_idx" ON "bills"("company_id");

-- CreateIndex
CREATE INDEX "bills_status_idx" ON "bills"("status");

-- CreateIndex
CREATE INDEX "bills_invoice_id_idx" ON "bills"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_link_uuid_key" ON "payment_link"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "payment_link_code_key" ON "payment_link"("code");

-- CreateIndex
CREATE INDEX "payment_link_code_idx" ON "payment_link"("code");

-- CreateIndex
CREATE INDEX "payment_link_company_id_idx" ON "payment_link"("company_id");

-- CreateIndex
CREATE INDEX "payment_link_order_idx" ON "payment_link"("order");

-- CreateIndex
CREATE UNIQUE INDEX "payment_link_record_uuid_key" ON "payment_link_record"("uuid");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_wallet_address_idx" ON "notifications"("wallet_address");

-- CreateIndex
CREATE INDEX "notifications_wallet_address_created_at_idx" ON "notifications"("wallet_address", "created_at");

-- CreateIndex
CREATE INDEX "notifications_wallet_address_status_idx" ON "notifications"("wallet_address", "status");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "employee_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_groups" ADD CONSTRAINT "employee_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_from_company_id_fkey" FOREIGN KEY ("from_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_to_company_id_fkey" FOREIGN KEY ("to_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_schedules" ADD CONSTRAINT "invoice_schedules_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_link" ADD CONSTRAINT "payment_link_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_link_record" ADD CONSTRAINT "payment_link_record_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_link"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
