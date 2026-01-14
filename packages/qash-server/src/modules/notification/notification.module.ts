import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationRepository } from './notification.repository';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [NotificationController],
  providers: [
    Logger,
    NotificationService,
    NotificationGateway,
    NotificationRepository,
  ],
  exports: [NotificationService, NotificationGateway, NotificationRepository],
})
export class NotificationModule {}
