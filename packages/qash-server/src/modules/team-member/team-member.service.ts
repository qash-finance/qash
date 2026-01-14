import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { TeamMemberRepository } from './team-member.repository';
import { CompanyRepository } from '../company/company.repository';
import { MailService } from '../mail/mail.service';
import { UserRepository } from '../auth/repositories/user.repository';
import {
  CreateTeamMemberDto,
  UpdateTeamMemberDto,
  InviteTeamMemberDto,
  TeamMemberSearchQueryDto,
  AcceptInvitationDto,
  BulkInviteTeamMembersDto,
} from './team-member.dto';
import { TeamMemberRoleEnum } from '../../database/generated/client';
import { ErrorCompany, ErrorTeamMember } from 'src/common/constants/errors';
import { PrismaService } from 'src/database/prisma.service';
import { handleError } from 'src/common/utils/errors';

@Injectable()
export class TeamMemberService {
  private readonly logger = new Logger(TeamMemberService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly teamMemberRepository: TeamMemberRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Create team member directly (internal use)
   */
  async createTeamMember(
    userId: number,
    createTeamMemberDto: CreateTeamMemberDto,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
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

        // Create user first (required for 1:1 relationship)
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
      return await this.prisma.$transaction(async (tx) => {
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

        // Create user first (required for 1:1 relationship)
        const user = await this.userRepository.create(
          {
            email: inviteDto.email,
          },
          tx,
        );

        // Create team member record
        const teamMember = await this.teamMemberRepository.create(
          {
            firstName: inviteDto.firstName,
            lastName: inviteDto.lastName,
            position: inviteDto.position,
            role: inviteDto.role,
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
          await this.sendInvitationEmail(teamMember, company);
        } catch (error) {
          this.logger.error('Failed to send invitation email:', error);
          // Don't throw error, invitation is created but email failed
        }

        return teamMember;
      });
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

      const results = [];
      const errors = [];

      for (const memberDto of bulkInviteDto.members) {
        try {
          const result = await this.inviteTeamMember(
            userId,
            companyId,
            memberDto,
          );
          results.push(result);
        } catch (error) {
          errors.push({
            email: memberDto.email,
            error: error.message,
          });
        }
      }

      return {
        successful: results,
        failed: errors,
        totalProcessed: bulkInviteDto.members.length,
        successCount: results.length,
        failureCount: errors.length,
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
   * Update team member role
   */
  async updateTeamMemberRole(
    teamMemberId: number,
    userId: number,
    newRole: TeamMemberRoleEnum,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const teamMember = await this.teamMemberRepository.findById(
          teamMemberId,
          tx,
        );
        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.NotFound);
        }

        // Only owners can change roles, and admins can change viewer roles
        const userRole = await this.teamMemberRepository.getUserRoleInCompany(
          teamMember.companyId,
          userId,
          tx,
        );

        if (!userRole) {
          throw new ForbiddenException(ErrorTeamMember.AccessDenied);
        }

        // Role change permissions
        if (userRole === TeamMemberRoleEnum.OWNER) {
          // Owners can change any role
        } else if (userRole === TeamMemberRoleEnum.ADMIN) {
          // Admins can only change viewer roles and cannot promote to owner
          if (
            teamMember.role !== TeamMemberRoleEnum.VIEWER ||
            newRole === TeamMemberRoleEnum.OWNER
          ) {
            throw new ForbiddenException(
              ErrorTeamMember.InsufficientPermissions,
            );
          }
        } else {
          throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
        }

        // Prevent removing the last owner
        if (
          teamMember.role === TeamMemberRoleEnum.OWNER &&
          newRole !== TeamMemberRoleEnum.OWNER
        ) {
          const ownerCount = await this.teamMemberRepository.countByCompany(
            teamMember.companyId,
            { role: TeamMemberRoleEnum.OWNER, isActive: true },
            tx,
          );

          if (ownerCount <= 1) {
            throw new BadRequestException(
              ErrorTeamMember.CannotRemoveLastOwner,
            );
          }
        }

        return this.teamMemberRepository.updateRole(teamMemberId, newRole, tx);
      });
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

        // Check permissions
        const canManage = await this.teamMemberRepository.hasPermission(
          teamMember.companyId,
          userId,
          [TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN],
          tx,
        );

        if (!canManage) {
          throw new ForbiddenException(ErrorTeamMember.InsufficientPermissions);
        }

        // Prevent removing the last owner
        if (teamMember.role === TeamMemberRoleEnum.OWNER) {
          const ownerCount = await this.teamMemberRepository.countByCompany(
            teamMember.companyId,
            { role: TeamMemberRoleEnum.OWNER, isActive: true },
            tx,
          );

          if (ownerCount <= 1) {
            throw new BadRequestException(
              ErrorTeamMember.CannotRemoveLastOwner,
            );
          }
        }

        return this.teamMemberRepository.deactivate(teamMemberId, tx);
      });
    } catch (error) {
      this.logger.error(`Failed to remove team member ${teamMemberId}:`, error);
      handleError(error, this.logger);
    }
  }

  /**
   * Accept invitation (when user creates account)
   */
  async acceptInvitation(
    teamMemberId: number,
    userId: number,
    acceptDto?: AcceptInvitationDto,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const teamMember = await this.teamMemberRepository.findById(
          teamMemberId,
          tx,
        );
        if (!teamMember) {
          throw new NotFoundException(ErrorTeamMember.NotFound);
        }

        if (teamMember.userId) {
          throw new BadRequestException(ErrorTeamMember.UserAlreadyJoined);
        }

        if (!teamMember.isActive) {
          throw new BadRequestException(ErrorTeamMember.InvitationNotActive);
        }

        // Prepare update data
        const updateData: any = {
          user: {
            connect: {
              id: userId,
            },
          },
          joinedAt: new Date(),
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

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(teamMember: any, company: any) {
    const subject = `Invitation to join ${company.companyName}`;
    const html = this.getInvitationEmailTemplate(teamMember, company);

    await this.mailService.sendEmail({
      to: teamMember.email,
      subject,
      html,
    });
  }

  /**
   * Get invitation email template
   */
  private getInvitationEmailTemplate(teamMember: any, company: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .invitation-box { 
            background: #f8f9fa; 
            border: 2px solid #007bff; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0; 
          }
          .company-info {
            background: #e9ecef;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
          }
          .role-badge {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
          }
          .cta-button {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            font-size: 14px; 
            color: #666; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited to Join a Team!</h1>
          </div>
          
          <p>Hello ${teamMember.firstName} ${teamMember.lastName},</p>
          
          <p>You have been invited to join <strong>${company.companyName}</strong> as a team member.</p>
          
          <div class="invitation-box">
            <h3>Invitation Details</h3>
            <div class="company-info">
              <strong>Company:</strong> ${company.companyName}<br>
              <strong>Registration:</strong> ${company.registrationNumber}<br>
              <strong>Your Role:</strong> <span class="role-badge">${teamMember.role}</span><br>
              ${teamMember.position ? `<strong>Position:</strong> ${teamMember.position}<br>` : ''}
            </div>
          </div>
          
          <p>To accept this invitation and join the team:</p>
          <ol>
            <li>Create an account or sign in with this email address</li>
            <li>Navigate to your pending invitations</li>
            <li>Accept the invitation from ${company.companyName}</li>
          </ol>
          
          <div style="text-align: center;">
            <a href="#" class="cta-button">Accept Invitation</a>
          </div>
          
          <p><strong>What you'll be able to do:</strong></p>
          <ul>
            ${teamMember.role === 'OWNER' ? '<li>Full company management access</li><li>Manage team members and permissions</li><li>Update company information</li>' : ''}
            ${teamMember.role === 'ADMIN' ? '<li>Manage team members</li><li>Update company information</li><li>View all company data</li>' : ''}
            ${teamMember.role === 'VIEWER' ? '<li>View company information</li><li>Access team directory</li>' : ''}
          </ul>
          
          <p>If you have any questions, please contact the person who invited you.</p>
          
          <div class="footer">
            <p>This invitation was sent to ${teamMember.email}</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
