import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InvoiceModel } from '../../../database/generated/models/Invoice';
import {
  InvoiceStatusEnum,
  InvoiceTypeEnum,
  Prisma,
  PrismaClient,
} from '../../../database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from 'src/database/base.repository';

export type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    payroll: {
      include: {
        company: true;
      };
    };
    employee: {
      include: {
        group: true;
      };
    };
    fromCompany: true;
    toCompany: true;
    items: true;
    bill: true;
  };
}>;

export interface CreateInvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  payrollId: number;
  employeeId: number;
  fromDetails: any;
  billToDetails: any;
  items: any;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  metadata?: any;
}

export interface UpdateInvoiceData {
  dueDate?: Date;
  fromDetails?: any;
  billToDetails?: any;
  items?: any;
  subtotal?: string;
  taxRate?: string;
  taxAmount?: string;
  total?: string;
  status?: InvoiceStatusEnum;
  sentAt?: Date;
  reviewedAt?: Date;
  confirmedAt?: Date;
  metadata?: any;
}

export interface InvoiceFilters {
  payrollId?: number;
  employeeId?: number;
  status?: InvoiceStatusEnum;
  search?: string;
  companyId?: number;
}

@Injectable()
export class InvoiceRepository extends BaseRepository<
  InvoiceModel,
  Prisma.InvoiceWhereInput,
  Prisma.InvoiceCreateInput,
  Prisma.InvoiceUpdateInput
