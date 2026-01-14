import { Module, forwardRef } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './services/invoice.service';
import { InvoiceRepository } from './repositories/invoice.repository';
import { InvoiceItemRepository } from './repositories/invoice-item.repository';
import { InvoiceItemService } from './services/invoice-item.service';
import { InvoiceScheduleRepository } from './repositories/invoice-schedule.repository';
import { InvoiceScheduleService } from './services/invoice-schedule.service';
import { InvoiceSchedulerService } from './services/invoice-scheduler.service';
import { PdfService } from './services/pdf.service';
import { B2BInvoiceService } from './services/b2b-invoice.service';
import { B2BInvoiceScheduleService } from './services/b2b-invoice-schedule.service';
import { B2BInvoiceController } from './b2b-invoice.controller';
import { PrismaModule } from '../../database/prisma.module';
import { PayrollModule } from '../payroll/payroll.module';
import { MailModule } from '../mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyModule } from '../company/company.module';
import { EmployeeModule } from '../employee/employee.module';
import { BillModule } from '../bill/bill.module';
import { TeamMemberModule } from '../team-member/team-member.module';
import { ClientModule } from '../client/client.module';

@Module({
  imports: [
    PrismaModule,
    PayrollModule,
    MailModule,
    AuthModule,
    CompanyModule,
    EmployeeModule,
    TeamMemberModule,
    ClientModule,
    forwardRef(() => BillModule),
  ],
  controllers: [InvoiceController, B2BInvoiceController],
  providers: [
    InvoiceService,
    InvoiceRepository,
    InvoiceItemRepository,
    InvoiceItemService,
    InvoiceScheduleRepository,
    InvoiceScheduleService,
    InvoiceSchedulerService,
    PdfService,
    B2BInvoiceService,
    B2BInvoiceScheduleService,
  ],
  exports: [
    InvoiceService,
    InvoiceRepository,
    InvoiceItemRepository,
    InvoiceItemService,
    InvoiceScheduleRepository,
    InvoiceScheduleService,
    PdfService,
    B2BInvoiceService,
    B2BInvoiceScheduleService,
  ],
})
export class InvoiceModule {}
