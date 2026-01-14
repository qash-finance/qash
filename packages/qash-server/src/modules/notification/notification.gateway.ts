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

interface WalletSocket extends Socket {
  walletAddress?: string;
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
  private connectedWallets = new Map<string, string[]>(); // walletAddress -> array of socketIds

  constructor() {}

  async handleConnection(client: WalletSocket) {
    this.logger.log(`Client ${client.id} connected to notifications`);

    // Send connection confirmation
    client.emit('connected', {
      message: 'Successfully connected to notifications',
      socketId: client.id,
    });
  }

  handleDisconnect(client: WalletSocket) {
    if (client.walletAddress) {
      const walletSockets =
        this.connectedWallets.get(client.walletAddress) || [];
      const updatedSockets = walletSockets.filter(
        (socketId) => socketId !== client.id,
      );

      if (updatedSockets.length === 0) {
        this.connectedWallets.delete(client.walletAddress);
      } else {
        this.connectedWallets.set(client.walletAddress, updatedSockets);
      }

      this.logger.log(
        `Wallet ${client.walletAddress} disconnected via socket ${client.id}`,
      );
    } else {
      this.logger.log(`Client ${client.id} disconnected`);
    }
  }

  @SubscribeMessage('join_wallet')
  handleJoinWallet(
    @ConnectedSocket() client: WalletSocket,
    @MessageBody() data: { walletAddress: string },
  ) {
    const { walletAddress } = data;

    if (!walletAddress) {
      client.emit('error', { message: 'Wallet address is required' });
      return;
    }

    // Leave previous wallet room if any
    if (client.walletAddress) {
      client.leave(`wallet_${client.walletAddress}`);
      this.removeFromWalletTracking(client);
    }

    // Join new wallet room
    client.walletAddress = walletAddress;
    client.join(`wallet_${walletAddress}`);

    // Track connected wallet
    const walletSockets = this.connectedWallets.get(walletAddress) || [];
    walletSockets.push(client.id);
    this.connectedWallets.set(walletAddress, walletSockets);

    this.logger.log(`Client ${client.id} joined wallet room: ${walletAddress}`);

    client.emit('joined_wallet', {
      message: 'Successfully joined wallet notification room',
      walletAddress: walletAddress,
    });
  }

  @SubscribeMessage('leave_wallet')
  handleLeaveWallet(@ConnectedSocket() client: WalletSocket) {
    if (client.walletAddress) {
      client.leave(`wallet_${client.walletAddress}`);
      this.removeFromWalletTracking(client);

      this.logger.log(
        `Client ${client.id} left wallet room: ${client.walletAddress}`,
      );

      client.emit('left_wallet', {
        message: 'Left wallet notification room',
        walletAddress: client.walletAddress,
      });

      client.walletAddress = undefined;
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: WalletSocket) {
    client.emit('pong', {
      timestamp: new Date().toISOString(),
      socketId: client.id,
      walletAddress: client.walletAddress,
    });
  }

  // Method to emit notification to specific wallet address
  public emitNotificationToWallet(
    walletAddress: string,
    notification: NotificationResponseDto,
  ) {
    this.server.to(`wallet_${walletAddress}`).emit('new_notification', {
      type: 'notification',
      data: notification,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Emitted notification ${notification.id} to wallet ${walletAddress}`,
    );
  }

  // Method to emit notification count update to wallet
  public emitUnreadCountToWallet(walletAddress: string, count: number) {
    this.server.to(`wallet_${walletAddress}`).emit('unread_count_update', {
      type: 'unread_count',
      count,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Emitted unread count ${count} to wallet ${walletAddress}`);
  }

  // Method to emit when notification is marked as read to wallet
  public emitNotificationReadToWallet(
    walletAddress: string,
    notificationId: number,
  ) {
    this.server.to(`wallet_${walletAddress}`).emit('notification_read', {
      type: 'notification_read',
      notificationId,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to emit when all notifications are marked as read to wallet
  public emitAllNotificationsReadToWallet(walletAddress: string) {
    this.server.to(`wallet_${walletAddress}`).emit('all_notifications_read', {
      type: 'all_notifications_read',
      timestamp: new Date().toISOString(),
    });
  }

  // Get connected wallets count for debugging
  public getConnectedWalletsCount(): number {
    return this.connectedWallets.size;
  }

  // Check if wallet is connected
  public isWalletConnected(walletAddress: string): boolean {
    return this.connectedWallets.has(walletAddress);
  }

  // Get all connected wallets (for debugging)
  public getConnectedWallets(): string[] {
    return Array.from(this.connectedWallets.keys());
  }

  // Helper method to remove client from wallet tracking
  private removeFromWalletTracking(client: WalletSocket) {
    if (client.walletAddress) {
      const walletSockets =
        this.connectedWallets.get(client.walletAddress) || [];
      const updatedSockets = walletSockets.filter(
        (socketId) => socketId !== client.id,
      );

      if (updatedSockets.length === 0) {
        this.connectedWallets.delete(client.walletAddress);
      } else {
        this.connectedWallets.set(client.walletAddress, updatedSockets);
      }
    }
  }
}
