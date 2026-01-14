import { Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppService } from './app.service';
import {
  mailConfig,
  authConfig,
  databaseConfig,
  othersConfig,
  serverConfig,
} from './modules/shared/config/registration';
import { EmployeeModule } from './modules/employee/employee.module';
import { AppConfigServiceModule } from './modules/shared/config/config.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PrismaModule } from './database/prisma.module';
import { PaymentLinkModule } from './modules/payment-link/payment-link.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { TeamMemberModule } from './modules/team-member/team-member.module';
import { AdminModule } from './modules/admin/admin.module';
import { SharedModule } from './modules/shared/shared.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { BillModule } from './modules/bill/bill.module';
import { ClientModule } from './modules/client/client.module';
import { envValidator } from './common/validators/env.validation';
import { HttpValidationPipe } from './modules/shared/pipes/http-validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: process.env.NODE_ENV
        ? `.env.${process.env.NODE_ENV}`
        : '.env',
      validationSchema: envValidator,
      load: [
        databaseConfig,
        mailConfig,
        authConfig,
        othersConfig,
        serverConfig,
      ],
      isGlobal: true,
    }),
    AppConfigServiceModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    HealthModule,
    AuthModule,
    EmployeeModule,
    NotificationModule,
    PaymentLinkModule,
    CompanyModule,
    TeamMemberModule,
    AdminModule,
    SharedModule,
    PayrollModule,
    InvoiceModule,
    BillModule,
    ClientModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: HttpValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure() {}
}
