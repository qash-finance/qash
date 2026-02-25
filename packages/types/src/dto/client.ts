/**
 * Shared Client DTOs for Qash monorepo
 * 
 * These types define the contract between frontend and backend
 * for client management.
 */

import type { PaginationMetaDto } from './common.js';

// Request DTOs
export interface CreateClientDto {
  email: string;
  ccEmails?: string[];
  companyName: string;
  companyType?: string;
  country?: string;
  state?: string;
  city?: string;
  address1?: string;
  address2?: string;
  taxId?: string;
  postalCode?: string;
  registrationNumber?: string;
}

export interface UpdateClientDto {
  email?: string;
  ccEmails?: string[];
  companyName?: string;
  companyType?: string;
  country?: string;
  state?: string;
  city?: string;
  address1?: string;
  address2?: string;
  taxId?: string;
  postalCode?: string;
  registrationNumber?: string;
}

// Response DTOs
export interface ClientResponseDto {
  id: number;
  uuid: string;
  email: string;
  companyName: string;
  companyType?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address1?: string | null;
  address2?: string | null;
  taxId?: string | null;
  postalCode?: string | null;
  registrationNumber?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Pagination DTOs
export interface PaginatedClientsResponseDto {
  data: ClientResponseDto[];
  pagination: PaginationMetaDto;
}

// Query DTOs
export interface ClientQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}
