/**
 * Shared Team Member DTOs for Qash monorepo
 * 
 * These types define the contract between frontend and backend.
 * Server DTOs implement these interfaces with validation decorators.
 */

import type { TeamMemberRoleEnum, TeamMemberStatusEnum } from '../enums/index.js';

// Request DTOs
export interface CreateTeamMemberDto {
  firstName: string;
  lastName?: string;
  email: string;
  position?: string;
  profilePicture?: string;
  role: TeamMemberRoleEnum;
  companyId: number;
  metadata?: Record<string, any>;
}

export interface UpdateTeamMemberDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  position?: string;
  profilePicture?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTeamMemberRoleDto {
  role: TeamMemberRoleEnum;
}

export interface InviteTeamMemberDto {
  firstName: string;
  lastName?: string;
  email: string;
  position?: string;
  role: TeamMemberRoleEnum;
  metadata?: Record<string, any>;
}

export interface AcceptInvitationDto {
  profilePicture?: string;
  metadata?: Record<string, any>;
}

export interface AcceptInvitationByTokenDto {
  token: string;
}

export interface BulkInviteTeamMembersDto {
  members: InviteTeamMemberDto[];
}

// Query DTOs
export interface TeamMemberSearchQueryDto {
  role?: TeamMemberRoleEnum;
  status?: TeamMemberStatusEnum;
  hasUser?: boolean;
  search?: string;
}

// Response DTOs
export interface TeamMemberResponseDto {
  id: number;
  uuid: string;
  firstName: string;
  lastName: string;
  position?: string;
  profilePicture?: string;
  role: TeamMemberRoleEnum;
  status: TeamMemberStatusEnum;
  companyId: number;
  user?: {
    id: number;
    email: string;
    publicKey: string;
    avatar?: string;
    [key: string]: any;
  };
  userId?: number;
  invitedBy?: number;
  invitedAt?: Date | string;
  joinedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  metadata?: Record<string, any>;
}

export interface TeamMemberWithRelationsResponseDto extends TeamMemberResponseDto {
  company?: {
    id: number;
    companyName: string;
    registrationNumber: string;
    [key: string]: any;
  };
  user?: {
    id: number;
    email: string;
    publicKey: string;
    avatar?: string;
    [key: string]: any;
  };
  inviter?: {
    id: number;
    email: string;
    [key: string]: any;
  };
}

export interface TeamMemberStatsResponseDto {
  total: number;
  owners: number;
  admins: number;
  reviewers: number;
  viewers: number;
  active: number;
  pending: number;
  suspended: number;
}
