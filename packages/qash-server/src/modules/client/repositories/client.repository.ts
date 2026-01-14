import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Client, Prisma, PrismaClient } from 'src/database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from '../../../database/base.repository';

@Injectable()
export class ClientRepository extends BaseRepository<
  Client,
  Prisma.ClientWhereInput,
  Prisma.ClientCreateInput,
  Prisma.ClientUpdateInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(tx?: PrismaTransactionClient): PrismaClient['client'] {
    return tx ? tx.client : this.prisma.client.client;
  }

  protected getModelName(): string {
    return 'Client';
  }

  /**
   * Find client by UUID with company access check
   */
  async findByUUID(
    uuid: string,
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<Client | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: {
        uuid,
        companyId,
      },
    });
  }

  /**
   * Find client by ID with company access check
   */
  async findByIdWithCompany(
    id: number,
    companyId: number,
    tx?: PrismaTransactionClient,
  ): Promise<Client | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: {
        id,
        companyId,
      },
    });
  }
}
