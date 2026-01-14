import { SetMetadata } from '@nestjs/common';
import { TeamMemberRoleEnum } from '../../../database/generated/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles are allowed to access a route.
 * Must be used with @CompanyAuth() decorator and RolesGuard.
 *
 * Role hierarchy (highest to lowest):
 * - OWNER: Full company management, can remove ADMINs
 * - ADMIN: Full CRUD operations, cannot remove other ADMINs
 * - REVIEWER: Can view and approve transactions
 * - VIEWER: Read-only access
 *
 * @example
 * ```typescript
 * // Only OWNER and ADMIN can create employees
 * @Roles(TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN)
 * @Post('employees')
 * createEmployee() { ... }
 *
 * // All authenticated roles can view
 * @Roles(TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN, TeamMemberRoleEnum.REVIEWER, TeamMemberRoleEnum.VIEWER)
 * @Get('employees')
 * getEmployees() { ... }
 * ```
 */
export const Roles = (...roles: TeamMemberRoleEnum[]) =>
  SetMetadata(ROLES_KEY, roles);

/**
 * Helper decorators for common role combinations
 */
export const AdminOnly = () =>
  Roles(TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN);

export const OwnerOnly = () => Roles(TeamMemberRoleEnum.OWNER);

export const ReviewerAndAbove = () =>
  Roles(
    TeamMemberRoleEnum.OWNER,
    TeamMemberRoleEnum.ADMIN,
    TeamMemberRoleEnum.REVIEWER,
  );

export const AllRoles = () =>
  Roles(
    TeamMemberRoleEnum.OWNER,
    TeamMemberRoleEnum.ADMIN,
    TeamMemberRoleEnum.REVIEWER,
    TeamMemberRoleEnum.VIEWER,
  );
