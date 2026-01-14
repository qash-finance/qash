import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  InvoiceRepository,
  InvoiceWithRelations,
} from '../repositories/invoice.repository';
import { InvoiceItemService } from './invoice-item.service';
import { PayrollRepository } from '../../payroll/payroll.repository';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceQueryDto,
  InvoiceStatsDto,
} from '../invoice.dto';
import {
  InvoiceCreateInput,
  InvoiceModel,
  InvoiceUpdateInput,
  InvoiceWhereInput,
} from 'src/database/generated/models';
import {
  InvoiceStatusEnum,
  InvoiceTypeEnum,
} from 'src/database/generated/client';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from '../../mail/mail.service';
import { JsonValue } from '@prisma/client/runtime/client';
import { ErrorInvoice, ErrorPayroll } from 'src/common/constants/errors';
import { Currency } from 'src/common/constants/currency';
import { handleError } from 'src/common/utils/errors';
import { PrismaTransactionClient } from 'src/database/base.repository';
import { EmployeeRepository } from 'src/modules/employee/repositories/employee.repository';
import { BillService } from 'src/modules/bill/bill.service';
import { TeamMemberRepository } from 'src/modules/team-member/team-member.repository';
import { TokenDto } from 'src/modules/employee/employee.dto';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly invoiceItemService: InvoiceItemService,
    private readonly billService: BillService,
    private readonly employeeRepository: EmployeeRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly payrollRepository: PayrollRepository,
    private readonly teamMemberRepository: TeamMemberRepository,
  ) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************
  /**
   * Get invoices (for company dashboard)
   */
  async getInvoices(
    companyId: number,
    query: InvoiceQueryDto,
  ): Promise<{
    invoices: InvoiceModel[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const filters: InvoiceWhereInput = {
        toCompanyId: companyId,
        payrollId: query.payrollId,
        status: query.status,
      };

      const result = await this.invoiceRepository.findManyPaginated(
        filters,
        {
          page: query.page || 1,
          limit: query.limit || 10,
          orderBy: { createdAt: 'desc' },
        },
        {
          include: {
            payroll: {},
            employee: true,
            fromCompany: true,
            toCompany: true,
          },
        },
      );

      return {
        invoices: result.data,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 10,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching invoices:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get invoices for employee (by email)
   */
  async getEmployeeInvoices(email: string): Promise<InvoiceModel[]> {
    try {
      return this.invoiceRepository.findByEmployeeEmail(email);
    } catch (error) {
      this.logger.error('Error fetching employee invoices:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get invoice by invoice uuid (for employee access)
   */
  async getInvoiceByUUID(invoiceUUID: string): Promise<InvoiceWithRelations> {
    try {
      const invoice = await this.invoiceRepository.findByUUID(invoiceUUID);

      if (!invoice) {
        throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
      }

      return invoice;
    } catch (error) {
      this.logger.error('Error fetching invoice by UUID:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(companyId: number): Promise<InvoiceStatsDto> {
    try {
      return this.invoiceRepository.getStats(companyId);
    } catch (error) {
      this.logger.error('Error fetching invoice stats:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get overdue invoices (for scheduled notifications)
   */
  async getOverdueInvoices(date?: Date): Promise<InvoiceModel[]> {
    try {
      const overdueDate = date || new Date();
      return this.invoiceRepository.findDueInvoices(overdueDate);
    } catch (error) {
      this.logger.error('Error fetching overdue invoices:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Mark invoices as overdue (called by scheduler)
   * Marks invoices that are past their due date and not yet paid or cancelled
   */
  async markInvoicesAsOverdue(date?: Date): Promise<number> {
    try {
      const overdueDate = date || new Date();
      return await this.invoiceRepository.markOverdueInvoices(overdueDate);
    } catch (error) {
      this.logger.error('Error marking invoices as overdue:', error);
      handleError(error, this.logger);
      return 0;
    }
  }

  /**
   * Find latest invoice for payroll (used by scheduler)
   */
  async findLatestInvoiceForPayroll(
    payrollId: number,
    tx?: any,
  ): Promise<InvoiceModel | null> {
    return this.invoiceRepository.findLatestInvoiceForPayroll(payrollId, tx);
  }
  //#endregion GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************
  /**
   * Create new invoice (usually called by scheduled job)
   */
  async createPayrollInvoice(
    dto: CreateInvoiceDto,
    companyId: number,
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Verify payroll exists
        const payroll = await this.payrollRepository.findById(
          dto.payrollId,
          companyId,
          tx,
        );

        if (!payroll) {
          throw new NotFoundException(ErrorPayroll.PayrollNotFound);
        }

        // Generate unique invoice number
        const invoiceNumber =
          await this.invoiceRepository.generatePayrollInvoiceNumber(
            payroll.id,
            payroll.employeeId,
            tx,
          );

        const invoiceData: InvoiceCreateInput = {
          invoiceType: InvoiceTypeEnum.EMPLOYEE,
          invoiceNumber,
          issueDate: new Date(),
          dueDate: new Date(dto.dueDate),
          payroll: {
            connect: {
              id: payroll.id,
            },
          },
          employee: {
            connect: {
              id: payroll.employeeId,
            },
          },
          toCompany: {
            connect: {
              id: companyId,
            },
          },
          emailTo: dto.billToDetails?.email || payroll.employee.email,
          emailCc: [],
          emailBcc: [],
          fromDetails: {
            name: payroll.employee.name,
            email: payroll.employee.email,
            address: payroll.employee.address,
            city: payroll.employee.city,
            country: payroll.employee.country,
            postalCode: payroll.employee.postalCode,
          },
          toDetails: {
            companyName: payroll.company.companyName,
            address1: payroll.company.address1,
            address2: payroll.company.address2,
            city: payroll.company.city,
            country: payroll.company.country,
            postalCode: payroll.company.postalCode,
            email: payroll.company.notificationEmail,
          },
          subtotal: dto.subtotal,
          taxRate: dto.taxRate,
          taxAmount: dto.taxAmount,
          discount: '0.00',
          total: dto.total,
          currency: dto.currency,
          metadata: dto.metadata,
          status: InvoiceStatusEnum.SENT,
          paymentNetwork: dto.network as unknown as JsonValue,
          paymentToken: dto.token as unknown as JsonValue,
          paymentWalletAddress: dto.walletAddress,
        };

        const invoice = await this.invoiceRepository.create(invoiceData, tx);

        return invoice;
      });
    } catch (error) {
      this.logger.error('Error creating payroll invoice:', error);
      handleError(error, this.logger);
    }
  }
  //#endregion POST METHODS

  /**
   * Generate invoice from payroll (automated process)
   */
  async generateInvoiceFromPayroll(
    payrollId: number,
    companyId: number,
    options?: {
      issueDate?: Date;
      dueDate?: Date;
      payDate?: Date; // The actual pay date (when employer must pay)
      isAutoGenerated?: boolean;
      autoGenerateFromPayrollId?: number;
    },
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        return this.generateInvoice(payrollId, companyId, tx, options);
      });
    } catch (error) {
      this.logger.error('Error generating invoice from payroll:', error);
      handleError(error, this.logger);
    }
  }

  //#region PATCH METHODS
  // *************************************************
  // **************** PATCH METHODS ******************
  // *************************************************
  /**
   * Update invoice (employee can update their details)
   */
  async updateInvoice(
    invoiceUUID: string,
    dto: UpdateInvoiceDto,
    employeeEmail?: string,
  ): Promise<void> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const invoice = await this.invoiceRepository.findByUUID(
            invoiceUUID,
            tx,
          );

          if (!invoice) {
            throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
          }

          // Verify they own this invoice
          if (employeeEmail && invoice.employee.email !== employeeEmail) {
            throw new ForbiddenException(ErrorInvoice.NotOwner);
          }

          // Only allow updates if invoice is in SENT or REVIEWED status
          const updatableStatuses: InvoiceStatusEnum[] = [
            InvoiceStatusEnum.SENT,
            InvoiceStatusEnum.REVIEWED,
          ];
          if (!updatableStatuses.includes(invoice.status)) {
            throw new BadRequestException(ErrorInvoice.InvoiceNotUpdatable);
          }

          // transform dto to InvoiceUpdateInput
          const { address, network, token, walletAddress } = dto;
          const updateData: InvoiceUpdateInput = {
            fromDetails: {
              ...(invoice.fromDetails as object),
              address,
            },
            paymentWalletAddress: walletAddress,
            paymentNetwork: network as unknown as JsonValue,
            paymentToken: token as unknown as JsonValue,
          };

          if (address) {
            // Means the employee is updating their address
            // We update employee table with the new address
            await this.employeeRepository.update(
              { id: invoice.employeeId },
              { address },
              tx,
            );
          }

          await this.invoiceRepository.update(
            { uuid: invoiceUUID },
            updateData,
            tx,
          );
        },
        {
          maxWait: 10000, // 10 seconds max wait for transaction to start
          timeout: 30000, // 30 seconds max execution time
        },
      );
    } catch (error) {
      this.logger.error('Error updating invoice:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Send invoice to employee
   */
  async sendInvoice(
    invoiceUUID: string,
    companyId: number,
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await this.invoiceRepository.findByUUID(
          invoiceUUID,
          tx,
        );

        if (!invoice) {
          throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
        }

        if (invoice.payroll.companyId !== companyId) {
          throw new ForbiddenException(ErrorInvoice.NotOwner);
        }

        if (invoice.status !== InvoiceStatusEnum.DRAFT) {
          throw new BadRequestException(ErrorInvoice.InvoiceNotSendable);
        }

        const updatedInvoice = await this.invoiceRepository.update(
          { uuid: invoiceUUID },
          {
            status: InvoiceStatusEnum.SENT,
            sentAt: new Date(),
          },
          tx,
        );

        // Calculate month string from invoice issue date
        const month = new Date(invoice.issueDate).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });

        // Send email to employee
        try {
          await this.mailService.sendInvoiceNotification(
            invoice.employee.email,
            invoice.invoiceNumber,
            invoice.uuid,
            invoice.dueDate,
            invoice.payroll.company.companyName,
            invoice.employee.name,
            invoice.total,
            month,
            (invoice.paymentToken as unknown as TokenDto).name,
          );
        } catch (emailError) {
          // TODO: Handle email error, should try again a few times
          this.logger.error(
            'Failed to send invoice notification email:',
            emailError,
          );
        }

        return updatedInvoice;
      });
    } catch (error) {
      this.logger.error('Error sending invoice:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Employee reviews invoice
   */
  async reviewInvoice(
    invoiceUUID: string,
    employeeEmail: string,
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await this.invoiceRepository.findByUUID(
          invoiceUUID,
          tx,
        );

        if (!invoice) {
          throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
        }

        if (invoice.employee.email !== employeeEmail) {
          throw new ForbiddenException(ErrorInvoice.NotOwner);
        }

        if (invoice.status !== InvoiceStatusEnum.SENT) {
          throw new BadRequestException(ErrorInvoice.InvoiceNotReviewable);
        }

        const updatedInvoice = await this.invoiceRepository.update(
          { uuid: invoiceUUID },
          {
            status: InvoiceStatusEnum.REVIEWED,
            reviewedAt: new Date(),
          },
          tx,
        );

        return updatedInvoice;
      });
    } catch (error) {
      this.logger.error('Error reviewing invoice:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Employee confirms invoice
   */
  async confirmInvoice(
    invoiceUUID: string,
    employeeEmail: string,
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await this.invoiceRepository.findByUUID(
          invoiceUUID,
          tx,
        );

        if (!invoice) {
          throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
        }

        if (invoice.employee.email !== employeeEmail) {
          throw new ForbiddenException(ErrorInvoice.NotOwner);
        }

        if (invoice.status !== InvoiceStatusEnum.SENT) {
          throw new BadRequestException(ErrorInvoice.InvoiceNotConfirmable);
        }

        const updatedInvoice = await this.invoiceRepository.update(
          { uuid: invoiceUUID },
          {
            status: InvoiceStatusEnum.CONFIRMED,
            confirmedAt: new Date(),
          },
          tx,
        );

        try {
          // Format dates as "Month Year" (e.g., "January 2024")
          const formatMonthYear = (date: Date): string => {
            return new Date(date).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            });
          };

          // Calculate dates for this specific invoice
          // Each invoice covers: work month (issueDate - 1 month) to pay month (issueDate month)
          // Example: If issueDate is July 2025, invoice is for June 2025 to July 2025
          // Cycle 1: June 2025 to July 2025
          // Cycle 2: July 2025 to August 2025
          // etc.

          // From date: one month before the invoice issue date (the work month)
          const fromDate = new Date(invoice.issueDate);
          fromDate.setMonth(fromDate.getMonth() - 1);
          fromDate.setDate(1); // Start of the work month

          // To date: the invoice issue date month (the pay month)
          const toDate = new Date(invoice.issueDate);
          toDate.setDate(1); // Start of the pay month

          const fromMonthYear = formatMonthYear(fromDate);
          const toMonthYear = formatMonthYear(toDate);

          // Find the only team member of the company
          const teamMember = await this.teamMemberRepository.findOnlyTeamMember(
            invoice.payroll.companyId,
          );

          await this.mailService.sendInvoiceConfirmationNotification(
            teamMember?.user?.email,
            invoice.invoiceNumber,
            invoice.payroll.company.companyName,
            invoice.employee.name,
            invoice.employee.email,
            fromMonthYear,
            toMonthYear,
          );

          // Create bill to company
          await this.billService.createBillFromInvoice(
            invoice.uuid,
            invoice.payroll.companyId,
            tx,
          );
        } catch (emailError) {
          this.logger.error('Failed to send confirmation email:', emailError);
        }

        return updatedInvoice;
      });
    } catch (error) {
      this.logger.error('Error confirming invoice:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(
    invoiceUUID: string,
    companyId: number,
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await this.invoiceRepository.findByUUID(
          invoiceUUID,
          tx,
        );

        if (!invoice) {
          throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
        }

        if (invoice.payroll.companyId !== companyId) {
          throw new ForbiddenException(ErrorInvoice.NotOwner);
        }

        const updatedInvoice = await this.invoiceRepository.update(
          { uuid: invoiceUUID },
          { status: InvoiceStatusEnum.CANCELLED },
          tx,
        );

        // update bill related invoice status to cancelled
        await this.billService.deleteBill(invoice.bill.uuid, companyId, tx);

        return updatedInvoice;
      });
    } catch (error) {
      this.logger.error('Error canceling invoice:', error);
      handleError(error, this.logger);
    }
  }
  //#region PATCH METHODS

  async generateInvoice(
    payrollId: number,
    companyId: number,
    tx: PrismaTransactionClient,
    options?: {
      issueDate?: Date;
      dueDate?: Date;
      payDate?: Date; // The actual pay date (when employer must pay)
      isAutoGenerated?: boolean;
      autoGenerateFromPayrollId?: number;
    },
  ): Promise<InvoiceModel> {
    const payroll = await this.payrollRepository.findById(
      payrollId,
      companyId,
      tx,
    );

    if (!payroll) {
      throw new NotFoundException(ErrorPayroll.PayrollNotFound);
    }

    // Check for duplicate in same month
    const latestInvoice =
      await this.invoiceRepository.findLatestInvoiceForPayroll(payrollId, tx);

    if (latestInvoice) {
      const now = options?.issueDate || new Date();
      const sameMonth =
        latestInvoice.issueDate.getUTCFullYear() === now.getUTCFullYear() &&
        latestInvoice.issueDate.getUTCMonth() === now.getUTCMonth();
      if (sameMonth) {
        throw new ConflictException(ErrorInvoice.InvoiceAlreadyExistsThisMonth);
      }
    }

    // Generate invoice number
    const invoiceNumber =
      await this.invoiceRepository.generatePayrollInvoiceNumber(
        payrollId,
        payroll.employeeId,
        tx,
      );

    // Calculate dates
    const issueDate = options?.issueDate || new Date();
    const dueDate =
      options?.dueDate ||
      (() => {
        const date = new Date(issueDate);
        date.setDate(date.getDate() + 30);
        return date;
      })();

    const fromDetails = {
      name: payroll.employee.name,
      email: payroll.employee.email,
      address: payroll.employee.address,
      city: payroll.employee.city,
      country: payroll.employee.country,
      postalCode: payroll.employee.postalCode,
    };

    // find the only team member of the company
    const teamMember = await this.teamMemberRepository.findOnlyTeamMember(
      payroll.companyId,
    );

    const toDetails = {
      companyName: payroll.company.companyName,
      address1: payroll.company.address1,
      address2: payroll.company.address2,
      city: payroll.company.city,
      country: payroll.company.country,
      postalCode: payroll.company.postalCode,
      email: teamMember?.user?.email, // TODO: should change to company notification email
    };

    // Calculate financials
    const taxRate = '0.00';
    const subtotal = payroll.amount;
    const taxAmount = '0.00';
    const discount = '0.00';
    const total = payroll.amount;

    // Create invoice
    const invoiceData: InvoiceCreateInput = {
      invoiceType: InvoiceTypeEnum.EMPLOYEE,
      invoiceNumber,
      issueDate,
      dueDate,
      payroll: { connect: { id: payrollId } },
      employee: { connect: { id: payroll.employeeId } },
      toCompany: { connect: { id: companyId } },
      emailTo: payroll.employee.email,
      emailCc: payroll.company.notificationEmail
        ? [payroll.company.notificationEmail]
        : [],
      emailBcc: [],
      fromDetails: fromDetails as any,
      toDetails: toDetails as any,
      subtotal,
      taxRate,
      taxAmount,
      discount,
      total,
      currency: Currency.USD,
      status: InvoiceStatusEnum.SENT,
      isAutoGenerated: options?.isAutoGenerated || false,
      autoGenerateFromPayrollId: options?.autoGenerateFromPayrollId,
      paymentNetwork: payroll.network as unknown as JsonValue,
      paymentToken: payroll.token as unknown as JsonValue,
      paymentWalletAddress: payroll.employee.walletAddress,
    };

    const invoice = await this.invoiceRepository.create(invoiceData, tx);

    // Increment current cycle number for the payroll (only for manual generation)
    // Auto-generated invoices have their cycle incremented by the scheduler service
    if (!options?.isAutoGenerated) {
      const updatedPayroll = await tx.payroll.findUnique({
        where: { id: payrollId },
        select: { currentCycleNumber: true, payrollCycle: true },
      });

      if (updatedPayroll) {
        const newCycleNumber = updatedPayroll.currentCycleNumber + 1;

        // Only increment if we haven't reached the cycle limit
        if (newCycleNumber <= updatedPayroll.payrollCycle) {
          await tx.payroll.update({
            where: { id: payrollId },
            data: { currentCycleNumber: newCycleNumber },
          });
        }
      }
    }

    // Paydate is start date + current cycle month
    const currentPayDate = new Date(payroll.payStartDate);
    currentPayDate.setMonth(
      currentPayDate.getMonth() + payroll.currentCycleNumber,
    );

    // Calculate previous pay date: current pay date - payroll cycle period
    // For monthly payroll (payrollCycle = 1), subtract 1 month
    const previousPayDate = new Date(currentPayDate);
    previousPayDate.setMonth(previousPayDate.getMonth() - 1);

    // Format dates in DD/MM/YYYY format
    const formatDateDDMMYYYY = (date: Date): string => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const periodStartFormatted = formatDateDDMMYYYY(previousPayDate);
    const periodEndFormatted = formatDateDDMMYYYY(currentPayDate);

    // Create invoice items with correct period dates
    await this.invoiceItemService.createItems(
      invoice.uuid,
      [
        {
          description: `${payroll.description} - (from ${periodStartFormatted} to ${periodEndFormatted})`,
          quantity: '1',
          unitPrice: payroll.amount,
          unit: 'month',
          taxRate: '0.00',
          discount: '0.00',
          order: 0,
        },
      ],
      tx,
    );

    return invoice;
  }
}
