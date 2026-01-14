import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyModule } from '../company/company.module';
import { TeamMemberModule } from '../team-member/team-member.module';
import { SharedModule } from '../shared/shared.module';
import { AdminCompanyRepository } from './repositories/admin-company.repository';
import { AdminCompanyService } from './services/admin-company.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CompanyModule,
    TeamMemberModule,
    SharedModule,
  ],
  providers: [AdminCompanyRepository, AdminCompanyService],
  controllers: [AdminController],
  exports: [AdminCompanyService, AdminCompanyRepository],
})
export class AdminModule {}
