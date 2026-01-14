import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PayrollModel } from '../../database/generated/models/Payroll';
import {
  ContractTermEnum,
  PayrollStatusEnum,
  Prisma,
  PrismaClient,
} from '../../database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from 'src/database/base.repository';

export interface CreatePayrollData {
  companyId: number;
  employeeId: number;
  network: any;
  token: any;
  amount: string;
  contractTerm: ContractTermEnum;
  contractDurationMonths: number;
  contractStartDate: Date;
  contractEndDate: Date;
  payDate: Date;
  note?: string;
  metadata?: any;
}

export interface UpdatePayrollData {
  network?: any;
  token?: any;
  amount?: string;
  contractTerm?: ContractTermEnum;
  contractDurationMonths?: number;
  contractStartDate?: Date;
  contractEndDate?: Date;
  payDate?: Date;
  note?: string;
  status?: PayrollStatusEnum;
  metadata?: any;
}

export interface PayrollFilters {
  companyId: number;
  employeeId?: number;
  contractTerm?: ContractTermEnum;
  status?: PayrollStatusEnum;
  search?: string;
}

export type PayrollWithInvoices = Prisma.PayrollGetPayload<{
  include: {
    employee: {
      include: {
        group: true;
      };
    };
    company: true;
    invoices: {
      orderBy: {
        createdAt: 'desc';
      };
    };
  };
}>;

@Injectable()
export class PayrollRepository extends BaseRepository<
  PayrollModel,
  Prisma.PayrollWhereInput,
  Prisma.PayrollCreateInput,
  Prisma.PayrollUpdateInput
> {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(tx?: PrismaTransactionClient): PrismaClient['payroll'] {
    return tx ? tx.payroll : this.prisma.payroll;
  }

  protected getModelName(): string {
    return 'Payroll';
  }

  async findById(
    id: number,
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<PayrollWithInvoices | null> {
    const client = this.getModel(tx);
    return client.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        employee: {
          include: {
            group: true,
          },
        },
        company: true,
        invoices: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            bill: true,
          },
        },
      },
    });
  }

  async getStats(
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<{
    totalActive: number;
    totalPaused: number;
    totalCompleted: number;
    totalMonthlyAmount: string;
    dueThisMonth: number;
  }> {
    const client = this.getModel(tx);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Exclude deleted payrolls from stats
    const baseWhere = {
      companyId,
      status: { not: PayrollStatusEnum.DELETED },
    };

    const [
      activePayrolls,
      pausedPayrolls,
      completedPayrolls,
      dueThisMonth,
      allActivePayrolls,
    ] = await Promise.all([
      client.count({
        where: { ...baseWhere, status: PayrollStatusEnum.ACTIVE },
      }),
      client.count({
        where: { ...baseWhere, status: PayrollStatusEnum.PAUSED },
      }),
      client.count({
        where: { ...baseWhere, status: PayrollStatusEnum.COMPLETED },
      }),
      client.count({
        where: {
          ...baseWhere,
          status: PayrollStatusEnum.ACTIVE,
          payStartDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      client.findMany({
        where: { ...baseWhere, status: PayrollStatusEnum.ACTIVE },
        select: { amount: true },
      }),
    ]);

    // Calculate total monthly amount
    const totalMonthlyAmount = allActivePayrolls
      .reduce((sum, payroll) => sum + parseFloat(payroll.amount), 0)
      .toFixed(2);

    return {
      totalActive: activePayrolls,
      totalPaused: pausedPayrolls,
      totalCompleted: completedPayrolls,
      totalMonthlyAmount,
      dueThisMonth,
    };
  }

  async findDuePayrolls(
    date: Date,
    tx?: PrismaTransactionClient,
  ): Promise<PayrollModel[]> {
    const model = this.getModel(tx);

    return model.findMany({
      where: {
        status: PayrollStatusEnum.ACTIVE,
        payStartDate: {
          lte: date,
        },
        // Note: DELETED payrolls are already excluded since we're filtering by ACTIVE status
      },
      include: {
        employee: {
          include: {
            group: true,
          },
        },
        company: true,
      },
    });
  }

  async findByEmployeeId(
    employeeId: number,
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<PayrollModel[]> {
    const model = this.getModel(tx);

    return model.findMany({
      where: {
        employeeId,
        companyId,
        // Exclude deleted payrolls
        status: {
          not: PayrollStatusEnum.DELETED,
        },
      },
      include: {
        employee: {
          include: {
            group: true,
          },
        },
        company: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
