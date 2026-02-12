import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
  ForbiddenException,
} from '@nestjs/common';

import {
  CreateNotificationDto,
  NotificationQueryDto,
  NotificationResponseDto,
  NotificationWithPaginationDto,
  UnreadCountResponseDto,
  MarkAllReadResponseDto,
} from './notification.dto';
import { NotificationGateway } from './notification.gateway';
import { NotificationRepository } from './notification.repository';
import {
  Notifications,
  NotificationsStatusEnum,
} from 'src/database/generated/client';
import { handleError } from 'src/common/utils/errors';
import { ErrorNotification } from 'src/common/constants/errors';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    @Inject(forwardRef(() => NotificationGateway))
    private readonly notificationGateway?: NotificationGateway,
  ) {}

  /**
   * Create a notification for a user
   */
  async createNotification(
    dto: CreateNotificationDto,
  ): Promise<Notifications> {
    try {
      this.logger.log(
        `Creating notification for user ${dto.userId} of type ${dto.type}`,
      );

      const now = new Date();
      const notification = await this.notificationRepository.create({
        title: dto.title,
        message: dto.message,
        type: dto.type,
        status: NotificationsStatusEnum.UNREAD,
        metadata: dto.metadata,
        actionUrl: dto.actionUrl,
        createdAt: now,
        updatedAt: now,
        user: {
          connect: { id: dto.userId },
        },
      });

      // Emit real-time notification if gateway is available and user is connected
      if (
        this.notificationGateway &&
        this.notificationGateway.isUserConnected(dto.userId)
      ) {
        const notificationDto = this.mapToResponseDto(notification);
        this.notificationGateway.emitNotificationToUser(
          dto.userId,
          notificationDto,
        );

        // Also emit updated unread count
        const unreadCount = await this.getUnreadCount(dto.userId);
        this.notificationGateway.emitUnreadCountToUser(
          dto.userId,
          unreadCount,
        );
      }

      return notification;
    } catch (error) {
      handleError(error, this.logger);
    }
  }

  /**
   * Get notifications for a user with pagination
   */
  async getUserNotifications(
    userId: number,
    query: NotificationQueryDto,
  ): Promise<NotificationWithPaginationDto> {
    try {
      const { page = 1, limit = 10, type, status } = query;
      const skip = (page - 1) * limit;

      const [notifications, total] = await Promise.all([
        this.notificationRepository.findByUserWithPagination(userId, {
          skip,
          take: limit,
          type,
          status,
        }),
        this.notificationRepository.countByUser(userId, {
          type,
          status,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        notifications: notifications.map(this.mapToResponseDto),
        meta: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      handleError(error, this.logger);
    }
  }

  /**
   * Get a notification by ID (with ownership check)
   */
  async getNotificationById(
    id: number,
    userId: number,
  ): Promise<Notifications> {
    try {
      const notification = await this.notificationRepository.findByIdAndUser(
        id,
        userId,
      );

      if (!notification) {
        throw new NotFoundException(ErrorNotification.NotFound);
      }

      return notification;
    } catch (error) {
      handleError(error, this.logger);
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(
    id: number,
    userId: number,
  ): Promise<Notifications> {
    try {
      // First check if notification exists and belongs to user
      const existing = await this.notificationRepository.findByIdAndUser(
        id,
        userId,
      );

      if (!existing) {
        throw new ForbiddenException(ErrorNotification.AccessDenied);
      }

      const updatedNotification = await this.notificationRepository.updateStatus(
        id,
        userId,
        NotificationsStatusEnum.READ,
        { readAt: new Date() },
      );

      // Emit real-time update if gateway is available and user is connected
      if (
        this.notificationGateway &&
        this.notificationGateway.isUserConnected(userId)
      ) {
        this.notificationGateway.emitNotificationReadToUser(userId, id);

        // Also emit updated unread count
        const unreadCount = await this.getUnreadCount(userId);
        this.notificationGateway.emitUnreadCountToUser(userId, unreadCount);
      }

      return updatedNotification;
    } catch (error) {
      handleError(error, this.logger);
    }
  }

  /**
   * Mark a notification as unread
   */
  async markAsUnread(
    id: number,
    userId: number,
  ): Promise<Notifications> {
    try {
      // First check if notification exists and belongs to user
      const existing = await this.notificationRepository.findByIdAndUser(
        id,
        userId,
      );

      if (!existing) {
        throw new ForbiddenException(ErrorNotification.AccessDenied);
      }

      const updatedNotification = await this.notificationRepository.updateStatus(
        id,
        userId,
        NotificationsStatusEnum.UNREAD,
        { readAt: null },
      );

      // Emit real-time update if gateway is available
      if (
        this.notificationGateway &&
        this.notificationGateway.isUserConnected(userId)
      ) {
        const unreadCount = await this.getUnreadCount(userId);
        this.notificationGateway.emitUnreadCountToUser(userId, unreadCount);
      }

      return updatedNotification;
    } catch (error) {
      handleError(error, this.logger);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<MarkAllReadResponseDto> {
    try {
      const result = await this.notificationRepository.markAllAsReadForUser(
        userId,
      );

      this.logger.log(
        `Marked ${result.count} notifications as read for user ${userId}`,
      );

      // Emit real-time update if gateway is available and user is connected
      if (
        this.notificationGateway &&
        this.notificationGateway.isUserConnected(userId)
      ) {
        this.notificationGateway.emitAllNotificationsReadToUser(userId);
        this.notificationGateway.emitUnreadCountToUser(userId, 0);
      }

      return { updatedCount: result.count };
    } catch (error) {
      handleError(error, this.logger);
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: number): Promise<number> {
    try {
      return await this.notificationRepository.countUnreadByUser(userId);
    } catch (error) {
      handleError(error, this.logger);
    }
  }

  /**
   * Delete a notification (with ownership check)
   */
  async deleteNotification(id: number, userId: number): Promise<void> {
    try {
      // First check if notification exists and belongs to user
      const existing = await this.notificationRepository.findByIdAndUser(
        id,
        userId,
      );

      if (!existing) {
        throw new ForbiddenException(ErrorNotification.AccessDenied);
      }

      await this.notificationRepository.delete({ id, userId });

      this.logger.log(`Deleted notification ${id} for user ${userId}`);

      // Emit real-time update if gateway is available
      if (
        this.notificationGateway &&
        this.notificationGateway.isUserConnected(userId)
      ) {
        this.notificationGateway.emitNotificationDeletedToUser(userId, id);
        const unreadCount = await this.getUnreadCount(userId);
        this.notificationGateway.emitUnreadCountToUser(userId, unreadCount);
      }
    } catch (error) {
      handleError(error, this.logger);
    }
  }

  /**
   * Map Prisma model to response DTO
   */
  private mapToResponseDto(
    notification: Notifications,
  ): NotificationResponseDto {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      status: notification.status,
      metadata: notification.metadata as Record<string, any>,
      actionUrl: notification.actionUrl,
      userId: notification.userId,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      readAt: notification.readAt,
    };
  }
}
