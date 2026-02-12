import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationResponseDto } from './notification.dto';

interface UserSocket extends Socket {
  userId?: number;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private connectedUsers = new Map<number, string[]>(); // userId -> array of socketIds

  constructor() {}

  async handleConnection(client: UserSocket) {
    this.logger.log(`Client ${client.id} connected to notifications`);

    // Send connection confirmation
    client.emit('connected', {
      message: 'Successfully connected to notifications',
      socketId: client.id,
    });
  }

  handleDisconnect(client: UserSocket) {
    if (client.userId) {
      const userSockets = this.connectedUsers.get(client.userId) || [];
      const updatedSockets = userSockets.filter(
        (socketId) => socketId !== client.id,
      );

      if (updatedSockets.length === 0) {
        this.connectedUsers.delete(client.userId);
      } else {
        this.connectedUsers.set(client.userId, updatedSockets);
      }

      this.logger.log(
        `User ${client.userId} disconnected via socket ${client.id}`,
      );
    } else {
      this.logger.log(`Client ${client.id} disconnected`);
    }
  }

  @SubscribeMessage('join_user')
  handleJoinUser(
    @ConnectedSocket() client: UserSocket,
    @MessageBody() data: { userId: number },
  ) {
    const { userId } = data;

    if (!userId) {
      client.emit('error', { message: 'User ID is required' });
      return;
    }

    // Leave previous user room if any
    if (client.userId) {
      client.leave(`user_${client.userId}`);
      this.removeFromUserTracking(client);
    }

    // Join new user room
    client.userId = userId;
    client.join(`user_${userId}`);

    // Track connected user
    const userSockets = this.connectedUsers.get(userId) || [];
    userSockets.push(client.id);
    this.connectedUsers.set(userId, userSockets);

    this.logger.log(`Client ${client.id} joined user room: ${userId}`);

    client.emit('joined_user', {
      message: 'Successfully joined user notification room',
      userId: userId,
    });
  }

  @SubscribeMessage('leave_user')
  handleLeaveUser(@ConnectedSocket() client: UserSocket) {
    if (client.userId) {
      client.leave(`user_${client.userId}`);
      this.removeFromUserTracking(client);

      this.logger.log(
        `Client ${client.id} left user room: ${client.userId}`,
      );

      client.emit('left_user', {
        message: 'Left user notification room',
        userId: client.userId,
      });

      client.userId = undefined;
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: UserSocket) {
    client.emit('pong', {
      timestamp: new Date().toISOString(),
      socketId: client.id,
      userId: client.userId,
    });
  }

  /**
   * Emit new notification to specific user
   */
  public emitNotificationToUser(
    userId: number,
    notification: NotificationResponseDto,
  ) {
    this.server.to(`user_${userId}`).emit('new_notification', {
      type: 'notification',
      data: notification,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Emitted notification ${notification.id} to user ${userId}`,
    );
  }

  /**
   * Emit unread count update to user
   */
  public emitUnreadCountToUser(userId: number, count: number) {
    this.server.to(`user_${userId}`).emit('unread_count_update', {
      type: 'unread_count',
      count,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Emitted unread count ${count} to user ${userId}`);
  }

  /**
   * Emit when notification is marked as read
   */
  public emitNotificationReadToUser(userId: number, notificationId: number) {
    this.server.to(`user_${userId}`).emit('notification_read', {
      type: 'notification_read',
      notificationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit when all notifications are marked as read
   */
  public emitAllNotificationsReadToUser(userId: number) {
    this.server.to(`user_${userId}`).emit('all_notifications_read', {
      type: 'all_notifications_read',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit when notification is deleted
   */
  public emitNotificationDeletedToUser(userId: number, notificationId: number) {
    this.server.to(`user_${userId}`).emit('notification_deleted', {
      type: 'notification_deleted',
      notificationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connected users count (for debugging/monitoring)
   */
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: number): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get all connected user IDs (for debugging)
   */
  public getConnectedUsers(): number[] {
    return Array.from(this.connectedUsers.keys());
  }

  /**
   * Helper method to remove client from user tracking
   */
  private removeFromUserTracking(client: UserSocket) {
    if (client.userId) {
      const userSockets = this.connectedUsers.get(client.userId) || [];
      const updatedSockets = userSockets.filter(
        (socketId) => socketId !== client.id,
      );

      if (updatedSockets.length === 0) {
        this.connectedUsers.delete(client.userId);
      } else {
        this.connectedUsers.set(client.userId, updatedSockets);
      }
    }
  }
}
