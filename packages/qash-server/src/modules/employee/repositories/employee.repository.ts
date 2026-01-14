import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Employee, Prisma, PrismaClient } from 'src/database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from '../../../database/base.repository';

@Injectable()
export class EmployeeRepository extends BaseRepository<
  Employee,
  Prisma.EmployeeWhereInput,
  Prisma.EmployeeCreateInput,
  Prisma.EmployeeUpdateInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(tx?: PrismaTransactionClient): PrismaClient['employee'] {
    return tx ? tx.employee : this.prisma.employee;
  }

  protected getModelName(): string {
    return 'Employee';
  }

  // /**
  //  * Get next order value for category
  //  */
  async getNextOrderForGroup(
    companyId: number,
    groupId: number,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    const model = this.getModel(tx);

    const lastEntry = await model.findFirst({
      where: {
        companyId,
        groupId,
      },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return (lastEntry?.order || 0) + 1;
  }
}
