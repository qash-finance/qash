import { Module } from '@nestjs/common';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogRepository } from './activity-log.repository';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ActivityLogController],
  providers: [ActivityLogService, ActivityLogRepository],
  exports: [ActivityLogService, ActivityLogRepository],
})
export class ActivityLogModule {}
