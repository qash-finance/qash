/**
 * Shared Payroll DTOs for Qash monorepo
 * 
 * These types define the contract between frontend and backend
 * for payroll management.
 */

import type { ContractTermEnum } from '../enums/index.js';
import type { TokenDto } from './token.js';
import type { NetworkDto } from './network.js';
import type { PaginationMetaDto } from './common.js';

// Request DTOs
export interface CreatePayrollDto {
  employeeId: number;
  network: NetworkDto;
  token: TokenDto;
  contractTerm: ContractTermEnum;
  payrollCycle: number;
  amount: string;
  payday: number;
  joiningDate: string;
  description: string;
  note?: string;
  metadata?: Record<string, any>;
  generateDaysBefore?: number;
}

export interface CreatePayroll {
  employeeId: number;
  network: NetworkDto;
  token: TokenDto;
  contractTerm: ContractTermEnum;
  payrollCycle: number;
  amount: string;
  joiningDate: string;
  payday: number;
  generateDaysBefore?: number;
  description: string;
  note?: string;
  metadata?: Record<string, any>;
}

export interface UpdatePayrollDto {
  description?: string;
  paydayDay?: number;
  network?: NetworkDto;
  token?: TokenDto;
  contractTerm?: ContractTermEnum;
  payrollCycle?: number;
  amount?: string;
  note?: string;
  metadata?: Record<string, any>;
}

export interface PayrollQueryDto {
  page?: number;
  limit?: number;
  employeeId?: number;
  contractTerm?: ContractTermEnum;
  search?: string;
}

// Response DTOs
export interface PayrollStatsDto {
  totalActive: number;
  totalPaused: number;
  totalCompleted: number;
  totalMonthlyAmount: string;
  dueThisMonth: number;
}

export interface PendingInvoiceReviewsDto {
  hasPendingReviews: boolean;
  pendingCount?: number;
  pendingInvoiceUuids?: string[];
}

export interface PayrollModelDto {
  id: number;
  employeeId: number;
  companyId: number;
  network: NetworkDto;
  token: TokenDto;
  contractTerm: ContractTermEnum;
  payrollCycle: number;
  amount: string;
  payStartDate: string;
  joiningDate: string;
  payEndDate: string;
  description: string;
  employee: {
    id: number;
    name: string;
    walletAddress: string;
    email: string;
    groupId?: number;
    token: {
      address: string;
      symbol: string;
    };
    uuid: string;
    network: NetworkDto;
    order: number;
    companyId: number;
  };
  invoices: any[];
  note?: string;
  metadata?: Record<string, any>;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  paydayDay: number;
}

export interface PaginatedPayrollsResponseDto {
  payrolls: PayrollModelDto[];
  pagination: PaginationMetaDto;
}

// Type aliases for backwards compatibility
export type PayrollModel = PayrollModelDto;
