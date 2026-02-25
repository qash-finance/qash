import type { NotificationsStatusEnum, NotificationsTypeEnum } from '../enums/index.js';

export interface CreateNotificationDto {
  title: string;
  message: string;
  type: NotificationsTypeEnum;
  metadata?: Record<string, any> | null;
  actionUrl?: string | null;
  userId: number;
}

export interface UpdateNotificationStatusDto {
  status: NotificationsStatusEnum;
}

export interface NotificationQueryDto {
  page?: number;
  limit?: number;
  type?: NotificationsTypeEnum;
  status?: NotificationsStatusEnum;
}

export interface NotificationResponseDto {
  id: number;
  title: string;
  message: string | null;
  type: NotificationsTypeEnum;
  status: NotificationsStatusEnum;
  metadata: Record<string, any> | null;
  actionUrl: string | null;
  userId: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  readAt: string | Date | null;
}

export interface NotificationWithPaginationDto {
  notifications: NotificationResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UnreadCountResponseDto {
  count: number;
}

export interface MarkAllReadResponseDto {
  updatedCount: number;
}