> {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(tx?: PrismaTransactionClient): PrismaClient['invoice'] {
    return tx ? tx.invoice : this.prisma.invoice;
  }

  protected getModelName(): string {
    return 'Invoice';
  }

  async findByUUID(
    uuid: string,
    tx?: PrismaTransactionClient,
  ): Promise<InvoiceWithRelations | null> {
    const model = this.getModel(tx);
    return model.findUnique({
      where: { uuid },
      include: {
        payroll: {
          include: {
            company: true,
          },
        },
        employee: {
          include: {
            group: true,
          },
        },
        // B2B relations (for B2B invoices)
        fromCompany: true,
        toCompany: true,
        // Common relations
        items: true,
        bill: true,
      },
    });
  }

  async getStats(
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<{
    totalDraft: number;
    totalSent: number;
    totalReviewed: number;
    totalConfirmed: number;
    totalAmount: string;
    dueThisMonth: number;
  }> {
    const model = this.getModel(tx);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const baseWhere: Prisma.InvoiceWhereInput = {
      payroll: {
        companyId,
      },
    };

    const [
      draftCount,
      sentCount,
      reviewedCount,
      confirmedCount,
      dueThisMonth,
      allInvoices,
    ] = await Promise.all([
      model.count({
        where: { ...baseWhere, status: InvoiceStatusEnum.DRAFT },
      }),
      model.count({
        where: { ...baseWhere, status: InvoiceStatusEnum.SENT },
      }),
      model.count({
        where: { ...baseWhere, status: InvoiceStatusEnum.REVIEWED },
      }),
      model.count({
        where: { ...baseWhere, status: InvoiceStatusEnum.CONFIRMED },
      }),
      model.count({
        where: {
          ...baseWhere,
          dueDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      model.findMany({
        where: baseWhere,
        select: { total: true },
      }),
    ]);

    // Calculate total amount
    const totalAmount = allInvoices
      .reduce((sum, invoice) => sum + parseFloat(invoice.total), 0)
      .toFixed(2);

    return {
      totalDraft: draftCount,
      totalSent: sentCount,
      totalReviewed: reviewedCount,
      totalConfirmed: confirmedCount,
      totalAmount,
      dueThisMonth,
    };
  }

  async findDueInvoices(
    date: Date,
    tx?: PrismaTransactionClient,
  ): Promise<InvoiceModel[]> {
    const model = this.getModel(tx);

    return model.findMany({
      where: {
        status: {
          in: [
            InvoiceStatusEnum.SENT,
            InvoiceStatusEnum.REVIEWED,
            InvoiceStatusEnum.CONFIRMED,
            InvoiceStatusEnum.OVERDUE,
          ],
        },
        dueDate: {
          lte: date,
        },
      },
      include: {
        payroll: {
          include: {
            employee: {
              include: {
                group: true,
              },
            },
            company: true,
          },
        },
        employee: {
          include: {
            group: true,
          },
        },
      },
    });
  }

  async findByEmployeeEmail(
    email: string,
    tx?: PrismaTransactionClient,
  ): Promise<InvoiceModel[]> {
    const model = this.getModel(tx);

    return model.findMany({
      where: {
        employee: {
          email,
        },
      },
      include: {
        payroll: {
          include: {
            employee: {
              include: {
                group: true,
              },
            },
            company: true,
          },
        },
        employee: {
          include: {
            group: true,
          },
        },
        bill: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateMultiple(
    uuids: string[],
    status: InvoiceStatusEnum,
    paidAt: Date,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    const model = this.getModel(tx);

    const result = await model.updateMany({
      where: {
        uuid: { in: uuids },
      },
      data: {
        status,
        paidAt,
      },
    });

    return result.count;
  }

  /**
   * Generate an invoice number.
   * If payrollId is provided, sequence is per payroll (employee-centric).
   * Otherwise, fallback to monthly per-company sequence.
   */
  async generatePayrollInvoiceNumber(
    payrollId: number,
    employeeId: number,
    tx?: PrismaTransactionClient,
  ): Promise<string> {
    const model = this.getModel(tx);
    const count = await model.count({
      where: { payrollId, employeeId },
    });
    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${sequence}`;
  }

  /**
   * Find latest invoice for a payroll
   */
  async findLatestInvoiceForPayroll(
    payrollId: number,
    tx?: PrismaTransactionClient,
  ): Promise<InvoiceModel | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: { payrollId },
      orderBy: { issueDate: 'desc' },
    });
  }

  /**
   * Mark invoices as overdue
   * Marks invoices that are past their due date and not yet paid or cancelled
   */
  async markOverdueInvoices(
    date?: Date,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    const model = this.getModel(tx);
    const overdueDate = date || new Date();

    const result = await model.updateMany({
      where: {
        status: {
          in: [
            InvoiceStatusEnum.SENT,
            InvoiceStatusEnum.REVIEWED,
            InvoiceStatusEnum.CONFIRMED,
          ],
        },
        dueDate: {
          lt: overdueDate,
        },
      },
      data: {
        status: InvoiceStatusEnum.OVERDUE,
      },
    });

    return result.count;
  }

  // =============================================================================
  // B2B INVOICE METHODS
  // =============================================================================

  /**
   * Generate B2B invoice number
   * Format: INV-B2B-{0001}
   * Sequence increments per recipient company per month
   */
  async generateB2BInvoiceNumber(
    companyId: number,
    toCompanyId?: number | null,
    toCompanyName?: string | null,
    tx?: PrismaTransactionClient,
  ): Promise<string> {
    const model = this.getModel(tx);
    const prefix = `INV-B2B-`;

    // Build where clause: filter by sender company, month, and recipient
    const where: Prisma.InvoiceWhereInput = {
      fromCompanyId: companyId,
      invoiceType: InvoiceTypeEnum.B2B,
      invoiceNumber: {
        startsWith: prefix,
      },
    };

    // If recipient company is identified, filter by it
    if (toCompanyId) {
      where.toCompanyId = toCompanyId;
    } else if (toCompanyName) {
      where.toCompanyName = toCompanyName;
    }

    // Get the latest B2B invoice for this company and recipient in the current month
    const latestInvoice = await model.findFirst({
      where,
      orderBy: {
        invoiceNumber: 'desc',
      },
      select: {
        invoiceNumber: true,
      },
    });

    let sequence = 1;
    if (latestInvoice) {
      // Extract the sequence number from the invoice number
      const match = latestInvoice.invoiceNumber.match(/(\d{4})$/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Find B2B invoices by company with direction filter
   */
  async findB2BInvoicesByCompany(
    companyId: number,
    direction: 'sent' | 'received' | 'both',
    filters: {
      status?: InvoiceStatusEnum;
      currency?: string;
      search?: string;
    },
    pagination: { page: number; limit: number },
    tx?: PrismaTransactionClient,
  ): Promise<{
    invoices: InvoiceWithRelations[];
    total: number;
  }> {
    const model = this.getModel(tx);

    // Build direction filter
    let directionFilter: Prisma.InvoiceWhereInput = {};
    if (direction === 'sent') {
      directionFilter = { fromCompanyId: companyId };
    } else if (direction === 'received') {
      directionFilter = { toCompanyId: companyId };
    } else {
      directionFilter = {
        OR: [{ fromCompanyId: companyId }, { toCompanyId: companyId }],
      };
    }

    // Build where clause
    const where: Prisma.InvoiceWhereInput = {
      invoiceType: InvoiceTypeEnum.B2B,
      ...directionFilter,
      ...(filters.status && { status: filters.status }),
      ...(filters.currency && { currency: filters.currency }),
      ...(filters.search && {
        OR: [
          { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
          { toCompanyName: { contains: filters.search, mode: 'insensitive' } },
          {
            toCompany: {
              companyName: { contains: filters.search, mode: 'insensitive' },
            },
          },
          {
            fromCompany: {
              companyName: { contains: filters.search, mode: 'insensitive' },
            },
          },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      model.findMany({
        where,
        include: {
          payroll: {
            include: {
              company: true,
            },
          },
          employee: {
            include: {
              group: true,
            },
          },
          fromCompany: true,
          toCompany: true,
          items: true,
          bill: true,
        },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      model.count({ where }),
    ]);

    return { invoices, total };
  }

  /**
   * Get B2B invoice statistics for a company
   */
  async getB2BStats(
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<{
    sent: {
      totalDraft: number;
      totalSent: number;
      totalConfirmed: number;
      totalPaid: number;
      totalOverdue: number;
      totalAmount: string;
      totalAmountByCurrency: Record<string, string>;
    };
    received: {
      totalSent: number;
      totalConfirmed: number;
      totalPaid: number;
      totalOverdue: number;
      totalAmount: string;
      totalAmountByCurrency: Record<string, string>;
    };
  }> {
    const model = this.getModel(tx);

    const baseB2BWhere = { invoiceType: InvoiceTypeEnum.B2B };

    // Sent invoices stats
    const [
      sentDraft,
      sentSent,
      sentConfirmed,
      sentPaid,
      sentOverdue,
      sentInvoices,
    ] = await Promise.all([
      model.count({
        where: {
          ...baseB2BWhere,
          fromCompanyId: companyId,
          status: InvoiceStatusEnum.DRAFT,
        },
      }),
      model.count({
        where: {
          ...baseB2BWhere,
          fromCompanyId: companyId,
          status: InvoiceStatusEnum.SENT,
        },
      }),
      model.count({
        where: {
          ...baseB2BWhere,
          fromCompanyId: companyId,
          status: InvoiceStatusEnum.CONFIRMED,
        },
      }),
      model.count({
        where: {
          ...baseB2BWhere,
          fromCompanyId: companyId,
          status: InvoiceStatusEnum.PAID,
        },
      }),
      model.count({
        where: {
          ...baseB2BWhere,
          fromCompanyId: companyId,
          status: InvoiceStatusEnum.OVERDUE,
        },
      }),
      model.findMany({
        where: { ...baseB2BWhere, fromCompanyId: companyId },
        select: { total: true, currency: true },
      }),
    ]);

    // Received invoices stats
    const [
      receivedSent,
      receivedConfirmed,
      receivedPaid,
      receivedOverdue,
      receivedInvoices,
    ] = await Promise.all([
      model.count({
        where: {
          ...baseB2BWhere,
          toCompanyId: companyId,
          status: InvoiceStatusEnum.SENT,
        },
      }),
      model.count({
        where: {
          ...baseB2BWhere,
          toCompanyId: companyId,
          status: InvoiceStatusEnum.CONFIRMED,
        },
      }),
      model.count({
        where: {
          ...baseB2BWhere,
          toCompanyId: companyId,
          status: InvoiceStatusEnum.PAID,
        },
      }),
      model.count({
        where: {
          ...baseB2BWhere,
          toCompanyId: companyId,
          status: InvoiceStatusEnum.OVERDUE,
        },
      }),
      model.findMany({
        where: { ...baseB2BWhere, toCompanyId: companyId },
        select: { total: true, currency: true },
      }),
    ]);

    // Calculate totals by currency
    const calculateTotalsByCurrency = (
      invoices: { total: string; currency: string }[],
    ): {
      totalAmount: string;
      totalAmountByCurrency: Record<string, string>;
    } => {
      const byCurrency: Record<string, number> = {};
      let totalAmount = 0;

      for (const inv of invoices) {
        const amount = parseFloat(inv.total);
        totalAmount += amount;
        byCurrency[inv.currency] = (byCurrency[inv.currency] || 0) + amount;
      }

      const totalAmountByCurrency: Record<string, string> = {};
      for (const [currency, amount] of Object.entries(byCurrency)) {
        totalAmountByCurrency[currency] = amount.toFixed(2);
      }

      return {
        totalAmount: totalAmount.toFixed(2),
        totalAmountByCurrency,
      };
    };

    const sentTotals = calculateTotalsByCurrency(sentInvoices);
    const receivedTotals = calculateTotalsByCurrency(receivedInvoices);

    return {
      sent: {
        totalDraft: sentDraft,
        totalSent: sentSent,
        totalConfirmed: sentConfirmed,
        totalPaid: sentPaid,
        totalOverdue: sentOverdue,
        ...sentTotals,
      },
      received: {
        totalSent: receivedSent,
        totalConfirmed: receivedConfirmed,
        totalPaid: receivedPaid,
        totalOverdue: receivedOverdue,
        ...receivedTotals,
      },
    };
  }

  /**
   * Find B2B invoice by UUID with public access (no company filter)
   * Used for recipient confirmation via email link
   */
  async findB2BByUUIDPublic(
    uuid: string,
    tx?: PrismaTransactionClient,
  ): Promise<InvoiceWithRelations | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: {
        uuid,
        invoiceType: InvoiceTypeEnum.B2B,
      },
      include: {
        payroll: {
          include: {
            company: true,
          },
        },
        employee: {
          include: {
            group: true,
          },
        },
        fromCompany: true,
        toCompany: true,
        items: true,
        bill: true,
      },
    });
  }

  /**
   * Find B2B invoice by UUID with company access check
   */
  async findB2BByUUIDWithAccess(
    uuid: string,
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<InvoiceWithRelations | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: {
        uuid,
        invoiceType: InvoiceTypeEnum.B2B,
        OR: [{ fromCompanyId: companyId }, { toCompanyId: companyId }],
      },
      include: {
        payroll: {
          include: {
            company: true,
          },
        },
        employee: {
          include: {
            group: true,
          },
        },
        fromCompany: true,
        toCompany: true,
        items: true,
        bill: true,
      },
    });
  }
}
