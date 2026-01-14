import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { BillRepository, BillWithInvoice } from './bill.repository';
import { InvoiceRepository } from '../invoice/repositories/invoice.repository';
import { PdfService } from '../invoice/services/pdf.service';
import { MailService } from '../mail/mail.service';
import {
  BillQueryDto,
  BillStatsDto,
  PayBillsDto,
  BillTimelineDto,
  BatchPaymentResultDto,
} from './bill.dto';
import { BillCreateInput, BillModel } from 'src/database/generated/models';
import {
  BillStatusEnum,
  InvoiceStatusEnum,
  InvoiceTypeEnum,
} from 'src/database/generated/client';
import { handleError } from 'src/common/utils/errors';
import { PrismaService } from 'src/database/prisma.service';
import { PrismaTransactionClient } from 'src/database/base.repository';
import { ErrorBill, ErrorInvoice } from 'src/common/constants/errors';

@Injectable()
export class BillService {
  private readonly logger = new Logger(BillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billRepository: BillRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly pdfService: PdfService,
    private readonly mailService: MailService,
  ) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************
  /**
   * Get all bills with pagination and filters
   */
  async getBills(
    companyId: number,
    query: BillQueryDto,
  ): Promise<{
    bills: BillModel[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const filters = {
        companyId,
        status: query.status,
        groupId: query.groupId,
        search: query.search,
      };

      const result = await this.billRepository.findManyPaginated(
        filters,
        {
          page: query.page || 1,
          limit: query.limit || 10,
          orderBy: { createdAt: 'desc' },
        },
        {
          include: {
            invoice: {
              include: {
                employee: {
                  include: {
                    group: true,
                  },
                },
              },
            },
            company: true,
          },
        },
      );

      return {
        bills: result.data,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 10,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching bills:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get bill details with timeline
   */
  async getBillDetails(
    uuid: string,
    companyId: number,
  ): Promise<{
    bill: BillWithInvoice;
    timeline: BillTimelineDto[];
  }> {
    try {
      const bill = await this.billRepository.findByUUIDWithInvoice(
        uuid,
        companyId,
      );

      if (!bill) {
        throw new NotFoundException(ErrorBill.BillNotFound);
      }

      // Build timeline
      const timeline: BillTimelineDto[] = [];

      // Invoice created
      timeline.push({
        event: 'invoice_created',
        timestamp: bill.invoice.createdAt,
      });

      // Invoice sent
      if (bill.invoice.sentAt) {
        timeline.push({
          event: 'invoice_sent',
          timestamp: bill.invoice.sentAt,
        });
      }

      // Invoice confirmed
      if (bill.invoice.confirmedAt) {
        timeline.push({
          event: 'invoice_confirmed',
          timestamp: bill.invoice.confirmedAt,
        });
      }

      // Bill created
      if (bill.createdAt) {
        timeline.push({
          event: 'bill_created',
          timestamp: bill.createdAt,
        });
      }

      // Bill paid
      if (bill.paidAt) {
        timeline.push({
          event: 'bill_paid',
          timestamp: bill.paidAt,
        });
      }

      // Sort timeline by timestamp
      timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      return {
        bill: bill,
        timeline: timeline,
      };
    } catch (error) {
      this.logger.error(`Error fetching bill details ${uuid}:`, error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get overdue bills (for notifications)
   */
  async getOverdueBills(date?: Date): Promise<BillModel[]> {
    try {
      const overdueDate = date || new Date();
      return await this.billRepository.findOverdueBills(overdueDate);
    } catch (error) {
      this.logger.error('Error fetching overdue bills:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get bill statistics
   */
  async getBillStats(companyId: number): Promise<BillStatsDto> {
    try {
      return await this.billRepository.getStats(companyId);
    } catch (error) {
      this.logger.error('Error fetching bill stats:', error);
      handleError(error, this.logger);
    }
  }
  //#endregion GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************

  /**
   * Create bill from confirmed invoice
   */
  async createBillFromInvoice(
    invoiceUUID: string,
    companyId: number,
    tx: PrismaTransactionClient,
  ): Promise<BillModel> {
    // Verify invoice exists and is confirmed
    const invoice = await this.invoiceRepository.findByUUID(invoiceUUID, tx);

    if (!invoice) {
      throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
    }

    if (invoice.payroll.companyId !== companyId) {
      throw new BadRequestException(ErrorInvoice.InvoiceNotBelongsToCompany);
    }

    if (invoice.status !== InvoiceStatusEnum.CONFIRMED) {
      throw new BadRequestException(ErrorInvoice.InvoiceNotConfirmed);
    }

    // Check if bill already exists for this invoice
    if (invoice.bill) {
      throw new ConflictException(ErrorBill.BillAlreadyExists);
    }

    const billData: BillCreateInput = {
      company: {
        connect: {
          id: companyId,
        },
      },
      invoice: {
        connect: {
          uuid: invoiceUUID,
        },
      },
      status: BillStatusEnum.PENDING,
      metadata: {},
    };

    const bill = await this.billRepository.create(billData, tx);

    return bill;
  }

  /**
   * Create bill from B2B invoice (for company-to-company invoices)
   * Bill is created in the RECIPIENT company (the company that owes money)
   */
  async createBillFromB2BInvoice(
    invoiceUUID: string,
    companyId: number,
    tx: PrismaTransactionClient,
  ): Promise<BillModel> {
    // Verify invoice exists
    const invoice = await this.invoiceRepository.findByUUID(invoiceUUID, tx);

    if (!invoice) {
      throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
    }

    // Check if bill already exists for this invoice
    if (invoice.bill) {
      throw new ConflictException(ErrorBill.BillAlreadyExists);
    }

    // For B2B invoices, the bill should be created in the recipient company
    // Validate that either:
    // 1. The invoice has a toCompanyId that matches, OR
    // 2. Allow bill creation in any company (for flexibility with unregistered recipients)
    if (invoice.toCompanyId && invoice.toCompanyId !== companyId) {
      throw new BadRequestException(
        'This invoice is not addressed to this company',
      );
    }

    const billData: BillCreateInput = {
      company: {
        connect: {
          id: companyId,
        },
      },
      invoice: {
        connect: {
          uuid: invoiceUUID,
        },
      },
      status: BillStatusEnum.PENDING,
      metadata: {
        invoiceType: 'B2B',
        fromCompanyName: invoice.fromCompany?.companyName,
        toCompanyName: invoice.toCompanyName,
      },
    };

    const bill = await this.billRepository.create(billData, tx);

    return bill;
  }
  async payBills(
    companyId: number,
    dto: PayBillsDto,
  ): Promise<BatchPaymentResultDto> {
    // Store bills for sending emails after transaction
    let billsWithInvoices: BillWithInvoice[] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      // Fetch all bills to validate with invoice and employee included
      const bills = (await this.billRepository.findMany(
        {
          uuid: { in: dto.billUUIDs.map((uuid) => uuid.toString()) },
          companyId,
        },
        {
          include: {
            invoice: {
              include: {
                employee: true,
                payroll: {
                  include: {
                    company: true,
                  },
                },
                items: true,
              },
            },
          },
        },
        tx,
      )) as BillWithInvoice[];

      // Store for later use
      billsWithInvoices = bills;

      const foundBillIds = bills.map((bill) => bill.uuid);
      const notFoundBillIds = dto.billUUIDs.filter(
        (uuid) => !foundBillIds.includes(uuid.toString()),
      );

      if (notFoundBillIds.length > 0) {
        throw new NotFoundException(ErrorBill.BillsNotFoundOrNotPayable);
      }

      // Calculate total amount
      const totalAmount = bills
        .reduce((sum, bill) => sum + parseFloat(bill.invoice.total), 0)
        .toFixed(2);

      const paidAt = new Date();

      // Update all bills to paid status
      await this.billRepository.updateMultiple(
        dto.billUUIDs.map((uuid) => uuid.toString()),
        companyId,
        {
          status: BillStatusEnum.PAID,
          paidAt,
          transactionHash: dto.transactionHash,
        },
        tx,
      );

      // Update invoice status to paid
      await this.invoiceRepository.updateMultiple(
        bills.map((bill) => bill.invoice.uuid.toString()),
        InvoiceStatusEnum.PAID,
        paidAt,
        tx,
      );

      // For B2B invoices, log the payment relationship
      // The invoice being updated is the B2B invoice sent by fromCompany to toCompany
      // Paying the bill (by toCompany) also marks the invoice as paid (for fromCompany)
      for (const bill of bills) {
        if (bill.invoice.invoiceType === InvoiceTypeEnum.B2B) {
          this.logger.log(
            `B2B Invoice Payment: ${bill.invoice.invoiceNumber} - Paid by receiving company (ID: ${companyId}), Updated for sending company (ID: ${bill.invoice.fromCompanyId})`,
          );
        }
      }

      return {
        totalAmount,
      };
    }, {
      timeout: 60000, // 60 seconds timeout for transaction
    });

    // After successful transaction, send payslip emails for employee invoices
    // This is done outside the transaction to avoid blocking it
    await this.sendPayslipEmails(billsWithInvoices);
    
    return result;
  }

  /**
   * Send payslip emails to employees for their paid invoices
   */
  private async sendPayslipEmails(bills: BillWithInvoice[]): Promise<void> {
    const emailPromises = bills
      .filter((bill) => {
        const invoice = bill.invoice as any;
        // Only send payslips for employee payroll invoices (not B2B)
        return (
          invoice.invoiceType === InvoiceTypeEnum.EMPLOYEE &&
          invoice.employee &&
          invoice.employee.email
        );
      })
      .map(async (bill) => {
        try {
          const invoice = bill.invoice;
          const employee = invoice.employee;
          const company = invoice.payroll?.company;

          // Generate payslip PDF
          const pdfBuffer = await this.pdfService.generatePayslipPdf(invoice);
          const pdfFilename = this.pdfService.getPayslipFilename(invoice);

          // Format pay period
          const issueDate = new Date(invoice.issueDate);
          const payPeriod = issueDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
          });

          // Send email with PDF attachment
          await this.mailService.sendPayslipEmail(
            employee.email,
            `${employee.name}`,
            company?.companyName || 'Your Company',
            payPeriod,
            invoice.total,
            invoice.currency,
            pdfBuffer,
            pdfFilename,
          );

          this.logger.log(
            `Payslip email sent to ${employee.email} for invoice ${invoice.invoiceNumber}`,
          );
        } catch (error) {
          // Log error but don't fail the entire operation
          this.logger.error(
            `Failed to send payslip email for bill ${bill.uuid}:`,
            error,
          );
        }
      });

    // Wait for all emails to be sent
    await Promise.allSettled(emailPromises);
  }

  /**
   * Mark overdue bills (scheduled job)
   */
  async markOverdueBills(date?: Date): Promise<number> {
    try {
      const overdueDate = date || new Date();
      const count = await this.billRepository.markOverdueBills(overdueDate);

      return count;
    } catch (error) {
      this.logger.error('Error marking overdue bills:', error);
      handleError(error, this.logger);
    }
  }

  //#endregion POST METHODS

  //#region PUT METHODS
  // *************************************************
  // **************** PUT METHODS *******************
  // *************************************************

  /**
   * Update bill status manually
   */
  async updateBillStatus(
    id: number,
    companyId: number,
    status: BillStatusEnum,
  ): Promise<BillModel> {
    return await this.prisma.$transaction(async (tx) => {
      const bill = await this.billRepository.findOne({ id, companyId }, tx);

      if (!bill) {
        throw new NotFoundException(ErrorBill.BillNotFound);
      }

      const updateData: any = { status };

      // If marking as paid, set paidAt
      if (status === BillStatusEnum.PAID && !bill.paidAt) {
        updateData.paidAt = new Date();
      }

      const updatedBill = await this.billRepository.update(
        { id, companyId },
        updateData,
        tx,
      );

      return updatedBill;
    });
  }

  //#endregion PUT METHODS

  //#region DELETE METHODS
  // *************************************************
  // **************** DELETE METHODS ****************
  // *************************************************
  /**
   * Delete bill
   */
  async deleteBill(
    uuid: string,
    companyId: number,
    tx: PrismaTransactionClient,
  ): Promise<void> {
    const bill = await this.billRepository.findByUUIDWithInvoice(
      uuid,
      companyId,
      tx,
    );

    if (!bill) {
      throw new NotFoundException(ErrorBill.BillNotFound);
    }

    if (bill.status === BillStatusEnum.PAID) {
      throw new BadRequestException(ErrorBill.CannotDeletePaidBills);
    }

    // update bill sattus to cancelled
    await this.billRepository.update(
      { uuid, companyId },
      { status: BillStatusEnum.CANCELLED },
      tx,
    );
  }
  //#endregion DELETE METHODS
}
