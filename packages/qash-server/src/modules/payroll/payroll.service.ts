import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PayrollRepository, PayrollWithInvoices } from './payroll.repository';
import { EmployeeRepository } from '../employee/repositories/employee.repository';
import {
  CreatePayrollDto,
  UpdatePayrollDto,
  PayrollQueryDto,
  PayrollStatsDto,
  CreatePayroll,
} from './payroll.dto';
import {
  InvoiceScheduleUpdateInput,
  PayrollCreateInput,
  PayrollModel,
  PayrollUpdateInput,
} from 'src/database/generated/models';
import {
  ContractTermEnum,
  InvoiceStatusEnum,
  Payroll,
  PayrollStatusEnum,
} from 'src/database/generated/client';
import { handleError } from 'src/common/utils/errors';
import { PrismaService } from 'src/database/prisma.service';
import { ErrorEmployee, ErrorPayroll } from 'src/common/constants/errors';
import { JsonValue } from '@prisma/client/runtime/client';
import {
  PaginatedResult,
  PrismaTransactionClient,
} from 'src/database/base.repository';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly employeeRepository: EmployeeRepository,
    private readonly prisma: PrismaService,
  ) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************
  /**
   * Get all payrolls with pagination
   */
  async getPayrolls(
    companyId: number,
    query: PayrollQueryDto,
  ): Promise<{
    payrolls: PayrollModel[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      // Build Prisma where clause
      const whereClause: any = {
        companyId,
        // Exclude deleted payrolls by default
        status: {
          not: PayrollStatusEnum.DELETED,
        },
      };

      if (query.employeeId) {
        whereClause.employeeId = query.employeeId;
      }

      if (query.contractTerm) {
        whereClause.contractTerm = query.contractTerm;
      }

      // Convert search parameter to Prisma filters
      if (query.search) {
        whereClause.OR = [
          {
            description: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            note: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            amount: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            employee: {
              OR: [
                {
                  name: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        ];
      }

      const result: PaginatedResult<Payroll> =
        await this.payrollRepository.findManyPaginated(
          whereClause,
          {
            page: query.page || 1,
            limit: query.limit || 10,
            orderBy: {
              createdAt: 'desc',
            },
          },
          {
            include: {
              employee: true,
            },
          },
        );

      return {
        payrolls: result.data,
        pagination: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching payrolls:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get payroll details with payment history
   */
  async getPayrollDetails(
    id: number,
    companyId: number,
  ): Promise<PayrollModel> {
    try {
      const payroll = await this.payrollRepository.findById(id, companyId);

      if (!payroll) {
        throw new NotFoundException(ErrorPayroll.PayrollNotFound);
      }

      return payroll;
    } catch (error) {
      this.logger.error(`Error fetching payroll ${id}:`, error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get payroll statistics
   */
  async getPayrollStats(companyId: number): Promise<PayrollStatsDto> {
    try {
      return this.payrollRepository.getStats(companyId);
    } catch (error) {
      this.logger.error('Error fetching payroll stats:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get payrolls due for payment (for scheduled jobs)
   */
  async getPayrollsDue(date?: Date): Promise<PayrollModel[]> {
    try {
      const dueDate = date || new Date();
      return await this.payrollRepository.findDuePayrolls(dueDate);
    } catch (error) {
      this.logger.error('Error fetching due payrolls:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Check if payroll has pending invoice reviews from employee
   * Returns information about invoices that are SENT and waiting for employee review
   */
  async checkPendingInvoiceReviews(
    id: number,
    companyId: number,
  ): Promise<{
    hasPendingReviews: boolean;
    pendingCount: number;
    pendingInvoiceUuids: string[];
  }> {
    try {
      // First verify payroll exists and belongs to company
      const payroll = await this.payrollRepository.findById(id, companyId);

      if (!payroll) {
        throw new NotFoundException(ErrorPayroll.PayrollNotFound);
      }

      // Query invoices with SENT status for this payroll
      const pendingInvoices = await this.prisma.invoice.findMany({
        where: {
          payrollId: id,
          status: InvoiceStatusEnum.SENT,
        },
        select: {
          uuid: true,
        },
      });

      const pendingCount = pendingInvoices.length;
      const pendingInvoiceUuids = pendingInvoices.map((inv) => inv.uuid);

      return {
        hasPendingReviews: pendingCount > 0,
        pendingCount,
        pendingInvoiceUuids,
      };
    } catch (error) {
      this.logger.error(
        `Error checking pending invoice reviews for payroll ${id}:`,
        error,
      );
      handleError(error, this.logger);
    }
  }

  //#endregion GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************
  /**
   * Create new payroll
   */
  async createPayroll(
    companyId: number,
    dto: CreatePayrollDto,
    options?: { scheduleFrequency?: string },
  ): Promise<PayrollModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const scheduleFrequency = options?.scheduleFrequency ?? 'MONTHLY';
        // Make sure employee exists and belongs to company
        const employee = await this.employeeRepository.findOne(
          { id: dto.employeeId, companyId },
          tx,
        );

        if (!employee) {
          throw new NotFoundException(ErrorEmployee.ContactNotFound);
        }

        // Check if employee already has an active payroll
        const existingPayrolls = await this.payrollRepository.findByEmployeeId(
          dto.employeeId,
          companyId,
          tx,
        );

        const activePayroll = existingPayrolls.find(
          (p) => p.status === PayrollStatusEnum.ACTIVE,
        );

        if (activePayroll) {
          throw new ConflictException(ErrorPayroll.HaveActivePayroll);
        }

        // Calculate contract dates
        const paydayDay = dto.payday; // the chosen day-of-month (1-31)
        const joiningDate = new Date(dto.joiningDate);

        // First pay date starts next month on the chosen day-of-month
        const today = new Date();
        const payStartDate = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          paydayDay,
        );

        // Contract end date after the payroll cycle
        const payEndDate = new Date(payStartDate);
        payEndDate.setMonth(payEndDate.getMonth() + dto.payrollCycle);

        // TODO: Uncomment this when we have a way to handle this
        // Pay start date must be after joining date
        // if (payStartDate < joiningDate) {
        //   throw new BadRequestException(
        //     ErrorPayroll.PayStartDateBeforeJoiningDate,
        //   );
        // }

        const payrollData: PayrollCreateInput = {
          company: {
            connect: {
              id: companyId,
            },
          },
          employee: {
            connect: {
              id: dto.employeeId,
            },
          },
          network: dto.network as unknown as JsonValue,
          token: dto.token as unknown as JsonValue,
          amount: dto.amount,
          contractTerm: dto.contractTerm,
          payrollCycle: dto.payrollCycle,
          joiningDate: joiningDate,
          payStartDate: payStartDate,
          payEndDate: payEndDate,
          description: dto.description,
          note: dto.note,
          metadata: dto.metadata,
          paydayDay: paydayDay,
        };

        const payroll = await this.payrollRepository.create(payrollData, tx);

        // Create an invoice schedule record so the scheduler can generate invoices
        const generateDaysBefore = dto.generateDaysBefore ?? 5; // Default 5 days before pay date

        // For sandbox/testing, generate invoice very soon (30 seconds)
        // Otherwise, calculate based on pay start date
        let nextGenerateDate: Date;
        if (scheduleFrequency === 'SANDBOX') {
          nextGenerateDate = new Date(Date.now() + 30 * 1000); // 30 seconds from now
        } else {
          nextGenerateDate = this.calculateNextGenerateDateFromPayStart(
            payStartDate,
            generateDaysBefore,
          );
        }

        await tx.invoiceSchedule.create({
          data: {
            payroll: { connect: { id: payroll.id } },
            isActive: true,
            frequency: scheduleFrequency,
            dayOfMonth: payStartDate.getDate(),
            generateDaysBefore,
            nextGenerateDate,
          },
        });

        return payroll;
      });
    } catch (error) {
      this.logger.error('Error creating payroll:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Sandbox helper: create a payroll with a pay date ~30 seconds from now
   * to test the invoice scheduler. Uses minimal required fields and defaults.
   */
  async createSandboxPayroll(
    companyId: number,
    employeeId: number,
    amount: number,
  ): Promise<PayrollModel> {
    // Build a DTO with near-future pay start date
    const now = new Date();
    const payStartDate = new Date(now.getTime() + 30_000); // 30 seconds later
    const payEndDate = new Date(payStartDate);
    payEndDate.setMonth(payEndDate.getMonth() + 1);

    const dto: CreatePayroll = {
      employeeId,
      network: {
        name: 'Miden Testnet',
        description: 'Miden Testnet',
        chainId: 1,
      },
      token: {
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'Qash',
        decimals: 2,
        name: 'Qash',
      },
      contractTerm: PayrollStatusEnum.ACTIVE as any, // will be overwritten below
      payrollCycle: 5,
      amount: amount.toString(),
      payday: payStartDate.getDate(),
      payEndDate: payEndDate.toISOString(),
      joiningDate: now.toISOString(),
      note: 'sandbox payroll for scheduler test',
      description: 'sandbox payroll for scheduler test',
    };

    // contractTerm expects ContractTermEnum; reuse same enum from generated client
    (dto as any).contractTerm = ContractTermEnum.PERMANENT;

    return this.createPayroll(companyId, dto, { scheduleFrequency: 'SANDBOX' });
  }

  //#endregion POST METHODS

  //#region PUT METHODS
  // *************************************************
  // **************** PUT METHODS ********************
  // *************************************************

  /**
   * Update payroll
   */
  async updatePayroll(
    id: number,
    companyId: number,
    dto: UpdatePayrollDto,
  ): Promise<PayrollModel> {
    try {
      return await this.prisma.$transaction(
        async (tx: PrismaTransactionClient) => {
          const existingPayroll = await this.payrollRepository.findOne(
            { id, companyId },
            tx,
          );

          if (!existingPayroll) {
            throw new NotFoundException(ErrorPayroll.PayrollNotFound);
          }

          let payStartDate = existingPayroll.payStartDate;
          let payEndDate = existingPayroll.payEndDate;

          // If payday updated, recompute next pay start date starting next month
          if (dto.paydayDay) {
            const paydayDay = dto.paydayDay;
            const now = new Date();
            payStartDate = new Date(
              now.getFullYear(),
              now.getMonth() + 1,
              paydayDay,
            );
          }

          // If payroll cycle updated, recalc end date from (possibly new) start date
          if (dto.payrollCycle) {
            payEndDate = new Date(payStartDate);
            payEndDate.setMonth(payEndDate.getMonth() + dto.payrollCycle);
          }

          const updateData: PayrollUpdateInput = {
            ...dto,
            network: dto.network as unknown as JsonValue,
            token: dto.token as unknown as JsonValue,
            ...(dto.payrollCycle && { payEndDate }),
            ...(dto.paydayDay && { payStartDate }),
          };

          const updatedPayroll = await this.payrollRepository.update(
            { id, companyId },
            updateData,
            tx,
          );

          // Update invoice schedule if payday or payrollCycle changed
          const schedule = await tx.invoiceSchedule.findFirst({
            where: { payrollId: id, isActive: true },
          });

          if (schedule) {
            const scheduleUpdates: InvoiceScheduleUpdateInput = {};

            // If payday changed, update dayOfMonth and recalculate nextGenerateDate
            if (dto.paydayDay) {
              scheduleUpdates.dayOfMonth = payStartDate.getDate();
              // Recalculate nextGenerateDate based on new payday
              const generateDaysBefore = schedule.generateDaysBefore ?? 5;
              scheduleUpdates.nextGenerateDate =
                this.calculateNextGenerateDateFromPayStart(
                  payStartDate,
                  generateDaysBefore,
                );
            }

            // If payrollCycle changed, we might need to update frequency
            // For now, we'll keep the existing frequency since payrollCycle is months
            // and most payrolls are monthly regardless of cycle length

            // Update the schedule if there are changes
            if (Object.keys(scheduleUpdates).length > 0) {
              await tx.invoiceSchedule.update({
                where: { id: schedule.id },
                data: scheduleUpdates,
              });
            }
          }

          return updatedPayroll;
        },
      );
    } catch (error) {
      this.logger.error('Error updating payroll:', error);
      handleError(error, this.logger);
    }
  }
  //#endregion PUT METHODS

  //#region PATCH METHODS
  // *************************************************
  // **************** PATCH METHODS ******************
  // *************************************************
  /**
   * Pause payroll
   */
  async pausePayroll(id: number, companyId: number): Promise<PayrollModel> {
    try {
      return this.updatePayrollStatus(id, companyId, PayrollStatusEnum.PAUSED);
    } catch (error) {
      this.logger.error('Error pausing payroll:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Resume payroll
   */
  async resumePayroll(id: number, companyId: number): Promise<PayrollModel> {
    try {
      return this.updatePayrollStatus(id, companyId, PayrollStatusEnum.ACTIVE);
    } catch (error) {
      this.logger.error('Error resuming payroll:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Delete payroll (soft delete)
   * - Marks all SENT invoices as DELETED
   * - Stops the invoice scheduler (sets isActive to false)
   * - Soft deletes the payroll (sets status to DELETED)
   */
  async deletePayroll(id: number, companyId: number): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const payroll: PayrollWithInvoices =
          await this.payrollRepository.findById(id, companyId, tx);

        if (!payroll) {
          throw new NotFoundException(ErrorPayroll.PayrollNotFound);
        }

        // Check if payroll is already deleted
        if (payroll.status === PayrollStatusEnum.DELETED) {
          throw new ConflictException(ErrorPayroll.PayrollAlreadyDeleted);
        }

        // Mark all SENT invoices (pending review) as DELETED
        if (payroll.invoices && payroll.invoices.length > 0) {
          const sentInvoices = payroll.invoices.filter(
            (invoice) => invoice.status === InvoiceStatusEnum.SENT,
          );

          if (sentInvoices.length > 0) {
            await tx.invoice.updateMany({
              where: {
                id: { in: sentInvoices.map((inv) => inv.id) },
                status: InvoiceStatusEnum.SENT,
              },
              data: {
                status: InvoiceStatusEnum.DELETED,
              },
            });
          }
        }

        // Stop the invoice scheduler (set isActive to false)
        await tx.invoiceSchedule.updateMany({
          where: { payrollId: id },
          data: { isActive: false },
        });

        // Soft delete the payroll (set status to DELETED)
        await this.payrollRepository.update(
          { id, companyId },
          { status: PayrollStatusEnum.DELETED },
          tx,
        );
      });
    } catch (error) {
      this.logger.error(`Error deleting payroll ${id}:`, error);
      handleError(error, this.logger);
    }
  }
  //#endregion PATCH METHODS

  /**
   * Private helper to update payroll status
   */
  private async updatePayrollStatus(
    id: number,
    companyId: number,
    status: PayrollStatusEnum,
  ): Promise<PayrollModel> {
    return await this.prisma.$transaction(async (tx) => {
      const payroll = await this.payrollRepository.findById(id, companyId, tx);

      if (!payroll) {
        throw new NotFoundException(ErrorPayroll.PayrollNotFound);
      }

      const updatedPayroll = await this.payrollRepository.update(
        { id, companyId },
        { status },
        tx,
      );

      // Toggle invoice schedules based on payroll status
      await tx.invoiceSchedule.updateMany({
        where: { payrollId: id },
        data: { isActive: status === PayrollStatusEnum.ACTIVE },
      });

      return updatedPayroll;
    });
  }

  /**
   * Calculate the next generate date based on pay start date (monthly)
   * This calculates when to generate the invoice (pay date minus generateDaysBefore)
   */
  private calculateNextGenerateDateFromPayStart(
    payStartDate: Date,
    generateDaysBefore: number,
  ): Date {
    const now = new Date();
    let nextPayDate: Date;

    // If the pay start date is in the future, use it. Otherwise, use same day next month.
    if (payStartDate > now) {
      nextPayDate = new Date(payStartDate);
    } else {
      nextPayDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        payStartDate.getDate(),
      );
    }

    // Generate invoice X days before the pay date
    const generateDate = new Date(nextPayDate);
    generateDate.setDate(generateDate.getDate() - generateDaysBefore);

    return generateDate;
  }
}
