import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogModel } from '../../database/generated/models/ActivityLog';
import {
  Prisma,
  PrismaClient,
  ActivityActionEnum,
  ActivityEntityTypeEnum,
} from '../../database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from 'src/database/base.repository';

export interface ActivityLogFilters {
  companyId?: number;
  teamMemberId?: number;
  action?: ActivityActionEnum;
  entityType?: ActivityEntityTypeEnum;
  entityId?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface CreateActivityLogData {
  companyId: number;
  teamMemberId: number;
  action: ActivityActionEnum;
  entityType: ActivityEntityTypeEnum;
  entityId: number;
  entityUuid?: string;
  description?: string;
  previousValues?: any;
  newValues?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityLogRepository extends BaseRepository<
  ActivityLogModel,
  Prisma.ActivityLogWhereInput,
  Prisma.ActivityLogCreateInput,
  Prisma.ActivityLogUpdateInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(tx?: PrismaTransactionClient): PrismaClient['activityLog'] {
    return tx ? tx.activityLog : (this.prisma as any).activityLog;
  }

  protected getModelName(): string {
    return 'ActivityLog';
  }

  /**
   * Find activity log by ID
   */
  async findById(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<ActivityLogModel | null> {
    return this.findOne({ id }, tx);
  }

  /**
   * Find activity logs by company with filters and pagination
   */
  async findByCompany(
    companyId: number,
    filters?: ActivityLogFilters,
    pagination?: { skip?: number; take?: number },
    tx?: PrismaTransactionClient,
  ): Promise<ActivityLogModel[]> {
    const model = this.getModel(tx);
    const whereClause: Prisma.ActivityLogWhereInput = { companyId };

    if (filters) {
      if (filters.teamMemberId) {
        whereClause.teamMemberId = filters.teamMemberId;
      }
      if (filters.action) {
        whereClause.action = filters.action;
      }
      if (filters.entityType) {
        whereClause.entityType = filters.entityType;
      }
      if (filters.entityId) {
        whereClause.entityId = filters.entityId;
      }
      if (filters.startDate || filters.endDate) {
        whereClause.createdAt = {};
        if (filters.startDate) {
          whereClause.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          whereClause.createdAt.lte = filters.endDate;
        }
      }
    }

    return model.findMany({
      where: whereClause,
      include: {
        teamMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination?.skip,
      take: pagination?.take,
    });
  }

  /**
   * Count activity logs by company
   */
  async countByCompany(
    companyId: number,
    filters?: ActivityLogFilters,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    const whereClause: Prisma.ActivityLogWhereInput = { companyId };

    if (filters) {
      if (filters.teamMemberId) {
        whereClause.teamMemberId = filters.teamMemberId;
      }
      if (filters.action) {
        whereClause.action = filters.action;
      }
      if (filters.entityType) {
        whereClause.entityType = filters.entityType;
      }
      if (filters.entityId) {
        whereClause.entityId = filters.entityId;
      }
      if (filters.startDate || filters.endDate) {
        whereClause.createdAt = {};
        if (filters.startDate) {
          whereClause.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          whereClause.createdAt.lte = filters.endDate;
        }
      }
    }

    return this.count(whereClause, tx);
  }

  /**
   * Create activity log entry
   */
  async createLog(
    data: CreateActivityLogData,
    tx?: PrismaTransactionClient,
  ): Promise<ActivityLogModel> {
    return this.create(
      {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        entityUuid: data.entityUuid,
        description: data.description,
        previousValues: data.previousValues,
        newValues: data.newValues,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        company: {
          connect: { id: data.companyId },
        },
        teamMember: {
          connect: { id: data.teamMemberId },
        },
      },
      tx,
    );
  }

  /**
   * Get recent activity for a company
   */
  async getRecentActivity(
    companyId: number,
    limit = 10,
    tx?: PrismaTransactionClient,
  ): Promise<ActivityLogModel[]> {
    const model = this.getModel(tx);
    return model.findMany({
      where: { companyId },
      include: {
        teamMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get activity for a specific entity
   */
  async getEntityActivity(
    companyId: number,
    entityType: ActivityEntityTypeEnum,
    entityId: number,
    tx?: PrismaTransactionClient,
  ): Promise<ActivityLogModel[]> {
    const model = this.getModel(tx);
    return model.findMany({
      where: { companyId, entityType, entityId },
      include: {
        teamMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get activity by team member
   */
  async getTeamMemberActivity(
    companyId: number,
    teamMemberId: number,
    pagination?: { skip?: number; take?: number },
    tx?: PrismaTransactionClient,
  ): Promise<ActivityLogModel[]> {
    const model = this.getModel(tx);
    return model.findMany({
      where: { companyId, teamMemberId },
      include: {
        teamMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination?.skip,
      take: pagination?.take,
    });
  }

  /**
   * Get distinct actions for filtering
   */
  async getDistinctActions(
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<ActivityActionEnum[]> {
    const model = this.getModel(tx);
    const results = await model.findMany({
      where: { companyId },
      select: { action: true },
      distinct: ['action'],
    });
    return results.map((r) => r.action);
  }

  /**
   * Get distinct entity types for filtering
   */
  async getDistinctEntityTypes(
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<ActivityEntityTypeEnum[]> {
    const model = this.getModel(tx);
    const results = await model.findMany({
      where: { companyId },
      select: { entityType: true },
      distinct: ['entityType'],
    });
    return results.map((r) => r.entityType);
  }
}
