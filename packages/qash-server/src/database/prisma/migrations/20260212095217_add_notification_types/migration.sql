-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'MULTISIG_ACCOUNT_CREATED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'MULTISIG_PROPOSAL_CREATED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'MULTISIG_PROPOSAL_READY';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'MULTISIG_PROPOSAL_EXECUTED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'MULTISIG_PROPOSAL_REJECTED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'MULTISIG_PROPOSAL_FAILED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'PAYMENT_RECEIVED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'PAYMENT_SENT';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'PAYMENT_LINK_CREATED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'PAYMENT_LINK_ACTIVATED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'PAYMENT_LINK_DEACTIVATED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'INVOICE_CREATED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'INVOICE_SENT';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'INVOICE_REVIEWED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'INVOICE_CONFIRMED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'INVOICE_PAID';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'INVOICE_OVERDUE';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'INVOICE_SCHEDULED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'BILL_CREATED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'BILL_PENDING';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'BILL_PROPOSED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'BILL_PAID';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'PAYROLL_CREATED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'PAYROLL_ACTIVE';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'PAYROLL_PAUSED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'PAYROLL_COMPLETED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'EMPLOYEE_ADDED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'EMPLOYEE_UPDATED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'EMPLOYEE_REMOVED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'TEAM_MEMBER_INVITED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'TEAM_MEMBER_JOINED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'TEAM_MEMBER_ROLE_CHANGED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'COMPANY_VERIFIED';
ALTER TYPE "NotificationsTypeEnum" ADD VALUE 'COMPANY_VERIFICATION_REJECTED';
