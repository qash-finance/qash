import { Module } from '@nestjs/common';
import { MultisigController } from './multisig.controller';
import { MultisigService } from './services/multisig.service';
import { MidenClientService } from './services/miden-client.service';
import { PrismaService } from '../../database/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { CompanyModule } from '../company/company.module';
import { BillModule } from '../bill/bill.module';

@Module({
  imports: [ConfigModule, AuthModule, ActivityLogModule, CompanyModule, BillModule],
  controllers: [MultisigController],
  providers: [MultisigService, MidenClientService, PrismaService],
  exports: [MultisigService, MidenClientService],
})
export class MultisigModule {}
