import { Module } from '@nestjs/common';
import { PaymentLinkService } from './payment-link.service';
import { PaymentLinkController } from './payment-link.controller';
import {
  PaymentLinkRepository,
  PaymentLinkRecordRepository,
} from './payment-link.repository';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyModule } from '../company/company.module';
import { TeamMemberModule } from '../team-member/team-member.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, AuthModule, CompanyModule, TeamMemberModule, NotificationModule],
  providers: [
    PaymentLinkService,
    PaymentLinkRepository,
    PaymentLinkRecordRepository,
  ],
  controllers: [PaymentLinkController],
  exports: [
    PaymentLinkService,
    PaymentLinkRepository,
    PaymentLinkRecordRepository,
  ],
})
export class PaymentLinkModule {}
