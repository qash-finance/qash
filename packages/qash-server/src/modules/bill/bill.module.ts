import { Module, forwardRef } from '@nestjs/common';
import { BillController } from './bill.controller';
import { BillService } from './bill.service';
import { BillRepository } from './bill.repository';
import { PrismaModule } from '../../database/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyModule } from '../company/company.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => InvoiceModule),
    AuthModule,
    CompanyModule,
    MailModule,
  ],
  controllers: [BillController],
  providers: [BillService, BillRepository],
  exports: [BillService, BillRepository],
})
export class BillModule {}
