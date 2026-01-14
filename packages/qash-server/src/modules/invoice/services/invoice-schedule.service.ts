import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InvoiceScheduleRepository } from '../repositories/invoice-schedule.repository';
import { PayrollRepository } from '../../payroll/payroll.repository';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateInvoiceScheduleDto,
  UpdateInvoiceScheduleDto,
} from '../invoice.dto';
import {
  ErrorInvoiceSchedule,
  ErrorPayroll,
} from 'src/common/constants/errors';
import { PrismaTransactionClient } from 'src/database/base.repository';

@Injectable()
export class InvoiceScheduleService {
  private readonly logger = new Logger(InvoiceScheduleService.name);

  constructor(
    private readonly scheduleRepository: InvoiceScheduleRepository,
    private readonly payrollRepository: PayrollRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create invoice schedule for a payroll
   */
  async createSchedule(
    payrollId: number,
    companyId: number,
    dto: CreateInvoiceScheduleDto,
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      const payroll = await this.payrollRepository.findById(
        payrollId,
        companyId,
        tx,
      );

      if (!payroll) {
        throw new NotFoundException(ErrorPayroll.PayrollNotFound);
      }

      // Check if schedule already exists
      const existing = await this.scheduleRepository.findByPayrollId(
        payrollId,
        tx,
      );

      if (existing) {
        throw new BadRequestException(
          ErrorInvoiceSchedule.InvoiceScheduleAlreadyExists,
        );
      }

      // Calculate next generate date
      const nextGenerateDate = this.calculateNextGenerateDate(
        dto.frequency,
        dto.dayOfMonth,
        dto.dayOfWeek,
        dto.generateDaysBefore,
      );

      const schedule = await this.scheduleRepository.createSchedule(
        {
          payrollId,
          frequency: dto.frequency,
          dayOfMonth: dto.dayOfMonth,
          dayOfWeek: dto.dayOfWeek,
          generateDaysBefore: dto.generateDaysBefore,
          isActive: true,
          nextGenerateDate,
          invoiceTemplate: dto.invoiceTemplate,
          metadata: dto.metadata,
        },
        tx,
      );

      return schedule;
    });
  }

  /**
   * Update invoice schedule
   */
  async updateSchedule(
    id: number,
    companyId: number,
    dto: UpdateInvoiceScheduleDto,
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      const schedule = await this.scheduleRepository.findById(id, tx);

      if (!schedule) {
        throw new NotFoundException(
          ErrorInvoiceSchedule.InvoiceScheduleNotFound,
        );
      }

      // Verify payroll belongs to company
      if (schedule.payroll.companyId !== companyId) {
        throw new NotFoundException(
          ErrorInvoiceSchedule.InvoiceScheduleNotFound,
        );
      }

      const updateData: any = { ...dto };

      // Recalculate next generate date if frequency changed
      if (dto.frequency || dto.dayOfMonth || dto.dayOfWeek) {
        const frequency = dto.frequency || schedule.frequency;
        const dayOfMonth = dto.dayOfMonth ?? schedule.dayOfMonth;
        const dayOfWeek = dto.dayOfWeek ?? schedule.dayOfWeek;
        const generateDaysBefore =
          dto.generateDaysBefore ?? schedule.generateDaysBefore;

        updateData.nextGenerateDate = this.calculateNextGenerateDate(
          frequency,
          dayOfMonth,
          dayOfWeek,
          generateDaysBefore,
        );
      }

      const updated = await this.scheduleRepository.updateSchedule(
        id,
        updateData,
        tx,
      );

      return updated;
    });
  }

  /**
   * Delete invoice schedule
   */
  async deleteSchedule(id: number, companyId: number): Promise<void> {
    return await this.prisma.$transaction(async (tx) => {
      const schedule = await this.scheduleRepository.findById(id, tx);

      if (!schedule) {
        throw new NotFoundException(
          ErrorInvoiceSchedule.InvoiceScheduleNotFound,
        );
      }

      if (schedule.payroll.companyId !== companyId) {
        throw new NotFoundException(
          ErrorInvoiceSchedule.InvoiceScheduleNotFound,
        );
      }

      await this.scheduleRepository.deleteSchedule(id, tx);
    });
  }

  /**
   * Get schedule by payroll ID
   */
  async getScheduleByPayrollId(
    payrollId: number,
    companyId: number,
  ): Promise<any | null> {
    const schedule = await this.scheduleRepository.findByPayrollId(payrollId);

    if (!schedule) {
      return null;
    }

    if (schedule.payroll.companyId !== companyId) {
      return null;
    }

    return schedule;
  }

  /**
   * Calculate next generate date based on frequency
   */
  private calculateNextGenerateDate(
    frequency: string,
    dayOfMonth?: number,
    dayOfWeek?: number,
    generateDaysBefore: number = 0,
  ): Date {
    const now = new Date();
    let nextDate = new Date();

    switch (frequency.toUpperCase()) {
      case 'MONTHLY':
        if (dayOfMonth) {
          nextDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
          if (nextDate <= now) {
            nextDate = new Date(
              now.getFullYear(),
              now.getMonth() + 1,
              dayOfMonth,
            );
          }
        } else {
          nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }
        break;

      case 'WEEKLY':
        if (dayOfWeek !== undefined) {
          const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7 || 7;
          nextDate = new Date(now);
          nextDate.setDate(now.getDate() + daysUntilNext);
        } else {
          nextDate = new Date(now);
          nextDate.setDate(now.getDate() + 7);
        }
        break;

      case 'BIWEEKLY':
        nextDate = new Date(now);
        nextDate.setDate(now.getDate() + 14);
        break;

      case 'QUARTERLY':
        nextDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
        break;

      default:
        nextDate = new Date(now);
        nextDate.setDate(now.getDate() + 30);
    }

    // Subtract generateDaysBefore
    if (generateDaysBefore > 0) {
      nextDate.setDate(nextDate.getDate() - generateDaysBefore);
    }

    return nextDate;
  }

  /**
   * Get schedules due for generation (used by scheduled job)
   */
  async getSchedulesDueForGeneration(date: Date = new Date()) {
    return this.scheduleRepository.findSchedulesDueForGeneration(date);
  }

  /**
   * Update schedule after invoice generation
   */
  async markAsGenerated(
    scheduleId: number,
    lastGeneratedAt: Date,
    nextGenerateDate: Date,
    tx: PrismaTransactionClient,
  ): Promise<void> {
    await this.scheduleRepository.updateLastGenerated(
      scheduleId,
      lastGeneratedAt,
      nextGenerateDate,
      tx,
    );
  }
}
