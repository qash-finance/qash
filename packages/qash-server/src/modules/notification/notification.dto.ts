import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsUrl,
  IsPositive,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  NotificationsStatusEnum,
  NotificationsTypeEnum,
} from '@qash/types/enums';
import type * as SharedTypes from '@qash/types/dto/notification';

export class CreateNotificationDto implements SharedTypes.CreateNotificationDto {
  @ApiProperty({
    description: 'Notification title',
    example: 'Invoice Approved',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Notification message content',
    example: 'Your invoice #12345 has been approved.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationsTypeEnum,
    example: NotificationsTypeEnum.NOP,
  })
  @IsEnum(NotificationsTypeEnum)
  type: NotificationsTypeEnum;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: { invoiceId: '12345', amount: 1000 },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any> | null;

  @ApiPropertyOptional({
    description: 'URL for notification action',
    example: 'https://app.qash.com/invoices/12345',
  })
  @IsUrl()
  @IsOptional()
  actionUrl?: string | null;

  @ApiProperty({
    description: 'User ID who will receive the notification',
    example: 1,
  })
  @IsNumber()
  @IsPositive()
  userId: number;
}

export class UpdateNotificationStatusDto implements SharedTypes.UpdateNotificationStatusDto {
  @ApiProperty({
    description: 'New notification status',
    enum: NotificationsStatusEnum,
    example: NotificationsStatusEnum.READ,
  })
  @IsEnum(NotificationsStatusEnum)
  status: NotificationsStatusEnum;
}

export class NotificationQueryDto implements SharedTypes.NotificationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by notification type',
    enum: NotificationsTypeEnum,
  })
  @IsEnum(NotificationsTypeEnum)
  @IsOptional()
  type?: NotificationsTypeEnum;

  @ApiPropertyOptional({
    description: 'Filter by notification status',
    enum: NotificationsStatusEnum,
  })
  @IsEnum(NotificationsStatusEnum)
  @IsOptional()
  status?: NotificationsStatusEnum;
}

export class NotificationResponseDto implements SharedTypes.NotificationResponseDto {
  @ApiProperty({
    description: 'Notification ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Notification title',
    example: 'Invoice Approved',
  })
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'Your invoice #12345 has been approved.',
    nullable: true,
  })
  message: string | null;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationsTypeEnum,
  })
  type: NotificationsTypeEnum;

  @ApiProperty({
    description: 'Notification status',
    enum: NotificationsStatusEnum,
  })
  status: NotificationsStatusEnum;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    nullable: true,
  })
  metadata: Record<string, any> | null;

  @ApiPropertyOptional({
    description: 'Action URL',
    nullable: true,
  })
  actionUrl: string | null;

  @ApiProperty({
    description: 'User ID who owns this notification',
    example: 1,
  })
  userId: number;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'When notification was read',
    nullable: true,
  })
  readAt: Date | null;
}

export class NotificationWithPaginationDto implements SharedTypes.NotificationWithPaginationDto {
  @ApiProperty({
    description: 'Array of notifications',
    type: [NotificationResponseDto],
  })
  notifications: NotificationResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
  })
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class UnreadCountResponseDto implements SharedTypes.UnreadCountResponseDto {
  @ApiProperty({
    description: 'Count of unread notifications',
    example: 5,
  })
  count: number;
}

export class MarkAllReadResponseDto implements SharedTypes.MarkAllReadResponseDto {
  @ApiProperty({
    description: 'Number of notifications marked as read',
    example: 10,
  })
  updatedCount: number;
}
