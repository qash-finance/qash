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
   * Find notifications for a wallet with pagination
   */
  async findByWalletWithPagination(
    walletAddress: string,
    options: {
      skip: number;
      take: number;
      type?: NotificationsTypeEnum;
      status?: NotificationsStatusEnum;
    },
  ): Promise<Notifications[]> {
    const where: Prisma.NotificationsWhereInput = { walletAddress };

    if (options.type) where.type = options.type;
    if (options.status) where.status = options.status;

    return this.findMany(where, {
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Count notifications for a wallet with filters
   */
  async countByWallet(
    walletAddress: string,
    filters?: {
      type?: NotificationsTypeEnum;
      status?: NotificationsStatusEnum;
    },
  ): Promise<number> {
    const where: Prisma.NotificationsWhereInput = { walletAddress };

    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;

    return this.count(where);
  }

  /**
   * Find notification by ID and wallet address
   */
  async findByIdAndWallet(
    id: number,
    walletAddress: string,
  ): Promise<Notifications | null> {
    return this.findOne({ id, walletAddress });
  }

  /**
   * Update notification status
   */
  async updateStatus(
    id: number,
    walletAddress: string,
    status: NotificationsStatusEnum,
    additionalData?: Partial<Notifications>,
  ): Promise<Notifications> {
    return this.update(
      { id, walletAddress },
      {
        status,
        ...additionalData,
      },
    );
  }

  /**
   * Mark all notifications as read for a wallet
   */
  async markAllAsReadForWallet(
    walletAddress: string,
  ): Promise<{ count: number }> {
    return this.updateMany(
      {
        walletAddress,
        status: NotificationsStatusEnum.UNREAD,
      },
      {
        status: NotificationsStatusEnum.READ,
        readAt: new Date(),
      },
    );
  }

  /**
   * Count unread notifications for a wallet
   */
  async countUnreadByWallet(walletAddress: string): Promise<number> {
    return this.count({
      walletAddress,
      status: NotificationsStatusEnum.UNREAD,
    });
  }

  /**
   * Find recent notifications for a wallet (last 30 days)
   */
  async findRecentByWallet(
    walletAddress: string,
    limit: number = 10,
  ): Promise<Notifications[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.findMany(
      {
        walletAddress,
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
   * Find notifications by type for a wallet
   */
  async findByWalletAndType(
    walletAddress: string,
    type: NotificationsTypeEnum,
    limit?: number,
  ): Promise<Notifications[]> {
    return this.findMany(
      { walletAddress, type },
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
   * Get notification statistics for a wallet
   */
  async getWalletStats(
    walletAddress: string,
    tx?: PrismaTransactionClient,
  ): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    const model = this.getModel(tx);
    const [total, unread, byTypeResults] = await Promise.all([
      this.count({ walletAddress }, tx),
      this.count({ walletAddress, status: NotificationsStatusEnum.UNREAD }, tx),
      model.groupBy({
        by: ['type'],
        where: { walletAddress },
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
