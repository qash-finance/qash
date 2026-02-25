import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { NotificationService } from './notification.service';
import {
  NotificationQueryDto,
  NotificationResponseDto,
  NotificationWithPaginationDto,
  UnreadCountResponseDto,
  MarkAllReadResponseDto,
} from './notification.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser, UserWithCompany } from '../auth/decorators/current-user.decorator';

@ApiBearerAuth()
@ApiTags('Notifications')
@Controller('notifications')
@Auth()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  /***************************************/
  /***************** GET *****************/
  /***************************************/

  @Get()
  @ApiOperation({
    summary: 'Get user notifications',
    description:
      'Retrieve notifications for the authenticated user with pagination and filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: NotificationWithPaginationDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
  })
  async getUserNotifications(
    @CurrentUser() user: UserWithCompany,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationWithPaginationDto> {
    this.logger.log(`Getting notifications for user ${user.internalUserId}`);
    return this.notificationService.getUserNotifications(user.internalUserId, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Get the count of unread notifications for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    type: UnreadCountResponseDto,
  })
  async getUnreadCount(
    @CurrentUser() user: UserWithCompany,
  ): Promise<UnreadCountResponseDto> {
    const count = await this.notificationService.getUnreadCount(user.internalUserId);
    return { count };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get notification by ID',
    description: 'Retrieve a specific notification by its ID',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Notification ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification retrieved successfully',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  @ApiForbiddenResponse({
    description: 'Access denied to notification',
  })
  async getNotificationById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserWithCompany,
  ): Promise<NotificationResponseDto> {
    this.logger.log(`Getting notification ${id} for user ${user.internalUserId}`);
    const notification = await this.notificationService.getNotificationById(
      id,
      user.internalUserId,
    );
    return this.notificationService['mapToResponseDto'](notification);
  }

  /***************************************/
  /***************** PATCH ***************/
  /***************************************/

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Mark a specific notification as read',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Notification ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  @ApiForbiddenResponse({
    description: 'Access denied to notification',
  })
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserWithCompany,
  ): Promise<NotificationResponseDto> {
    this.logger.log(`Marking notification ${id} as read for user ${user.internalUserId}`);
    const notification = await this.notificationService.markAsRead(
      id,
      user.internalUserId,
    );
    return this.notificationService['mapToResponseDto'](notification);
  }

  @Patch(':id/unread')
  @ApiOperation({
    summary: 'Mark notification as unread',
    description: 'Mark a specific notification as unread',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Notification ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as unread',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  @ApiForbiddenResponse({
    description: 'Access denied to notification',
  })
  async markAsUnread(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserWithCompany,
  ): Promise<NotificationResponseDto> {
    this.logger.log(`Marking notification ${id} as unread for user ${user.internalUserId}`);
    const notification = await this.notificationService.markAsUnread(
      id,
      user.internalUserId,
    );
    return this.notificationService['mapToResponseDto'](notification);
  }

  @Patch('mark-all-read')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all notifications for the authenticated user as read',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    type: MarkAllReadResponseDto,
  })
  async markAllAsRead(
    @CurrentUser() user: UserWithCompany,
  ): Promise<MarkAllReadResponseDto> {
    this.logger.log(`Marking all notifications as read for user ${user.internalUserId}`);
    return this.notificationService.markAllAsRead(user.internalUserId);
  }

  /***************************************/
  /***************** DELETE **************/
  /***************************************/

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a specific notification',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Notification ID',
    example: 1,
  })
  @ApiResponse({
    status: 204,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  @ApiForbiddenResponse({
    description: 'Access denied to notification',
  })
  async deleteNotification(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserWithCompany,
  ): Promise<void> {
    this.logger.log(`Deleting notification ${id} for user ${user.internalUserId}`);
    await this.notificationService.deleteNotification(id, user.internalUserId);
  }
}

