import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollRepository } from './payroll.repository';
import { PrismaModule } from '../../database/prisma.module';
import { EmployeeModule } from '../employee/employee.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyModule } from '../company/company.module';
import { TeamMemberModule } from '../team-member/team-member.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, EmployeeModule, AuthModule, CompanyModule, TeamMemberModule, NotificationModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollRepository],
  exports: [PayrollService, PayrollRepository],
})
export class PayrollModule {}
