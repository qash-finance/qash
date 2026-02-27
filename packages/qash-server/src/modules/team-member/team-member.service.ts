import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { TeamMemberRepository } from './team-member.repository';
import { CompanyRepository } from '../company/company.repository';
import { MailService } from '../mail/mail.service';
import { NotificationService } from '../notification/notification.service';
import { UserRepository } from '../auth/repositories/user.repository';
import {
  CreateTeamMemberDto,
  UpdateTeamMemberDto,
  InviteTeamMemberDto,
  TeamMemberSearchQueryDto,
  AcceptInvitationDto,
  BulkInviteTeamMembersDto,
  AcceptInvitationByTokenDto,
  UpdateAvatarDto,
  UpdateAvatarResponseDto,
} from './team-member.dto';
import {
  NotificationsTypeEnum,
  TeamMemberRoleEnum,
  TeamMemberStatusEnum,
} from '../../database/generated/client';
import { ErrorCompany, ErrorTeamMember } from 'src/common/constants/errors';
import { PrismaService } from 'src/database/prisma.service';
import { handleError } from 'src/common/utils/errors';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { CompanyModel } from 'src/database/generated/models';
import { TeamMember } from 'src/database/generated/browser';

@Injectable()
export class TeamMemberService {
  private readonly logger = new Logger(TeamMemberService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly teamMemberRepository: TeamMemberRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly userRepository: UserRepository,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create team member directly (internal use)
   */
  async createTeamMember(
    userId: number,
    createTeamMemberDto: CreateTeamMemberDto,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { companyId } = createTeamMemberDto;

        // Check if user can manage team
        const canManage = await this.teamMemberRepository.hasPermission(
          companyId,
          userId,
          [TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN],
          tx,
        );

        if (!canManage) {
          throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
        }

        // Check if email is already invited
        const existing = await this.teamMemberRepository.findByCompanyAndEmail(
          companyId,
          createTeamMemberDto.email,
          tx,
        );

        if (existing) {
          throw new ConflictException(ErrorTeamMember.EmailAlreadyExists);
        }

        // Check if user with this email already exists globally
        const existingUser = await this.userRepository.findByEmail(
          createTeamMemberDto.email,
          tx,
        );

        if (existingUser) {
          // User exists and belongs to another company (1:1 relationship)
          throw new ConflictException(
            ErrorTeamMember.EmailBelongsToAnotherCompany,
          );
        }

        // Create user (required for 1:1 relationship)
        const user = await this.userRepository.create(
          {
            email: createTeamMemberDto.email,
          },
          tx,
        );

        return this.teamMemberRepository.create(
          {
            ...createTeamMemberDto,
            user: {
              connect: {
                id: user.id,
              },
            },
            inviter: {
              connect: {
                id: userId,
              },
            },
            company: {
              connect: {
                id: companyId,
              },
            },
          },
          tx,
        );
      });
    } catch (error) {
      this.logger.error('Failed to create team member:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Invite team member via email
   */
  async inviteTeamMember(
    userId: number,
    companyId: number,
    inviteDto: InviteTeamMemberDto,
  ) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Check if user can manage team
        const canManage = await this.teamMemberRepository.hasPermission(
          companyId,
          userId,
          [TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN],
          tx,
        );

        if (!canManage) {
          throw new ForbiddenException(
            ErrorTeamMember.InsufficientPermissionsToInvite,
          );
        }

        // Get company details
        const company = await this.companyRepository.findById(companyId, tx);
        if (!company) {
          throw new NotFoundException(ErrorCompany.CompanyNotFound);
        }

        // Check if email is already invited
        const existing = await this.teamMemberRepository.findByCompanyAndEmail(
          companyId,
          inviteDto.email,
          tx,
        );

        if (existing) {
          throw new ConflictException(ErrorTeamMember.EmailAlreadyInvited);
        }

        // Generate invitation token with 7-day expiry
        const invitationToken = randomUUID();
        const invitationExpiresAt = new Date();
        invitationExpiresAt.setDate(invitationExpiresAt.getDate() + 7);

        // Check if user with this email already exists globally
        const existingUser = await this.userRepository.findByEmail(
          inviteDto.email,
          tx,
        );

        if (existingUser) {
          // User exists and belongs to another company (1:1 relationship)
          throw new ConflictException(
            ErrorTeamMember.EmailBelongsToAnotherCompany,
          );
        }

        // Create user (required for 1:1 relationship)
        const user = await this.userRepository.create(
          {
            email: inviteDto.email,
          },
          tx,
        );

        // Create team member record with PENDING status
        const teamMember = await this.teamMemberRepository.create(
          {
            firstName: inviteDto.firstName,
            lastName: inviteDto.lastName,
            position: inviteDto.position,
            role: inviteDto.role,
            status: TeamMemberStatusEnum.PENDING,
            invitationToken,
            invitationExpiresAt,
            invitedAt: new Date(),
            company: {
              connect: {
                id: companyId,
              },
            },
            user: {
              connect: {
                id: user.id,
              },
            },
            inviter: {
              connect: {
                id: userId,
              },
            },
            metadata: inviteDto.metadata,
          },
          tx,
        );

        // Send invitation email
        try {
          const stats = await this.teamMemberRepository.getCompanyStats(
            companyId,
            tx,
          );
          await this.sendInvitationEmail(
            teamMember,
            company,
            invitationToken,
            inviteDto.email,
            stats.total,
          );
        } catch (error) {
          this.logger.error('Failed to send invitation email:', error);
          // Don't throw error, invitation is created but email failed
        }

        return {
          ...teamMember,
          email: inviteDto.email,
        };
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to invite team member:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Bulk invite team members
   */
  async bulkInviteTeamMembers(
    userId: number,
    companyId: number,
    bulkInviteDto: BulkInviteTeamMembersDto,
  ) {
    try {
      // Check if user can manage team
      const canManage = await this.teamMemberRepository.hasPermission(
        companyId,
        userId,
        [TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN],
      );

      if (!canManage) {
        throw new ForbiddenException(
          ErrorTeamMember.InsufficientPermissionsToInvite,
        );
      }

      // Execute invites in parallel and collect results
      const settled = await Promise.allSettled(
        bulkInviteDto.members.map((member) =>
          this.inviteTeamMember(userId, companyId, member),
        ),
      );

      const successful: any[] = [];
      const failed: Array<{ email: string; error: string }> = [];

      for (let i = 0; i < settled.length; i++) {
        const res = settled[i];
        const member = bulkInviteDto.members[i];

        if (res.status === 'fulfilled') {
          successful.push(res.value);
        } else {
          const err = res.reason;
          const message = err instanceof Error ? err.message : JSON.stringify(err);
          failed.push({ email: member.email, error: message });
        }
      }

      return {
        successful,
        failed,
        totalProcessed: bulkInviteDto.members.length,
        successCount: successful.length,
        failureCount: failed.length,
      };
    } catch (error) {
      this.logger.error('Failed to bulk invite team members:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get team member by ID
   */
  async getTeamMemberById(teamMemberId: number, userId: number) {
    try {
      const teamMember =
        await this.teamMemberRepository.findByIdWithRelations(teamMemberId);

      if (!teamMember) {
        throw new NotFoundException(ErrorTeamMember.NotFound);
      }

      // Check if user has access to this company
      const hasAccess = await this.teamMemberRepository.hasPermission(
        teamMember.companyId,
        userId,
        [
          TeamMemberRoleEnum.OWNER,
          TeamMemberRoleEnum.ADMIN,
          TeamMemberRoleEnum.REVIEWER,
          TeamMemberRoleEnum.VIEWER,
        ],
      );

      if (!hasAccess) {
        throw new ForbiddenException(ErrorTeamMember.AccessDenied);
      }

      return teamMember;
    } catch (error) {
      this.logger.error('Failed to get team member by ID:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get team members for company
   */
  async getCompanyTeamMembers(
    companyId: number,
    userId: number,
    filters?: TeamMemberSearchQueryDto,
  ) {
    try {
      // Check if user has access to company
      const hasAccess = await this.teamMemberRepository.hasPermission(
        companyId,
        userId,
        [
          TeamMemberRoleEnum.OWNER,
          TeamMemberRoleEnum.ADMIN,
          TeamMemberRoleEnum.REVIEWER,
          TeamMemberRoleEnum.VIEWER,
        ],
      );

      if (!hasAccess) {
        throw new ForbiddenException(ErrorTeamMember.AccessDenied);
      }

      return this.teamMemberRepository.findByCompany(companyId, filters);
    } catch (error) {
      this.logger.error('Failed to get company team members:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Update team member
   */
  async updateTeamMember(
    teamMemberId: number,
    userId: number,
    updateDto: UpdateTeamMemberDto,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const teamMember =
          await this.teamMemberRepository.findByIdWithRelations(
            teamMemberId,
            tx,
          );
        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.NotFound);
        }

        // Check if user can manage team or is updating their own profile
        const canManage = await this.teamMemberRepository.hasPermission(
          teamMember.companyId,
          userId,
          [TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN],
          tx,
        );

        const isOwnProfile = teamMember.userId === userId;

        if (!canManage && !isOwnProfile) {
          throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
        }

        // If updating email, check for conflicts
        if (updateDto.email && updateDto.email !== teamMember.user?.email) {
          const existing =
            await this.teamMemberRepository.findByCompanyAndEmail(
              teamMember.companyId,
              updateDto.email,
              tx,
            );

          if (existing && existing.id !== teamMemberId) {
            throw new ConflictException(ErrorTeamMember.EmailAlreadyExists);
          }
        }

        return this.teamMemberRepository.updateById(
          teamMemberId,
          updateDto,
          tx,
        );
      });
    } catch (error) {
      this.logger.error(`Failed to update team member ${teamMemberId}:`, error);
      handleError(error, this.logger);
    }
  }

  /**
   * Update team member avatar
   */
  async updateAvatar(
    teamMemberId: number,
    userId: number,
    avatarUrl: string,
  ): Promise<UpdateAvatarResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const teamMember =
          await this.teamMemberRepository.findByIdWithRelations(
            teamMemberId,
            tx,
          );
        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.NotFound);
        }

        // Check if user can update: own profile or admin
        const canManage = await this.teamMemberRepository.hasPermission(
          teamMember.companyId,
          userId,
          [TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN],
          tx,
        );

        const isOwnProfile = teamMember.userId === userId;

        if (!canManage && !isOwnProfile) {
          throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
        }

        const updated = await this.teamMemberRepository.updateById(
          teamMemberId,
          { profilePicture: avatarUrl },
          tx,
        );

        return {
          profilePicture: updated.profilePicture || '',
        };
      });
    } catch (error) {
      this.logger.error(`Failed to update avatar for team member ${teamMemberId}:`, error);
      handleError(error, this.logger);
    }
  }

  /**
   * Update team member role
   */
  async updateTeamMemberRole(
    teamMemberId: number,
    userId: number,
    newRole: TeamMemberRoleEnum,
  ) {
    try {
      const updatedMember = await this.prisma.$transaction(async (tx) => {
        const teamMember = await this.teamMemberRepository.findById(
          teamMemberId,
          tx,
        );
        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.NotFound);
        }

        // Only OWNER can change roles for ADMIN, and ADMIN can change REVIEWER/VIEWER roles
        const userRole = await this.teamMemberRepository.getUserRoleInCompany(
          teamMember.companyId,
          userId,
          tx,
        );

        if (!userRole) {
          throw new ForbiddenException(ErrorTeamMember.AccessDenied);
        }

        // Cannot change OWNER role - only one OWNER per company
        if (newRole === TeamMemberRoleEnum.OWNER) {
          throw new ForbiddenException(ErrorTeamMember.CannotAssignOwnerRole);
        }

        // Role change permissions based on hierarchy: OWNER > ADMIN > REVIEWER > VIEWER
        if (userRole === TeamMemberRoleEnum.OWNER) {
          // Owner can change any role except to OWNER (handled above)
        } else if (userRole === TeamMemberRoleEnum.ADMIN) {
          // Admin cannot change OWNER or other ADMIN roles
          if (
            teamMember.role === TeamMemberRoleEnum.OWNER ||
            teamMember.role === TeamMemberRoleEnum.ADMIN ||
            newRole === TeamMemberRoleEnum.ADMIN
          ) {
            throw new ForbiddenException(
              ErrorTeamMember.InsufficientPermissions,
            );
          }
        } else {
          // REVIEWER and VIEWER cannot change roles
          throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
        }

        return this.teamMemberRepository.updateRole(teamMemberId, newRole, tx);
      });

      setTimeout(async () => {
        await this.notifyTeamMemberRoleChanged(
          updatedMember.companyId,
          updatedMember.userId,
          updatedMember.id,
          newRole,
        );
      }, 0);

      return updatedMember;
    } catch (error) {
      this.logger.error(
        `Failed to update team member role ${teamMemberId}:`,
        error,
      );
      handleError(error, this.logger);
    }
  }

  /**
   * Remove team member
   */
  async removeTeamMember(teamMemberId: number, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const teamMember = await this.teamMemberRepository.findById(
          teamMemberId,
          tx,
        );
        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.NotFound);
        }

        // Get the requesting user's role
        const userRole = await this.teamMemberRepository.getUserRoleInCompany(
          teamMember.companyId,
          userId,
          tx,
        );

        if (!userRole) {
          throw new ForbiddenException(ErrorTeamMember.AccessDenied);
        }

        // Cannot remove the OWNER
        if (teamMember.role === TeamMemberRoleEnum.OWNER) {
          throw new BadRequestException(ErrorTeamMember.CannotRemoveOwner);
        }

        // Only OWNER can remove ADMIN members
        if (
          teamMember.role === TeamMemberRoleEnum.ADMIN &&
          userRole !== TeamMemberRoleEnum.OWNER
        ) {
          throw new ForbiddenException(
            ErrorTeamMember.OnlyOwnerCanRemoveAdmin,
          );
        }

        // ADMIN can remove REVIEWER and VIEWER
        if (
          userRole !== TeamMemberRoleEnum.OWNER &&
          userRole !== TeamMemberRoleEnum.ADMIN
        ) {
          throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
        }

        // Permanently delete the team member (not just suspend)
        const deletedTeamMember = await this.teamMemberRepository.delete({ id: teamMemberId }, tx);

        // Nullify any invitedBy references from this user on other team members to avoid FK constraint
        if (deletedTeamMember.userId) {
          const model = tx.teamMember;
          await model.updateMany({
            where: { invitedBy: deletedTeamMember.userId },
            data: { invitedBy: null },
          });

          // Also delete the associated User account (1:1 relationship)
          await this.userRepository.delete({ id: deletedTeamMember.userId }, tx);
        }

        return deletedTeamMember;
      });
    } catch (error) {
      this.logger.error(`Failed to remove team member ${teamMemberId}:`, error);
      handleError(error, this.logger);
    }
  }

  /**
   * Suspend team member
   */
  async suspendTeamMember(teamMemberId: number, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const teamMember = await this.teamMemberRepository.findById(
          teamMemberId,
          tx,
        );
        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.NotFound);
        }

        // Get the requesting user's role
        const userRole = await this.teamMemberRepository.getUserRoleInCompany(
          teamMember.companyId,
          userId,
          tx,
        );

        if (!userRole) {
          throw new ForbiddenException(ErrorTeamMember.AccessDenied);
        }

        // Cannot suspend the OWNER
        if (teamMember.role === TeamMemberRoleEnum.OWNER) {
          throw new BadRequestException(ErrorTeamMember.CannotRemoveOwner);
        }

        // Only OWNER can suspend ADMIN members
        if (
          teamMember.role === TeamMemberRoleEnum.ADMIN &&
          userRole !== TeamMemberRoleEnum.OWNER
        ) {
          throw new ForbiddenException(
            ErrorTeamMember.OnlyOwnerCanRemoveAdmin,
          );
        }

        // ADMIN can suspend REVIEWER and VIEWER
        if (
          userRole !== TeamMemberRoleEnum.OWNER &&
          userRole !== TeamMemberRoleEnum.ADMIN
        ) {
          throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
        }

        return this.teamMemberRepository.suspend(teamMemberId, tx);
      });
    } catch (error) {
      this.logger.error(
        `Failed to suspend team member ${teamMemberId}:`,
        error,
      );
      handleError(error, this.logger);
    }
  }

  /**
   * Reactivate suspended team member
   */
  async reactivateTeamMember(teamMemberId: number, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const teamMember = await this.teamMemberRepository.findById(
          teamMemberId,
          tx,
        );
        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.NotFound);
        }

        // Only SUSPENDED members can be reactivated
        if (teamMember.status !== TeamMemberStatusEnum.SUSPENDED) {
          throw new BadRequestException(ErrorTeamMember.NotSuspended);
        }

        // Get the requesting user's role
        const userRole = await this.teamMemberRepository.getUserRoleInCompany(
          teamMember.companyId,
          userId,
          tx,
        );

        if (!userRole) {
          throw new ForbiddenException(ErrorTeamMember.AccessDenied);
        }

        // Only OWNER can reactivate ADMIN members
        if (
          teamMember.role === TeamMemberRoleEnum.ADMIN &&
          userRole !== TeamMemberRoleEnum.OWNER
        ) {
          throw new ForbiddenException(
            ErrorTeamMember.InsufficientPermissions,
          );
        }

        // ADMIN can reactivate REVIEWER and VIEWER
        if (
          userRole !== TeamMemberRoleEnum.OWNER &&
          userRole !== TeamMemberRoleEnum.ADMIN
        ) {
          throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
        }

        return this.teamMemberRepository.activate(teamMemberId, tx);
      });
    } catch (error) {
      this.logger.error(
        `Failed to reactivate team member ${teamMemberId}:`,
        error,
      );
      handleError(error, this.logger);
    }
  }

  /**
   * Accept invitation by token (from email link)
   */
  async acceptInvitationByToken(token: string) {
    try {
      const activatedMember = await this.prisma.$transaction(async (tx) => {
        const teamMember =
          await this.teamMemberRepository.findByInvitationToken(token, tx);

        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.InvalidInvitationToken);
        }

        if (teamMember.status !== TeamMemberStatusEnum.PENDING) {
          throw new BadRequestException(ErrorTeamMember.InvitationNotActive);
        }

        // Check if invitation has expired
        if (
          teamMember.invitationExpiresAt &&
          new Date() > teamMember.invitationExpiresAt
        ) {
          throw new GoneException(ErrorTeamMember.InvitationExpired);
        }

        // Activate the team member
        return this.teamMemberRepository.activate(teamMember.id, tx);
      });

      setTimeout(async () => {
        await this.notifyTeamMemberJoined(
          activatedMember.companyId,
          activatedMember.id,
          activatedMember.userId,
        );
      }, 0);

      return activatedMember;
    } catch (error) {
      this.logger.error('Failed to accept invitation by token:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Resend invitation email
   */
  async resendInvitation(teamMemberId: number, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const teamMember =
          await this.teamMemberRepository.findByIdWithRelations(
            teamMemberId,
            tx,
          );

        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.NotFound);
        }

        if (teamMember.status !== TeamMemberStatusEnum.PENDING) {
          throw new BadRequestException(ErrorTeamMember.NotPendingInvitation);
        }

        // Check if user can manage team
        const canManage = await this.teamMemberRepository.hasPermission(
          teamMember.companyId,
          userId,
          [TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN],
          tx,
        );

        if (!canManage) {
          throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
        }

        // Generate new invitation token with 7-day expiry
        const invitationToken = randomUUID();
        const invitationExpiresAt = new Date();
        invitationExpiresAt.setDate(invitationExpiresAt.getDate() + 7);

        await this.teamMemberRepository.updateInvitationToken(
          teamMemberId,
          invitationToken,
          invitationExpiresAt,
          tx,
        );

        // Get company details
        const company = await this.companyRepository.findById(
          teamMember.companyId,
          tx,
        );
        if (!company) {
          throw new NotFoundException(ErrorCompany.CompanyNotFound);
        }

        // Send invitation email
        const stats = await this.teamMemberRepository.getCompanyStats(
          teamMember.companyId,
          tx,
        );
        await this.sendInvitationEmail(
          { ...teamMember, invitationToken },
          company,
          invitationToken,
          teamMember.user?.email,
          stats.total,
        );

        return { message: 'Invitation resent successfully' };
      });
    } catch (error) {
      this.logger.error(
        `Failed to resend invitation for team member ${teamMemberId}:`,
        error,
      );
      handleError(error, this.logger);
    }
  }

  /**
   * Accept invitation (when user creates account) - deprecated, use acceptInvitationByToken
   */
  async acceptInvitation(
    teamMemberId: number,
    userId: number,
    acceptDto?: AcceptInvitationDto,
  ) {
    try {
      const activatedMember = await this.prisma.$transaction(async (tx) => {
        const teamMember = await this.teamMemberRepository.findById(
          teamMemberId,
          tx,
        );
        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.NotFound);
        }

        // Check if team member is the current user
        if (teamMember.userId !== userId) {
          throw new ForbiddenException(ErrorTeamMember.AccessDenied);
        }

        if (teamMember.status !== TeamMemberStatusEnum.PENDING) {
          throw new BadRequestException(ErrorTeamMember.InvitationNotActive);
        }

        // Prepare update data
        const updateData: any = {
          status: TeamMemberStatusEnum.ACTIVE,
          joinedAt: new Date(),
          invitationToken: null,
          invitationExpiresAt: null,
        };

        if (acceptDto?.profilePicture) {
          updateData.profilePicture = acceptDto.profilePicture;
        }

        if (acceptDto?.metadata) {
          const existingMetadata =
            teamMember.metadata && typeof teamMember.metadata === 'object'
              ? teamMember.metadata
              : {};
          updateData.metadata = {
            ...existingMetadata,
            ...acceptDto.metadata,
          };
        }

        return this.teamMemberRepository.updateById(
          teamMemberId,
          updateData,
          tx,
        );
      });

      setTimeout(async () => {
        await this.notifyTeamMemberJoined(
          activatedMember.companyId,
          activatedMember.id,
          activatedMember.userId,
        );
      }, 0);

      return activatedMember;
    } catch (error) {
      this.logger.error(`Failed to accept invitation ${teamMemberId}:`, error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get pending invitations for user email
   */
  async getPendingInvitations(email: string) {
    try {
      return await this.teamMemberRepository.findPendingInvitationsByEmail(
        email,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get pending invitations for email ${email}:`,
        error,
      );
      handleError(error, this.logger);
    }
  }

  /**
   * Get team member statistics for company
   */
  async getTeamStats(companyId: number, userId: number) {
    try {
      // Check access
      const hasAccess = await this.teamMemberRepository.hasPermission(
        companyId,
        userId,
        [
          TeamMemberRoleEnum.OWNER,
          TeamMemberRoleEnum.ADMIN,
          TeamMemberRoleEnum.REVIEWER,
          TeamMemberRoleEnum.VIEWER,
        ],
      );

      if (!hasAccess) {
        throw new ForbiddenException(ErrorTeamMember.AccessDenied);
      }

      return await this.teamMemberRepository.getCompanyStats(companyId);
    } catch (error) {
      this.logger.error(
        `Failed to get team stats for company ${companyId}:`,
        error,
      );
      handleError(error, this.logger);
    }
  }

  /**
   * Get user's team membership (single company since 1:1 relationship)
   */
  async getUserMemberships(userId: number) {
    try {
      const teamMember = await this.teamMemberRepository.findByUserId(userId);
      return teamMember ? [teamMember] : []; // Return as array for backward compatibility
    } catch (error) {
      this.logger.error(
        `Failed to get user memberships for user ${userId}:`,
        error,
      );
      handleError(error, this.logger);
    }
  }

  /**
   * Get user's single team membership
   */
  async getUserMembership(userId: number) {
    try {
      return await this.teamMemberRepository.findByUserId(userId);
    } catch (error) {
      this.logger.error(
        `Failed to get user membership for user ${userId}:`,
        error,
      );
      handleError(error, this.logger);
    }
  }

  private async notifyTeamMemberJoined(
    companyId: number,
    teamMemberId: number,
    userId: number | null,
  ): Promise<void> {
    try {
      const recipients = await this.prisma.teamMember.findMany({
        where: {
          companyId,
          status: TeamMemberStatusEnum.ACTIVE,
        },
        include: { user: true },
      });

      for (const recipient of recipients) {
        if (recipient.user) {
          await this.notificationService.createNotification({
            title: 'Team Member Joined',
            message: 'A new team member has joined your company.',
            type: NotificationsTypeEnum.TEAM_MEMBER_JOINED,
            userId: recipient.user.id,
            metadata: {
              companyId,
              teamMemberId,
              joinedUserId: userId,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to send team joined notifications:', error);
    }
  }

  private async notifyTeamMemberRoleChanged(
    companyId: number,
    affectedUserId: number | null,
    teamMemberId: number,
    newRole: TeamMemberRoleEnum,
  ): Promise<void> {
    try {
      if (affectedUserId) {
        await this.notificationService.createNotification({
          title: 'Your Team Role Changed',
          message: `Your role has been updated to ${newRole}.`,
          type: NotificationsTypeEnum.TEAM_MEMBER_ROLE_CHANGED,
          userId: affectedUserId,
          metadata: {
            companyId,
            teamMemberId,
            newRole,
          },
        });
      }

      const owners = await this.prisma.teamMember.findMany({
        where: {
          companyId,
          role: TeamMemberRoleEnum.OWNER,
        },
        include: { user: true },
      });

      for (const owner of owners) {
        if (owner.user) {
          await this.notificationService.createNotification({
            title: 'Team Member Role Changed',
            message: `A team member role has been updated to ${newRole}.`,
            type: NotificationsTypeEnum.TEAM_MEMBER_ROLE_CHANGED,
            userId: owner.user.id,
            metadata: {
              companyId,
              teamMemberId,
              newRole,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to send role change notifications:', error);
    }
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(
    teamMember: TeamMember,
    company: CompanyModel,
    invitationToken: string,
    toEmail: string,
    teamMemberCount: number,
  ) {
    const subject = `Invitation to join ${company.companyName}`;
    const html = this.getInvitationEmailTemplate(
      teamMember,
      company,
      invitationToken,
      teamMemberCount,
      toEmail
    );

    const mailgunDomain = this.configService.get<string>('MAILGUN_DOMAIN');

    const fromEmail = 'noreply@' + mailgunDomain;

    const emailData = {
      to: toEmail,
      fromEmail,
      subject,
      html,
    };

    await this.mailService.sendEmail(emailData);
  }

  /**
   * Get invitation email template
   */
  private getInvitationEmailTemplate(
    teamMember: TeamMember,
    company: CompanyModel,
    invitationToken: string,
    teamMemberCount: number,
    toEmail: string,
  ): string {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const acceptUrl = `${frontendUrl}/team-invite?token=${invitationToken}&company=${encodeURIComponent(company.companyName)}&teamMemberCount=${teamMemberCount}&email=${encodeURIComponent(toEmail)}${company.logo ? `&companyLogo=${encodeURIComponent(company.logo)}` : ''}`;
    const firstName = teamMember.firstName || 'there';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
      </head>
      <body style="margin: 0; padding: 0; background: #0e3ee0; font-family: 'Barlow', Arial, sans-serif; color: #0f172a;">
        <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/top.png" style="height: 50px; width: 100%; display: block;" alt=""/>
        <div style="width: 100%; background: #0e3ee0; padding: 32px 12px; box-sizing: border-box;">
          <div style="max-width: 720px; margin: 0 auto; background: #f5f7fb; overflow: hidden;">
            <div style="padding: 24px 24px 0 24px; text-align: left; border-bottom: 1px solid rgba(153, 160, 174, 0.24);">
              <p style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: #1b1b1b; line-height: 1;">Your invitation to join ${company.companyName}</p>
            </div>
            <div style="padding: 24px 24px 0 24px;">
              <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
                <p style="font-size: 14px; font-weight: 600; margin: 0; color: #1b1b1b; line-height: 20px;">Hi ${firstName},</p>
                <p style="font-size: 14px; font-weight: 500; margin: 0; color: #848484; line-height: 20px;">You've been invited to join the ${company.companyName} on Qash. Please click the button below to accept the invitation.</p>
              </div>
            </div>
            <div style="padding: 24px 24px; border-top: 1px dashed rgba(153, 160, 174, 0.4); text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(0deg, #002c69 0%, #0061e7 100%); border-radius: 10px; padding: 2px; margin: 0;">
                <tr>
                  <td align="center" style="background: #066eff; border-top: 2px solid #4888ff; border-radius: 8px; padding: 8px 12px;">
                    <a href="${acceptUrl}" style="color: white; font-size: 14px; text-decoration: none; font-weight: 500; display: block; line-height: 20px;">Join now</a>
                  </td>
                </tr>
              </table>
            </div>
            <div style="padding: 0 24px 28px 24px; font-size: 13px; color: #6b7280; line-height: 1.5;">
              <p style="margin: 0;">This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
