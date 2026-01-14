import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceScheduleService } from './invoice-schedule.service';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../../../database/prisma.service';
import { InvoiceScheduleModel } from 'src/database/generated/models/InvoiceSchedule';
import { PayrollStatusEnum } from 'src/database/generated/enums';
import { MailService } from 'src/modules/mail/mail.service';
import { TokenDto } from 'src/modules/employee/employee.dto';

@Injectable()
export class InvoiceSchedulerService {
  private readonly logger = new Logger(InvoiceSchedulerService.name);

  constructor(
    private readonly scheduleService: InvoiceScheduleService,
    private readonly invoiceService: InvoiceService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Run every hour to check for invoices that need to be generated
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async generateScheduledInvoices() {
    try {
      const now = new Date();
      const schedules =
        await this.scheduleService.getSchedulesDueForGeneration(now);

      if (schedules.length === 0) {
        this.logger.debug('No invoices scheduled for generation');
        return;
      }

      for (const schedule of schedules) {
        try {
          await this.generateInvoiceFromSchedule(schedule);
        } catch (error) {
          this.logger.error(
            `Failed to generate invoice for schedule ${schedule.id}:`,
            error,
          );
          // Continue with other schedules even if one fails
        }
      }
    } catch (error) {
      this.logger.error('Error in invoice generation scheduler:', error);
    }
  }

  /**
   * Run daily to mark invoices as overdue
   * Checks invoices that are past their due date and marks them as OVERDUE
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async markOverdueInvoices() {
    try {
      const now = new Date();
      const count = await this.invoiceService.markInvoicesAsOverdue(now);

      if (count > 0) {
        this.logger.log(`Marked ${count} invoice(s) as overdue`);
      } else {
        this.logger.debug('No invoices to mark as overdue');
      }
    } catch (error) {
      this.logger.error('Error in overdue invoice scheduler:', error);
    }
  }

  /**
   * Generate invoice from a schedule
   */
  private async generateInvoiceFromSchedule(
    schedule: InvoiceScheduleModel & {
      payroll: {
        id: number;
        companyId: number;
        status: string;
        amount: string;
        payStartDate: Date;
        payEndDate: Date;
        employee: { email: string; name: string };
        company: { companyName: string };
      };
    },
  ): Promise<void> {
    return await this.prisma.$transaction(async (tx) => {
      const { payroll } = schedule;

      // Check if payroll is still active
      if (payroll.status !== PayrollStatusEnum.ACTIVE) {
        this.logger.warn(
          `Skipping invoice generation for payroll ${payroll.id} - payroll is not active`,
        );
        return;
      }

      // Fetch current cycle number from payroll
      const payrollWithCycle = await tx.payroll.findUnique({
        where: { id: payroll.id },
        select: { currentCycleNumber: true, payStartDate: true },
      });

      if (!payrollWithCycle) {
        this.logger.error(`Payroll ${payroll.id} not found`);
        return;
      }

      // Calculate pay date using the same logic as invoice.service.ts
      // Paydate is start date + current cycle month
      const currentPayDate = new Date(payrollWithCycle.payStartDate);
      currentPayDate.setMonth(
        currentPayDate.getMonth() + payrollWithCycle.currentCycleNumber,
      );

      // Calculate previous pay date: current pay date - 1 month
      const previousPayDate = new Date(currentPayDate);
      previousPayDate.setMonth(previousPayDate.getMonth() - 1);

      // Use currentPayDate as the pay date (when employer must pay)
      const payDate = new Date(currentPayDate);

      // Check if invoice already exists for this pay date
      const latestInvoice =
        await this.invoiceService.findLatestInvoiceForPayroll(payroll.id, tx);

      if (latestInvoice) {
        // Check if invoice exists for this specific pay date by comparing with pay date
        // We'll use a tolerance of a few days to account for scheduling variations
        const latestPayDate = new Date(latestInvoice.issueDate);
        latestPayDate.setDate(
          latestPayDate.getDate() + schedule.generateDaysBefore,
        );
        const daysDiff = Math.abs(
          (payDate.getTime() - latestPayDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Prevent duplicate generation for the same pay date
        if (daysDiff < 5) {
          this.logger.warn(
            `Skipping invoice generation - invoice already exists for pay date ${payDate.toISOString()} for payroll ${payroll.id}`,
          );
          return;
        }
      }

      // Issue date is when we generate the invoice (now)
      const issueDate = new Date();
      // Due date is the pay date (when employer must pay)
      const dueDate = new Date(payDate);

      // Generate invoice with the correct pay date
      const invoice = await this.invoiceService.generateInvoice(
        payroll.id,
        payroll.companyId,
        tx,
        {
          issueDate,
          dueDate,
          payDate, // Pass the actual pay date
          isAutoGenerated: true,
          autoGenerateFromPayrollId: payroll.id,
        },
      );

      // Calculate month string from pay date
      const month = payDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      // Send email to employee
      await this.mailService.sendInvoiceNotification(
        payroll.employee.email,
        invoice.invoiceNumber,
        invoice.uuid,
        invoice.dueDate,
        payroll.company.companyName,
        payroll.employee.name,
        payroll.amount,
        month,
        (invoice.paymentToken as unknown as TokenDto).name,
      );

      // Increment current cycle number for the payroll
      const updatedPayroll = await tx.payroll.findUnique({
        where: { id: payroll.id },
        select: {
          currentCycleNumber: true,
          payrollCycle: true,
          payStartDate: true,
        },
      });

      let finalCycleNumber = updatedPayroll?.currentCycleNumber || 0;
      let nextPayDate: Date | null = null;

      if (updatedPayroll) {
        const newCycleNumber = updatedPayroll.currentCycleNumber + 1;

        // Only increment if we haven't reached the cycle limit
        if (newCycleNumber <= updatedPayroll.payrollCycle) {
          await tx.payroll.update({
            where: { id: payroll.id },
            data: { currentCycleNumber: newCycleNumber },
          });

          finalCycleNumber = newCycleNumber;

          // Calculate next pay date using the incremented cycle number
          // This matches the logic in invoice.service.ts
          nextPayDate = new Date(updatedPayroll.payStartDate);
          nextPayDate.setMonth(nextPayDate.getMonth() + newCycleNumber);

          // If we've reached the cycle limit, deactivate the schedule
          if (newCycleNumber >= updatedPayroll.payrollCycle) {
            await tx.invoiceSchedule.update({
              where: { id: schedule.id },
              data: { isActive: false },
            });
            this.logger.log(
              `Payroll ${payroll.id} reached cycle limit (${updatedPayroll.payrollCycle}). Schedule ${schedule.id} deactivated.`,
            );
          }
        }
      }

      // Calculate next generate date based on the next pay date
      // Since we've already calculated the next pay date using cycle-based logic,
      // we just need to subtract generateDaysBefore to get when to generate the invoice
      // If we've reached the cycle limit, nextPayDate will be null and we won't schedule next generation
      const nextGenerateDate = nextPayDate
        ? (() => {
            const generateDate = new Date(nextPayDate);
            generateDate.setDate(
              generateDate.getDate() - schedule.generateDaysBefore,
            );
            return generateDate;
          })()
        : null;

      // Update schedule (only if we have a next generate date)
      if (nextGenerateDate) {
        await this.scheduleService.markAsGenerated(
          schedule.id,
          issueDate,
          nextGenerateDate,
          tx,
        );
      }

      this.logger.log(
        `Generated invoice ${invoice.invoiceNumber} from schedule ${schedule.id} (Cycle ${finalCycleNumber}/${updatedPayroll?.payrollCycle || 0})`,
      );
    });
  }

  /**
   * Calculate next generate date based on the last pay date
   * This calculates when to generate the next invoice (next pay date minus generateDaysBefore)
   */
  private calculateNextGenerateDate(
    frequency: string,
    dayOfMonth?: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dayOfWeek?: number,
    generateDaysBefore: number = 0,
    lastPayDate?: Date,
  ): Date {
    const now = new Date();
    let nextPayDate: Date;

    // If we have a last pay date, calculate from that. Otherwise use current date.
    const baseDate = lastPayDate || now;

    switch (frequency.toUpperCase()) {
      case 'SANDBOX': // fast cycle for testing
        nextPayDate = new Date(baseDate.getTime() + 30 * 1000); // 30 seconds later
        break;
      case 'MONTHLY':
        if (dayOfMonth) {
          nextPayDate = new Date(
            baseDate.getFullYear(),
            baseDate.getMonth() + 1,
            dayOfMonth,
          );
        } else {
          nextPayDate = new Date(
            baseDate.getFullYear(),
            baseDate.getMonth() + 2,
            1,
          );
        }
        break;

      case 'WEEKLY':
        nextPayDate = new Date(baseDate);
        nextPayDate.setDate(baseDate.getDate() + 7);
        break;

      case 'BIWEEKLY':
        nextPayDate = new Date(baseDate);
        nextPayDate.setDate(baseDate.getDate() + 14);
        break;

      case 'QUARTERLY':
        nextPayDate = new Date(
          baseDate.getFullYear(),
          baseDate.getMonth() + 3,
          1,
        );
        break;

      default:
        nextPayDate = new Date(baseDate);
        nextPayDate.setDate(baseDate.getDate() + 30);
    }

    // Generate invoice X days before the pay date
    const generateDate = new Date(nextPayDate);
    generateDate.setDate(generateDate.getDate() - generateDaysBefore);

    return generateDate;
  }
}
