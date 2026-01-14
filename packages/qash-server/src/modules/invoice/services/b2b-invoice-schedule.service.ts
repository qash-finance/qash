import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InvoiceScheduleRepository } from '../repositories/invoice-schedule.repository';
import { ClientRepository } from '../../client/repositories/client.repository';
import { PrismaService } from '../../../database/prisma.service';
import { CreateB2BScheduleDto, UpdateB2BScheduleDto } from '../invoice.dto';
import { ErrorInvoiceSchedule } from 'src/common/constants/errors';
import { PrismaTransactionClient } from 'src/database/base.repository';

@Injectable()
export class B2BInvoiceScheduleService {
  private readonly logger = new Logger(B2BInvoiceScheduleService.name);

  constructor(
    private readonly scheduleRepository: InvoiceScheduleRepository,
    private readonly clientRepository: ClientRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create B2B invoice schedule for a client
   */
  async createSchedule(
    dto: CreateB2BScheduleDto,
    companyId: number,
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      // Verify client exists and belongs to company
      const client = await this.clientRepository.findByUUID(
        dto.clientId,
        companyId,
        tx,
      );

      if (!client) {
        throw new NotFoundException('Client not found');
      }

      // Check if schedule already exists for this client
      const existing = await this.findByClientId(client.id, tx);

      if (existing) {
        throw new BadRequestException(
          'A schedule already exists for this client',
        );
      }

      // Calculate next generate date
      const nextGenerateDate = this.calculateNextGenerateDate(
        dto.frequency,
        dto.dayOfMonth,
        dto.dayOfWeek,
        dto.generateDaysBefore,
      );

      // Prepare invoice template with due days
      const invoiceTemplate = {
        ...dto.invoiceTemplate,
        dueDaysAfterGeneration: dto.dueDaysAfterGeneration || 30,
      };

      const schedule = await this.scheduleRepository.createSchedule(
        {
          payrollId: null, // Not linked to payroll
          clientId: client.id,
          companyId,
          frequency: dto.frequency,
          dayOfMonth: dto.dayOfMonth,
          dayOfWeek: dto.dayOfWeek,
          generateDaysBefore: dto.generateDaysBefore,
          isActive: true,
          autoSend: dto.autoSend || false,
          nextGenerateDate,
          invoiceTemplate,
          metadata: dto.metadata,
        },
        tx,
      );

      return schedule;
    });
  }

  /**
   * Update B2B invoice schedule
   */
  async updateSchedule(
    scheduleUUID: string,
    dto: UpdateB2BScheduleDto,
    companyId: number,
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      const schedule = await this.findByUUID(scheduleUUID, tx);

      if (!schedule) {
        throw new NotFoundException(
          ErrorInvoiceSchedule.InvoiceScheduleNotFound,
        );
      }

      // Verify schedule belongs to company
      if (schedule.companyId !== companyId) {
        throw new NotFoundException(
          ErrorInvoiceSchedule.InvoiceScheduleNotFound,
        );
      }

      const updateData: any = {};

      if (dto.frequency !== undefined) {
        updateData.frequency = dto.frequency;
      }

      if (dto.dayOfMonth !== undefined) {
        updateData.dayOfMonth = dto.dayOfMonth;
      }

      if (dto.dayOfWeek !== undefined) {
        updateData.dayOfWeek = dto.dayOfWeek;
      }

      if (dto.generateDaysBefore !== undefined) {
        updateData.generateDaysBefore = dto.generateDaysBefore;
      }

      if (dto.autoSend !== undefined) {
        updateData.autoSend = dto.autoSend;
      }

      if (dto.invoiceTemplate !== undefined) {
        updateData.invoiceTemplate = {
          ...dto.invoiceTemplate,
          dueDaysAfterGeneration: dto.dueDaysAfterGeneration || 30,
        };
      } else if (dto.dueDaysAfterGeneration !== undefined) {
        // Update only dueDaysAfterGeneration in existing template
        const existingTemplate = schedule.invoiceTemplate || {};
        updateData.invoiceTemplate = {
          ...existingTemplate,
          dueDaysAfterGeneration: dto.dueDaysAfterGeneration,
        };
      }

      if (dto.metadata !== undefined) {
        updateData.metadata = dto.metadata;
      }

      // Recalculate next generate date if frequency changed
      if (
        dto.frequency !== undefined ||
        dto.dayOfMonth !== undefined ||
        dto.dayOfWeek !== undefined ||
        dto.generateDaysBefore !== undefined
      ) {
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
        schedule.id,
        updateData,
        tx,
      );

      return updated;
    });
  }

  /**
   * Toggle B2B schedule active status
   */
  async toggleSchedule(scheduleUUID: string, companyId: number): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      const schedule = await this.findByUUID(scheduleUUID, tx);

      if (!schedule) {
        throw new NotFoundException(
          ErrorInvoiceSchedule.InvoiceScheduleNotFound,
        );
      }

      if (schedule.companyId !== companyId) {
        throw new NotFoundException(
          ErrorInvoiceSchedule.InvoiceScheduleNotFound,
        );
      }

      const newIsActive = !schedule.isActive;

      // If reactivating, recalculate next generate date
      let nextGenerateDate = schedule.nextGenerateDate;
      if (newIsActive) {
        nextGenerateDate = this.calculateNextGenerateDate(
          schedule.frequency,
          schedule.dayOfMonth,
          schedule.dayOfWeek,
          schedule.generateDaysBefore,
        );
      }

      return await this.scheduleRepository.updateSchedule(
        schedule.id,
        {
          isActive: newIsActive,
          nextGenerateDate,
        },
        tx,
      );
    });
  }

  /**
   * Delete B2B invoice schedule
   */
  async deleteSchedule(scheduleUUID: string, companyId: number): Promise<void> {
    return await this.prisma.$transaction(async (tx) => {
      const schedule = await this.findByUUID(scheduleUUID, tx);

      if (!schedule) {
        throw new NotFoundException(
          ErrorInvoiceSchedule.InvoiceScheduleNotFound,
        );
      }

      if (schedule.companyId !== companyId) {
        throw new NotFoundException(
          ErrorInvoiceSchedule.InvoiceScheduleNotFound,
        );
      }

      await this.scheduleRepository.deleteSchedule(schedule.id, tx);
    });
  }

  /**
   * Get all B2B schedules for a company
   */
  async getSchedulesByCompany(companyId: number): Promise<any[]> {
    return this.scheduleRepository.findB2BSchedulesByCompany(companyId);
  }

  /**
   * Get B2B schedule by UUID
   */
  async getScheduleByUUID(
    scheduleUUID: string,
    companyId: number,
  ): Promise<any | null> {
    const schedule = await this.findByUUID(scheduleUUID);

    if (!schedule || schedule.companyId !== companyId) {
      return null;
    }

    return schedule;
  }

  /**
   * Get B2B schedules due for generation
   */
  async getB2BSchedulesDueForGeneration(
    date: Date = new Date(),
  ): Promise<any[]> {
    return this.scheduleRepository.findB2BSchedulesDueForGeneration(date);
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

  //#region HELPER METHODS
  // *************************************************
  // **************** HELPER METHODS *****************
  // *************************************************

  /**
   * Find schedule by UUID
   */
  private async findByUUID(
    uuid: string,
    tx?: PrismaTransactionClient,
  ): Promise<any | null> {
    const client = tx || this.prisma;
    return client.invoiceSchedule.findUnique({
      where: { uuid },
      include: {
        client: true,
        company: true,
      },
    });
  }

  /**
   * Find schedule by client ID
   */
  private async findByClientId(
    clientId: number,
    tx?: PrismaTransactionClient,
  ): Promise<any | null> {
    const client = tx || this.prisma;
    return client.invoiceSchedule.findFirst({
      where: {
        clientId,
        isActive: true,
      },
    });
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

  //#endregion HELPER METHODS
}
