import { Module } from '@nestjs/common';
import { EmployeeService } from './services/employee.service';
import { EmployeeController } from './employee.controller';
import { EmployeeRepository } from './repositories/employee.repository';
import { EmployeeGroupRepository } from './repositories/employee-group.repository';
import { PrismaModule } from '../../database/prisma.module';
import { EmployeeGroupService } from './services/employee-group.service';
import { CompanyModule } from '../company/company.module';
import { TeamMemberModule } from '../team-member/team-member.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule, // Import AuthModule for JwtAuthService and guards
    CompanyModule,
    TeamMemberModule,
  ],
  providers: [
    EmployeeGroupService,
    EmployeeService,
    EmployeeRepository,
    EmployeeGroupRepository,
  ],
  controllers: [EmployeeController],
  exports: [
    EmployeeService,
    EmployeeGroupService,
    EmployeeRepository,
    EmployeeGroupRepository,
  ],
})
export class EmployeeModule {}
