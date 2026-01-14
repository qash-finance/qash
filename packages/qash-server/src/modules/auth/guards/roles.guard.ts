import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TeamMemberRoleEnum } from '../../../database/generated/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ErrorTeamMember } from '../../../common/constants/errors';
import { TeamMemberRepository } from '../../team-member/team-member.repository';

/**
 * Guard that checks if the current user has one of the required roles.
 * Must be used after CompanyAuthGuard (via @CompanyAuth decorator).
 *
 * This guard:
 * 1. Extracts required roles from @Roles() decorator
 * 2. Gets current user's team member role from the company
 * 3. Checks if user's role is in the allowed list
 *
 * Role hierarchy: OWNER > ADMIN > REVIEWER > VIEWER
 *
 * @example
 * ```typescript
 * @CompanyAuth()
 * @UseGuards(RolesGuard)
 * @Roles(TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN)
 * @Post('employees')
 * createEmployee() { ... }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private teamMemberRepository: TeamMemberRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<
      TeamMemberRoleEnum[]
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // If no roles specified, allow access (rely on other guards)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user has company context (set by CompanyAuthGuard)
    if (!user?.company?.id || !user?.internalUserId) {
      this.logger.warn(
        'RolesGuard called without company context. Ensure @CompanyAuth() is applied.',
      );
      throw new ForbiddenException(ErrorTeamMember.AccessDenied);
    }

    // Get user's role in the company
    const userRole = await this.teamMemberRepository.getUserRoleInCompany(
      user.company.id,
      user.internalUserId,
    );

    if (!userRole) {
      this.logger.warn(
        `User ${user.internalUserId} has no active role in company ${user.company.id}`,
      );
      throw new ForbiddenException(ErrorTeamMember.AccessDenied);
    }

    // Check if user's role is in the allowed list
    if (!requiredRoles.includes(userRole)) {
      this.logger.warn(
        `User ${user.internalUserId} with role ${userRole} denied access. Required: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
    }

    // Attach role to request for use in controllers
    request.user.teamMemberRole = userRole;

    return true;
  }
}
