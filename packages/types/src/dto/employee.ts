/**
 * Shared Employee DTOs for Qash monorepo
 * 
 * These types define the contract between frontend and backend
 * for employee/contact and group management.
 */

import type { CategoryShapeEnum } from '../enums/index.js';
import type { PaginationMetaDto } from './common.js';
import { NetworkDto } from './network.js';
import { TokenDto } from './token.js';

// Request DTOs - Company Groups
export interface CreateCompanyGroupDto {
  name: string;
  shape: CategoryShapeEnum;
  color: string;
}

// Request DTOs - Contacts/Employees
export interface CreateContactDto {
  groupId: number;
  name: string;
  walletAddress: string;
  email?: string;
  token?: TokenDto;
  network: NetworkDto;
}

export interface UpdateAddressBookDto {
  name?: string;
  walletAddress?: string;
  address?: string; // Legacy alias for walletAddress
  email?: string;
  token?: TokenDto;
  groupId?: number;
  network?: NetworkDto;
}

export interface AddressBookNameDuplicateDto {
  name: string;
  category: string;
  userAddress: string;
}

// Bulk operations
export interface DeleteAddressBookDto {
  ids: number[];
}

export interface BulkDeleteEmployeesDto {
  ids: number[];
}

export interface AddressBookOrderDto {
  id: number;
  order: number;
}

export interface CategoryOrderDto {
  categoryIds: number[];
}

// Response DTOs - Groups
export interface CompanyGroupResponseDto {
  id: number;
  name: string;
  shape: CategoryShapeEnum;
  color: string;
  order: number;
  companyId: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Response DTOs - Contacts
export interface CompanyContactResponseDto {
  id: number;
  name: string;
  walletAddress: string;
  email?: string;
  description?: string;
  token: TokenDto;
  network: NetworkDto;
  groupId: number;
  companyId: number;
  order?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Response DTOs - Paginated results
export interface PaginatedContactsResponseDto {
  data: CompanyContactResponseDto[];
  pagination: PaginationMetaDto;
}

export interface PaginatedGroupsResponseDto {
  data: CompanyGroupResponseDto[];
  pagination: PaginationMetaDto;
}

// Response DTOs - Statistics
export interface EmployeeStatisticsDto {
  totalContacts: number;
  totalGroups: number;
  contactsByGroup: Record<string, number>;
}
