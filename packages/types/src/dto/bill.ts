/**
 * Shared Bill DTOs for Qash monorepo
 * 
 * These types define the contract between frontend and backend
 * for bill management.
 */

import { BillStatusEnum } from '../enums/index.js';
import { PaginationMetaDto } from './common.js';

export interface BillQueryDto {
  page?: number;
  limit?: number;
  status?: BillStatusEnum;
  groupId?: number;
  search?: string;
}

export interface BillStatsDto {
  totalBills: number;
  totalPending: number;
  totalPaid: number;
  totalOverdue: number;
  totalAmount: string;
  pendingAmount: string;
  paidAmount: string;
  overdueAmount: string;
}

export interface PayBillsDto {
  billUUIDs: string[];
  transactionHash?: string;
}

export interface BillTimelineDto {
  event: string;
  timestamp: string | Date;
  metadata?: Record<string, any>;
}

export interface BatchPaymentResultDto {
  totalAmount: string;
}

export interface BillModelDto {
  id: number;
  uuid: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  companyId?: number;
  invoiceId?: number;
  status: BillStatusEnum;
  paidAt?: string | null;
  transactionHash?: string | null;
  metadata?: Record<string, any>;
  invoice?: any;
  company?: any;
}

export interface PaginatedBillsResponseDto {
  bills: BillModelDto[];
  pagination: PaginationMetaDto;
}

export interface DeleteBillResponseDto {
  message?: string;
}

// Type aliases for backwards compatibility
export type BillModel = BillModelDto;
