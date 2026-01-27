/**
 * Shared enums for Qash monorepo
 * 
 * These enums are copied from Prisma-generated types to avoid circular dependencies.
 * They should be kept in sync with the Prisma schema.
 */

// Team Member Enums
export const TeamMemberRoleEnum = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  REVIEWER: 'REVIEWER',
  VIEWER: 'VIEWER'
} as const;

export type TeamMemberRoleEnum = (typeof TeamMemberRoleEnum)[keyof typeof TeamMemberRoleEnum];

export const TeamMemberStatusEnum = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED'
} as const;

export type TeamMemberStatusEnum = (typeof TeamMemberStatusEnum)[keyof typeof TeamMemberStatusEnum];

// Activity Log Enums
export const ActivityActionEnum = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  INVITE: 'INVITE',
  ACCEPT_INVITATION: 'ACCEPT_INVITATION',
  REJECT_INVITATION: 'REJECT_INVITATION',
  CHANGE_ROLE: 'CHANGE_ROLE',
  SUSPEND: 'SUSPEND',
  ACTIVATE: 'ACTIVATE',
  SEND: 'SEND',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  PAY: 'PAY',
  CANCEL: 'CANCEL'
} as const;

export type ActivityActionEnum = (typeof ActivityActionEnum)[keyof typeof ActivityActionEnum];

export const ActivityEntityTypeEnum = {
  TEAM_MEMBER: 'TEAM_MEMBER',
  EMPLOYEE: 'EMPLOYEE',
  CLIENT: 'CLIENT',
  PAYROLL: 'PAYROLL',
  INVOICE: 'INVOICE',
  BILL: 'BILL',
  PAYMENT_LINK: 'PAYMENT_LINK',
  EMPLOYEE_GROUP: 'EMPLOYEE_GROUP',
  COMPANY: 'COMPANY',
  MULTISIG_ACCOUNT: 'MULTISIG_ACCOUNT',
  MULTISIG_PROPOSAL: 'MULTISIG_PROPOSAL'
} as const;

export type ActivityEntityTypeEnum = (typeof ActivityEntityTypeEnum)[keyof typeof ActivityEntityTypeEnum];

// Company Enums
export const CompanyTypeEnum = {
  SOLE_PROPRIETORSHIP: 'SOLE_PROPRIETORSHIP',
  PARTNERSHIP: 'PARTNERSHIP',
  LLP: 'LLP',
  LLC: 'LLC',
  PRIVATE_LIMITED_COMPANY: 'PRIVATE_LIMITED_COMPANY',
  CORPORATION: 'CORPORATION',
  PUBLIC_LIMITED_COMPANY: 'PUBLIC_LIMITED_COMPANY',
  NON_PROFIT: 'NON_PROFIT',
  OTHER: 'OTHER'
} as const;

export type CompanyTypeEnum = (typeof CompanyTypeEnum)[keyof typeof CompanyTypeEnum];

export const CompanyVerificationStatusEnum = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED'
} as const;

export type CompanyVerificationStatusEnum = (typeof CompanyVerificationStatusEnum)[keyof typeof CompanyVerificationStatusEnum];

// Employee & Payroll Enums
export const ContractTermEnum = {
  PERMANENT: 'PERMANENT',
  CONTRACTOR: 'CONTRACTOR'
} as const;

export type ContractTermEnum = (typeof ContractTermEnum)[keyof typeof ContractTermEnum];

export const PayrollStatusEnum = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DELETED: 'DELETED'
} as const;

export type PayrollStatusEnum = (typeof PayrollStatusEnum)[keyof typeof PayrollStatusEnum];

// Invoice & Bill Enums
export const InvoiceTypeEnum = {
  EMPLOYEE: 'EMPLOYEE',
  B2B: 'B2B'
} as const;

export type InvoiceTypeEnum = (typeof InvoiceTypeEnum)[keyof typeof InvoiceTypeEnum];

export const InvoiceStatusEnum = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  REVIEWED: 'REVIEWED',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  DELETED: 'DELETED'
} as const;

export type InvoiceStatusEnum = (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum];

export const BillStatusEnum = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
} as const;

export type BillStatusEnum = (typeof BillStatusEnum)[keyof typeof BillStatusEnum];

// Multisig Enums
export const MultisigProposalTypeEnum = {
  CONSUME: 'CONSUME',
  SEND: 'SEND'
} as const;

export type MultisigProposalTypeEnum = (typeof MultisigProposalTypeEnum)[keyof typeof MultisigProposalTypeEnum];

export const MultisigProposalStatusEnum = {
  PENDING: 'PENDING',
  READY: 'READY',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED'
} as const;

export type MultisigProposalStatusEnum = (typeof MultisigProposalStatusEnum)[keyof typeof MultisigProposalStatusEnum];

// Category & Notification Enums
export const CategoryShapeEnum = {
  CIRCLE: 'CIRCLE',
  DIAMOND: 'DIAMOND',
  SQUARE: 'SQUARE',
  TRIANGLE: 'TRIANGLE'
} as const;

export type CategoryShapeEnum = (typeof CategoryShapeEnum)[keyof typeof CategoryShapeEnum];

export const NotificationsStatusEnum = {
  UNREAD: 'UNREAD',
  READ: 'READ'
} as const;

export type NotificationsStatusEnum = (typeof NotificationsStatusEnum)[keyof typeof NotificationsStatusEnum];

export const NotificationsTypeEnum = {
  NOP: 'NOP'
} as const;

export type NotificationsTypeEnum = (typeof NotificationsTypeEnum)[keyof typeof NotificationsTypeEnum];

// Payment Link Enum
export const PaymentLinkStatusEnum = {
  ACTIVE: 'ACTIVE',
  DEACTIVATED: 'DEACTIVATED'
} as const;

export type PaymentLinkStatusEnum = (typeof PaymentLinkStatusEnum)[keyof typeof PaymentLinkStatusEnum];

// User Enums
export const UserRoleEnum = {
  USER: 'USER',
  ADMIN: 'ADMIN'
} as const;

export type UserRoleEnum = (typeof UserRoleEnum)[keyof typeof UserRoleEnum];

export const GenderEnum = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY',
  OTHER: 'OTHER'
} as const;

export type GenderEnum = (typeof GenderEnum)[keyof typeof GenderEnum];

// Currency Enum
export const CurrencyEnum = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY',
  AUD: 'AUD',
  CAD: 'CAD',
  CHF: 'CHF',
  CNY: 'CNY',
  HKD: 'HKD',
  SGD: 'SGD',
  AED: 'AED',
  INR: 'INR',
  KWD: 'KWD',
  SAR: 'SAR',
  QAR: 'QAR',
  MXN: 'MXN',
  BRL: 'BRL'
} as const;

export type CurrencyEnum = (typeof CurrencyEnum)[keyof typeof CurrencyEnum];
