/**
 * Shared Common DTOs for Qash monorepo
 * 
 * These types define common data structures reused across multiple modules.
 */

export interface PaginationMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
