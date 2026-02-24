/**
 * Shared Company DTOs for Qash monorepo
 * 
 * These types define the contract between frontend and backend
 * for company management and administration.
 */

import type { CompanyTypeEnum, CompanyVerificationStatusEnum } from '../enums/index.js';
import type { PaginationMetaDto } from './common.js';

// Request DTOs
export interface CreateCompanyDto {
  companyOwnerFirstName: string;
  companyOwnerLastName: string;
  companyName: string;
  registrationNumber?: string;
  companyType?: CompanyTypeEnum;
  country?: string;
  address1?: string;
  address2?: string;
  city?: string;
  postalCode?: string;
  metadata?: any;
  logo?: string;
}

export interface UpdateCompanyDto {
  companyName?: string;
  companyType?: CompanyTypeEnum;
  notificationEmail?: string;
  country?: string;
  address1?: string;
  address2?: string;
  city?: string;
  postalCode?: string;
  metadata?: any;
  logo?: string;
}

export interface UpdateVerificationStatusDto {
  verificationStatus: CompanyVerificationStatusEnum;
}

export interface CompanySearchQueryDto {
  verificationStatus?: CompanyVerificationStatusEnum;
  companyType?: CompanyTypeEnum;
  country?: string;
  isActive?: boolean;
  search?: string;
}

// Response DTOs
export interface CompanyResponseDto {
  uuid: string;
  id: number;
  companyName: string;
  registrationNumber?: string | null;
  companyType?: CompanyTypeEnum | null;
  country?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  verificationStatus: CompanyVerificationStatusEnum;
  isActive: boolean;
  createdBy: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  metadata?: any;
  logo?: string;
}

// Type alias for backwards compatibility
export type Company = CompanyResponseDto;

export interface CompanyTeamMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  position?: string;
  role: string;
  isActive: boolean;
  joinedAt: Date | string;
}

export interface CompanyWithTeamResponseDto extends CompanyResponseDto {
  teamMembers: CompanyTeamMember[];
  creator: {
    id: number;
    email: string;
  };
}

export interface CompanyStatsResponseDto {
  total: number;
  verified: number;
  pending: number;
  underReview: number;
  rejected: number;
}

export interface IsEmployeeResponseDto {
  isEmployee: boolean;
}

export interface CompanyInfoDto {
  id: number;
  uuid?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  companyName?: string;
  registrationNumber?: string;
  companyType?: CompanyTypeEnum;
  taxId?: string | null;
  notificationEmail?: string | null;
  country?: string;
  address1?: string;
  address2?: string | null;
  city?: string;
  postalCode?: string;
  verificationStatus?: CompanyVerificationStatusEnum;
  isActive?: boolean;
  metadata?: Record<string, any> | null;
}
