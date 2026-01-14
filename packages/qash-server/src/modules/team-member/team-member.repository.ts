import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TeamMemberModel } from '../../database/generated/models/TeamMember';
import {
  Prisma,
  PrismaClient,
  TeamMemberRoleEnum,
} from '../../database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from 'src/database/base.repository';
import { UserModel } from 'src/database/generated/models/User';

export interface CreateTeamMemberData {
  firstName: string;
  lastName: string;
  email: string;
  position?: string;
  profilePicture?: string;
  role: TeamMemberRoleEnum;
  companyId: number;
  userId: number; // Required since TeamMember has 1:1 relationship with User
  invitedBy?: number;
  metadata?: any;
}

export interface UpdateTeamMemberData {
  firstName?: string;
  lastName?: string;
  email?: string;
  position?: string;
  profilePicture?: string;
  role?: TeamMemberRoleEnum;
  isActive?: boolean;
  joinedAt?: Date;
  metadata?: any;
}

export interface TeamMemberWithRelations extends TeamMemberModel {
  company?: any;
  user?: any;
  inviter?: any;
}

export interface TeamMemberFilters {
  companyId?: number;
  role?: TeamMemberRoleEnum;
  isActive?: boolean;
  hasUser?: boolean; // Filter by whether they have a user account
  search?: string; // Search in name or email
}

@Injectable()
export class TeamMemberRepository extends BaseRepository<
  TeamMemberModel,
  Prisma.TeamMemberWhereInput,
  Prisma.TeamMemberCreateInput,
  Prisma.TeamMemberUpdateInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(tx?: PrismaTransactionClient): PrismaClient['teamMember'] {
    return tx ? tx.teamMember : this.prisma.teamMember;
  }

  protected getModelName(): string {
    return 'TeamMember';
  }

  /**
   * Find team member by ID
   */
  async findById(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberModel | null> {
    return this.findOne({ id }, tx);
  }

  /**
   * Find only team member by company ID
   */
  async findOnlyTeamMember(
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<(TeamMemberModel & { user: UserModel }) | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: { companyId },
      include: { user: true },
    });
  }

  /**
   * Find team member by ID with relations
   */
  async findByIdWithRelations(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberWithRelations | null> {
    const model = this.getModel(tx);
    return model.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            registrationNumber: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Find team member by company and email
   */
  async findByCompanyAndEmail(
    companyId: number,
    email: string,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberModel | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: {
        companyId,
        user: {
          email,
        },
      },
      include: {
        user: true,
        company: true,
      },
    }) as Promise<TeamMemberModel | null>;
  }

  /**
   * Find team members by company
   */
  async findByCompany(
    companyId: number,
    filters?: TeamMemberFilters,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberModel[]> {
    const whereClause: any = {
      companyId,
    };

    if (filters) {
      if (filters.role) {
        whereClause.role = filters.role;
      }
      if (typeof filters.isActive === 'boolean') {
        whereClause.isActive = filters.isActive;
      }
      if (typeof filters.hasUser === 'boolean') {
        whereClause.userId = filters.hasUser ? { not: null } : null;
      }
      if (filters.search) {
        whereClause.OR = [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { position: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
    }

    return this.findMany(
      whereClause,
      {
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      },
      tx,
    );
  }

  /**
   * Find team member by user ID (returns single company since 1:1 relationship)
   */
  async findByUserId(
    userId: number,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberWithRelations | null> {
    const model = this.getModel(tx);
    return model.findUnique({
      where: {
        userId,
      },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            registrationNumber: true,
            verificationStatus: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Find team member by user email
   * Used with Para authentication where users are identified by email
   */
  async findByUserEmail(
    userEmail: string,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberWithRelations | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: {
        user: {
          email: userEmail,
        },
      },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            registrationNumber: true,
            verificationStatus: true,
            isActive: true,
          },
        },
        user: true,
      },
    });
  }

  /**
   * Update team member by ID
   */
  async updateById(
    id: number,
    data: UpdateTeamMemberData,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberModel> {
    return this.update({ id }, data as Prisma.TeamMemberUpdateInput, tx);
  }

  /**
   * Check if user has permission in company
   */
  async hasPermission(
    companyId: number,
    userId: number,
    requiredRoles: TeamMemberRoleEnum[],
    tx?: PrismaTransactionClient,
  ): Promise<boolean> {
    const model = this.getModel(tx);
    const teamMember = await model.findFirst({
      where: {
        companyId,
        userId,
        isActive: true,
        role: { in: requiredRoles },
      },
    });
    return !!teamMember;
  }

  /**
   * Get user's role in company
   */
  async getUserRoleInCompany(
    companyId: number,
    userId: number,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberRoleEnum | null> {
    const model = this.getModel(tx);
    const teamMember = await model.findFirst({
      where: {
        companyId,
        userId,
        isActive: true,
      },
      select: { role: true },
    });
    return teamMember?.role || null;
  }

  /**
   * Count team members by company
   */
  async countByCompany(
    companyId: number,
    filters?: TeamMemberFilters,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    const whereClause: any = { companyId };

    if (filters) {
      if (filters.role) {
        whereClause.role = filters.role;
      }
      if (typeof filters.isActive === 'boolean') {
        whereClause.isActive = filters.isActive;
      }
    }

    return this.count(whereClause, tx);
  }

  /**
   * Get team member statistics for company
   */
  async getCompanyStats(companyId: number, tx?: PrismaTransactionClient) {
    const model = this.getModel(tx);
    const [total, owners, admins, viewers, active, pending] = await Promise.all(
      [
        model.count({ where: { companyId } }),
        model.count({
          where: { companyId, role: 'OWNER' },
        }),
        model.count({
          where: { companyId, role: 'ADMIN' },
        }),
        model.count({
          where: { companyId, role: 'VIEWER' },
        }),
        model.count({
          where: { companyId, isActive: true },
        }),
        model.count({
          where: { companyId, userId: null, isActive: true },
        }),
      ],
    );

    return {
      total,
      owners,
      admins,
      viewers,
      active,
      pending, // Members without user accounts (invited but not joined)
    };
  }

  /**
   * Link team member to user account
   */
  async linkToUser(
    id: number,
    userId: number,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberModel> {
    return this.update(
      { id },
      {
        user: {
          connect: {
            id: userId,
          },
        },
        joinedAt: new Date(),
      },
      tx,
    );
  }

  /**
   * Deactivate team member
   */
  async deactivate(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberModel> {
    return this.update({ id }, { isActive: false }, tx);
  }

  /**
   * Activate team member
   */
  async activate(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberModel> {
    return this.update({ id }, { isActive: true }, tx);
  }

  /**
   * Find pending invitations by email
   */
  async findPendingInvitationsByEmail(
    email: string,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberWithRelations[]> {
    const model = this.getModel(tx);
    return model.findMany({
      where: {
        user: {
          email,
        },
        isActive: true,
      },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            registrationNumber: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });
  }

  /**
   * Update team member role
   */
  async updateRole(
    id: number,
    role: TeamMemberRoleEnum,
    tx?: PrismaTransactionClient,
  ): Promise<TeamMemberModel> {
    return this.update({ id }, { role }, tx);
  }

  /**
   * Check if email is already invited to company
   */
  async isEmailInvited(
    companyId: number,
    email: string,
    tx?: PrismaTransactionClient,
  ): Promise<boolean> {
    const model = this.getModel(tx);
    const existing = await model.findFirst({
      where: {
        companyId,
        user: {
          email,
        },
      },
      include: {
        user: true,
        company: true,
      },
    });
    return !!existing;
  }
}
