import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  Notifications,
  Prisma,
  PrismaClient,
  NotificationsStatusEnum,
  NotificationsTypeEnum,
} from 'src/database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from '../../database/base.repository';

@Injectable()
export class NotificationRepository extends BaseRepository<
  Notifications,
  Prisma.NotificationsWhereInput,
  Prisma.NotificationsCreateInput,
  Prisma.NotificationsUpdateInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(
    tx?: PrismaTransactionClient,
  ): PrismaClient['notifications'] {
    return tx ? tx.notifications : this.prisma.notifications;
  }

  protected getModelName(): string {
    return 'Notifications';
  }

  /**
   * Find notifications for a user with pagination
   */
  async findByUserWithPagination(
    userId: number,
    options: {
      skip: number;
      take: number;
      type?: NotificationsTypeEnum;
      status?: NotificationsStatusEnum;
    },
  ): Promise<Notifications[]> {
    const where: Prisma.NotificationsWhereInput = { userId };

    if (options.type) where.type = options.type;
    if (options.status) where.status = options.status;

    return this.findMany(where, {
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Count notifications for a user with filters
   */
  async countByUser(
    userId: number,
    filters?: {
      type?: NotificationsTypeEnum;
      status?: NotificationsStatusEnum;
    },
  ): Promise<number> {
    const where: Prisma.NotificationsWhereInput = { userId };

    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;

    return this.count(where);
  }

  /**
   * Find notification by ID and user ID (for ownership check)
   */
  async findByIdAndUser(
    id: number,
    userId: number,
  ): Promise<Notifications | null> {
    return this.findOne({ id, userId });
  }

  /**
   * Update notification status
   */
  async updateStatus(
    id: number,
    userId: number,
    status: NotificationsStatusEnum,
    additionalData?: Partial<Notifications>,
  ): Promise<Notifications> {
    return this.update(
      { id, userId },
      {
        status,
        ...additionalData,
      },
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsReadForUser(
    userId: number,
  ): Promise<{ count: number }> {
    return this.updateMany(
      {
        userId,
        status: NotificationsStatusEnum.UNREAD,
      },
      {
        status: NotificationsStatusEnum.READ,
        readAt: new Date(),
      },
    );
  }

  /**
   * Count unread notifications for a user
   */
  async countUnreadByUser(userId: number): Promise<number> {
    return this.count({
      userId,
      status: NotificationsStatusEnum.UNREAD,
    });
  }

  /**
   * Find recent notifications for a user (last 30 days)
   */
  async findRecentByUser(
    userId: number,
    limit: number = 10,
  ): Promise<Notifications[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.findMany(
      {
        userId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      {
        take: limit,
        orderBy: { createdAt: 'desc' },
      },
    );
  }

  /**
   * Find notifications by type for a user
   */
  async findByUserAndType(
    userId: number,
    type: NotificationsTypeEnum,
    limit?: number,
  ): Promise<Notifications[]> {
    return this.findMany(
      { userId, type },
      {
        take: limit,
        orderBy: { createdAt: 'desc' },
      },
    );
  }

  /**
   * Delete old notifications (older than specified days)
   */
  async deleteOldNotifications(daysOld: number): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.deleteMany({
      createdAt: {
        lt: cutoffDate,
      },
    });
  }

  /**
   * Get notification statistics for a user
   */
  async getUserStats(
    userId: number,
    tx?: PrismaTransactionClient,
  ): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    const model = this.getModel(tx);
    const [total, unread, byTypeResults] = await Promise.all([
      this.count({ userId }, tx),
      this.count({ userId, status: NotificationsStatusEnum.UNREAD }, tx),
      model.groupBy({
        by: ['type'],
        where: { userId },
        _count: { type: true },
      }),
    ]);

    const byType = byTypeResults.reduce(
      (acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      },
      {} as Record<string, number>,
    );

    return { total, unread, byType };
  }
}
