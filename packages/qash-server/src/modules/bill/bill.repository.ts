import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BillModel } from '../../database/generated/models/Bill';
import {
  BillStatusEnum,
  Prisma,
  PrismaClient,
} from '../../database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from 'src/database/base.repository';

export type BillWithInvoice = Prisma.BillGetPayload<{
  include: {
    invoice: {
      include: {
        employee: {
          include: {
            group: true;
          };
        };
        payroll: {
          include: {
            company: true;
          };
        };
        items: true;
      };
    };
  };
}>;

export interface CreateBillData {
  companyId: number;
  invoiceId: number;
  metadata?: any;
}

export interface UpdateBillData {
  status?: BillStatusEnum;
  paidAt?: Date;
  transactionHash?: string;
  confirmedAt?: Date;
  metadata?: any;
}

export interface BillFilters {
  companyId: number;
  status?: BillStatusEnum;
  groupId?: number;
  search?: string;
}

@Injectable()
export class BillRepository extends BaseRepository<
  BillModel,
  Prisma.BillWhereInput,
  Prisma.BillCreateInput,
  Prisma.BillUpdateInput
> {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(tx?: PrismaTransactionClient): PrismaClient['bill'] {
    return tx ? tx.bill : this.prisma.bill;
  }

  protected getModelName(): string {
    return 'Bill';
  }

  /**
   * Find a bill by id and company with invoice relation included
   */
  async findByUUIDWithInvoice(
    uuid: string,
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<BillWithInvoice | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: { uuid, companyId },
      include: {
        invoice: {
          include: {
            employee: {
              include: {
                group: true,
              },
            },
            payroll: {
              include: {
                company: true,
              },
            },
            items: true,
          },
        },
        company: true,
      },
    });
  }

  async getStats(
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<{
    totalBills: number;
    totalPending: number;
    totalPaid: number;
    totalOverdue: number;
    totalAmount: string;
    pendingAmount: string;
    paidAmount: string;
    overdueAmount: string;
  }> {
    const model = this.getModel(tx);
    const baseWhere = { companyId };

    const [
      totalBills,
      pendingBills,
      paidBills,
      overdueBills,
      allBills,
      pendingBillsWithAmount,
      paidBillsWithAmount,
      overdueBillsWithAmount,
    ] = await Promise.all([
      model.count({ where: baseWhere }),
      model.count({
        where: { ...baseWhere, status: BillStatusEnum.PENDING },
      }),
      model.count({
        where: { ...baseWhere, status: BillStatusEnum.PAID },
      }),
      model.count({
        where: {
          ...baseWhere,
          status: BillStatusEnum.OVERDUE,
        },
      }),
      model.findMany({
        where: baseWhere,
        include: {
          invoice: {
            select: { total: true },
          },
        },
      }),
      model.findMany({
        where: { ...baseWhere, status: BillStatusEnum.PENDING },
        include: {
          invoice: {
            select: { total: true },
          },
        },
      }),
      model.findMany({
        where: { ...baseWhere, status: BillStatusEnum.PAID },
        include: {
          invoice: {
            select: { total: true },
          },
        },
      }),
      model.findMany({
        where: { ...baseWhere, status: BillStatusEnum.OVERDUE },
        include: {
          invoice: {
            select: { total: true },
          },
        },
      }),
    ]);

    // Calculate amounts
    const totalAmount = allBills
      .reduce((sum, bill) => sum + parseFloat(bill.invoice.total), 0)
      .toFixed(2);

    const pendingAmount = pendingBillsWithAmount
      .reduce((sum, bill) => sum + parseFloat(bill.invoice.total), 0)
      .toFixed(2);

    const paidAmount = paidBillsWithAmount
      .reduce((sum, bill) => sum + parseFloat(bill.invoice.total), 0)
      .toFixed(2);

    const overdueAmount = overdueBillsWithAmount
      .reduce((sum, bill) => sum + parseFloat(bill.invoice.total), 0)
      .toFixed(2);

    return {
      totalBills,
      totalPending: pendingBills,
      totalPaid: paidBills,
      totalOverdue: overdueBills,
      totalAmount,
      pendingAmount,
      paidAmount,
      overdueAmount,
    };
  }

  async updateMultiple(
    uuids: string[],
    companyId: number,
    data: UpdateBillData,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    const model = this.getModel(tx);

    const result = await model.updateMany({
      where: {
        uuid: { in: uuids },
        companyId,
      },
      data,
    });

    return result.count;
  }

  async findOverdueBills(
    date?: Date,
    tx?: PrismaTransactionClient,
  ): Promise<BillModel[]> {
    const model = this.getModel(tx);
    const overdueDate = date || new Date();

    return model.findMany({
      where: {
        status: BillStatusEnum.PENDING,
        invoice: {
          dueDate: {
            lt: overdueDate,
          },
        },
      },
      include: {
        company: true,
        invoice: {
          include: {
            payroll: {
              include: {
                employee: {
                  include: {
                    group: true,
                  },
                },
              },
            },
            employee: {
              include: {
                group: true,
              },
            },
          },
        },
      },
    });
  }

  async markOverdueBills(
    date?: Date,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    const model = this.getModel(tx);
    const overdueDate = date || new Date();

    const result = await model.updateMany({
      where: {
        status: BillStatusEnum.PENDING,
        invoice: {
          dueDate: {
            lt: overdueDate,
          },
        },
      },
      data: {
        status: BillStatusEnum.OVERDUE,
      },
    });

    return result.count;
  }
}
