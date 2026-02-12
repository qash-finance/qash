import { Logger, Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationRepository } from './notification.repository';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    forwardRef(() => AuthModule),
  ],
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
