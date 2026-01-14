import { Injectable, Logger } from '@nestjs/common';
import { ActivityLogRepository, CreateActivityLogData } from './activity-log.repository';
import {
  ActivityLogQueryDto,
  ActivityLogPaginatedResponseDto,
  ActivityLogFiltersResponseDto,
  ActivityActionEnum,
  ActivityEntityTypeEnum,
} from './activity-log.dto';
import { PrismaTransactionClient } from 'src/database/base.repository';
import { handleError } from 'src/common/utils/errors';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly activityLogRepository: ActivityLogRepository) {}

  /**
   * Log an activity
   */
  async logActivity(
    data: CreateActivityLogData,
    tx?: PrismaTransactionClient,
  ) {
    try {
      return await this.activityLogRepository.createLog(data, tx);
    } catch (error) {
      // Don't throw errors for activity logging - it shouldn't break the main operation
      this.logger.error('Failed to log activity:', error);
    }
  }

  /**
   * Get activity logs for a company with pagination
   */
  async getCompanyActivityLogs(
    companyId: number,
    query: ActivityLogQueryDto,
  ): Promise<ActivityLogPaginatedResponseDto> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const filters = {
        teamMemberId: query.teamMemberId,
        action: query.action,
        entityType: query.entityType,
        entityId: query.entityId,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      };

      const [data, total] = await Promise.all([
        this.activityLogRepository.findByCompany(companyId, filters, {
          skip,
          take: limit,
        }),
        this.activityLogRepository.countByCompany(companyId, filters),
      ]);

      return {
        data: data as any,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Failed to get company activity logs:', error);
      handleError(error, this.logger);
      throw error;
    }
  }

  /**
   * Get recent activity for a company
   */
  async getRecentActivity(companyId: number, limit = 10) {
    try {
      return await this.activityLogRepository.getRecentActivity(
        companyId,
        limit,
      );
    } catch (error) {
      this.logger.error('Failed to get recent activity:', error);
      handleError(error, this.logger);
      throw error;
    }
  }

  /**
   * Get activity for a specific entity
   */
  async getEntityActivity(
    companyId: number,
    entityType: ActivityEntityTypeEnum,
    entityId: number,
  ) {
    try {
      return await this.activityLogRepository.getEntityActivity(
        companyId,
        entityType,
        entityId,
      );
    } catch (error) {
      this.logger.error('Failed to get entity activity:', error);
      handleError(error, this.logger);
      throw error;
    }
  }

  /**
   * Get activity for a team member
   */
  async getTeamMemberActivity(
    companyId: number,
    teamMemberId: number,
    query: ActivityLogQueryDto,
  ): Promise<ActivityLogPaginatedResponseDto> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.activityLogRepository.getTeamMemberActivity(
          companyId,
          teamMemberId,
          { skip, take: limit },
        ),
        this.activityLogRepository.countByCompany(companyId, { teamMemberId }),
      ]);

      return {
        data: data as any,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Failed to get team member activity:', error);
      handleError(error, this.logger);
      throw error;
    }
  }

  /**
   * Get available filters for a company
   */
  async getFilters(companyId: number): Promise<ActivityLogFiltersResponseDto> {
    try {
      const [actions, entityTypes] = await Promise.all([
        this.activityLogRepository.getDistinctActions(companyId),
        this.activityLogRepository.getDistinctEntityTypes(companyId),
      ]);

      return { actions, entityTypes };
    } catch (error) {
      this.logger.error('Failed to get activity log filters:', error);
      handleError(error, this.logger);
      throw error;
    }
  }

  // Helper methods for common activity logging patterns

  /**
   * Log a CREATE action
   */
  async logCreate(
    companyId: number,
    teamMemberId: number,
    entityType: ActivityEntityTypeEnum,
    entityId: number,
    entityUuid?: string,
    newValues?: any,
    metadata?: any,
    tx?: PrismaTransactionClient,
  ) {
    return this.logActivity(
      {
        companyId,
        teamMemberId,
        action: ActivityActionEnum.CREATE,
        entityType,
        entityId,
        entityUuid,
        newValues,
        metadata,
      },
      tx,
    );
  }

  /**
   * Log an UPDATE action
   */
  async logUpdate(
    companyId: number,
    teamMemberId: number,
    entityType: ActivityEntityTypeEnum,
    entityId: number,
    entityUuid?: string,
    previousValues?: any,
    newValues?: any,
    metadata?: any,
    tx?: PrismaTransactionClient,
  ) {
    return this.logActivity(
      {
        companyId,
        teamMemberId,
        action: ActivityActionEnum.UPDATE,
        entityType,
        entityId,
        entityUuid,
        previousValues,
        newValues,
        metadata,
      },
      tx,
    );
  }

  /**
   * Log a DELETE action
   */
  async logDelete(
    companyId: number,
    teamMemberId: number,
    entityType: ActivityEntityTypeEnum,
    entityId: number,
    entityUuid?: string,
    previousValues?: any,
    metadata?: any,
    tx?: PrismaTransactionClient,
  ) {
    return this.logActivity(
      {
        companyId,
        teamMemberId,
        action: ActivityActionEnum.DELETE,
        entityType,
        entityId,
        entityUuid,
        previousValues,
        metadata,
      },
      tx,
    );
  }

  /**
   * Log a team member invitation
   */
  async logInvitation(
    companyId: number,
    inviterTeamMemberId: number,
    invitedTeamMemberId: number,
    invitedEmail: string,
    role: string,
    tx?: PrismaTransactionClient,
  ) {
    return this.logActivity(
      {
        companyId,
        teamMemberId: inviterTeamMemberId,
        action: ActivityActionEnum.INVITE,
        entityType: ActivityEntityTypeEnum.TEAM_MEMBER,
        entityId: invitedTeamMemberId,
        metadata: { invitedEmail, role },
      },
      tx,
    );
  }

  /**
   * Log an invitation acceptance
   */
  async logInvitationAccepted(
    companyId: number,
    teamMemberId: number,
    tx?: PrismaTransactionClient,
  ) {
    return this.logActivity(
      {
        companyId,
        teamMemberId,
        action: ActivityActionEnum.ACCEPT_INVITATION,
        entityType: ActivityEntityTypeEnum.TEAM_MEMBER,
        entityId: teamMemberId,
      },
      tx,
    );
  }

  /**
   * Log a status change (approve, reject, etc.)
   */
  async logStatusChange(
    companyId: number,
    teamMemberId: number,
    entityType: ActivityEntityTypeEnum,
    entityId: number,
    action: ActivityActionEnum,
    entityUuid?: string,
    metadata?: any,
    tx?: PrismaTransactionClient,
  ) {
    return this.logActivity(
      {
        companyId,
        teamMemberId,
        action,
        entityType,
        entityId,
        entityUuid,
        metadata,
      },
      tx,
    );
  }
}
