import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  PaymentLink,
  PaymentLinkRecord,
  Prisma,
  PrismaClient,
  PaymentLinkStatusEnum,
} from 'src/database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from '../../database/base.repository';

@Injectable()
export class PaymentLinkRepository extends BaseRepository<
  PaymentLink,
  Prisma.PaymentLinkWhereInput,
  Prisma.PaymentLinkCreateInput,
  Prisma.PaymentLinkUpdateInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(
    tx?: PrismaTransactionClient,
  ): PrismaClient['paymentLink'] {
    return tx ? tx.paymentLink : this.prisma.paymentLink;
  }

  protected getModelName(): string {
    return 'PaymentLink';
  }

  /**
   * Find payment link by code
   */
  async findByCode(code: string): Promise<PaymentLink | null> {
    return this.findOne({ code });
  }

  /**
   * Find payment link by code with records included
   */
  async findByCodeWithRecords(
    code: string,
    tx?: PrismaTransactionClient,
  ): Promise<(PaymentLink & { records: PaymentLinkRecord[] }) | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: { code },
      include: { records: true, company: true },
    });
  }

  /**
   * Find payment link by code with company included (for public access, no records)
   */
  async findByCodeWithCompany(
    code: string,
    tx?: PrismaTransactionClient,
  ): Promise<(PaymentLink & { company: any }) | null> {
    const model = this.getModel(tx);
    return model.findFirst({
      where: { code },
      include: { company: true },
    });
  }

  /**
   * Find payment links by company ID
   */
  async findByCompanyId(
    companyId: number,
    options?: {
      skip?: number;
      take?: number;
      status?: PaymentLinkStatusEnum;
    },
  ): Promise<PaymentLink[]> {
    const where: Prisma.PaymentLinkWhereInput = { companyId };
    if (options?.status) where.status = options.status;

    return this.findMany(where, {
      skip: options?.skip,
      take: options?.take,
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Find payment links by company ID with records included
   */
  async findByCompanyIdWithRecords(
    companyId: number,
    options?: {
      skip?: number;
      take?: number;
      status?: PaymentLinkStatusEnum;
    },
    tx?: PrismaTransactionClient,
  ): Promise<(PaymentLink & { records: PaymentLinkRecord[] })[]> {
    const model = this.getModel(tx);
    const where: Prisma.PaymentLinkWhereInput = { companyId };
    if (options?.status) where.status = options.status;

    return model.findMany({
      where,
      include: { records: true },
      skip: options?.skip,
      take: options?.take,
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Update payment link status
   */
  async updateStatus(
    code: string,
    status: PaymentLinkStatusEnum,
  ): Promise<PaymentLink> {
    return this.update({ code }, { status });
  }

  /**
   * Count payment links by company ID
   */
  async countByCompanyId(companyId: number): Promise<number> {
    return this.count({ companyId });
  }

  /**
   * Count active payment links by company ID
   */
  async countActiveByCompanyId(companyId: number): Promise<number> {
    return this.count({
      companyId,
      status: PaymentLinkStatusEnum.ACTIVE,
    });
  }

  /**
   * Delete payment link by code
   * This method handles cascade deletion of related records
   */
  async deleteByCode(
    code: string,
    tx?: PrismaTransactionClient,
  ): Promise<PaymentLink> {
    const client = tx || this.prisma;
    // First, delete all related PaymentLinkRecord entries
    await client.paymentLinkRecord.deleteMany({
      where: {
        PaymentLink: {
          code: code,
        },
      },
    });

    // Then delete the PaymentLink entry
    return this.delete({ code }, tx);
  }

  /**
   * Delete multiple payment links by codes
   * This method handles cascade deletion of related records
   */
  async deleteByCodes(
    codes: string[],
    tx?: PrismaTransactionClient,
  ): Promise<{ count: number }> {
    const client = tx || this.prisma;
    // First, delete all related PaymentLinkRecord entries
    await client.paymentLinkRecord.deleteMany({
      where: {
        PaymentLink: {
          code: { in: codes },
        },
      },
    });

    // Then delete the PaymentLink entries
    return this.deleteMany({ code: { in: codes } }, tx);
  }

  /**
   * Find payment links by codes for ownership validation
   */
  async findByCodes(
    codes: string[],
    companyId: number,
  ): Promise<PaymentLink[]> {
    return this.findMany({
      code: { in: codes },
      companyId,
    });
  }

  /**
   * Update payment link order
   */
  async updateLinkOrder(
    companyId: number,
    linkIds: number[],
  ): Promise<PaymentLink[]> {
    const updates = linkIds.map((id, index) =>
      this.update({ id, companyId }, { order: index + 1 }),
    );

    await Promise.all(updates);

    // Return updated links in the new order
    return this.findMany(
      {
        companyId,
        id: { in: linkIds },
      },
      {
        orderBy: { order: 'asc' },
      },
    );
  }
}

@Injectable()
export class PaymentLinkRecordRepository extends BaseRepository<
  PaymentLinkRecord,
  Prisma.PaymentLinkRecordWhereInput,
  Prisma.PaymentLinkRecordCreateInput,
  Prisma.PaymentLinkRecordUpdateInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(
    tx?: PrismaTransactionClient,
  ): PrismaClient['paymentLinkRecord'] {
    return tx ? tx.paymentLinkRecord : this.prisma.paymentLinkRecord;
  }

  protected getModelName(): string {
    return 'PaymentLinkRecord';
  }

  /**
   * Create a payment record
   */
  async createRecord(
    data: Prisma.PaymentLinkRecordCreateInput,
    tx?: PrismaTransactionClient,
  ): Promise<PaymentLinkRecord> {
    const model = this.getModel(tx);
    const now = new Date();
    return model.create({
      data: {
        ...data,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  /**
   * Find records by payment link ID
   */
  async findByPaymentLinkId(
    paymentLinkId: number,
    tx?: PrismaTransactionClient,
  ): Promise<PaymentLinkRecord[]> {
    return this.findMany(
      { paymentLinkId },
      {
        orderBy: { createdAt: 'desc' },
      },
      tx,
    );
  }

  /**
   * Find record by ID
   */
  async findById(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<PaymentLinkRecord | null> {
    return this.findOne({ id }, tx);
  }

  /**
   * Update record with txid
   */
  async updateTxid(
    id: number,
    txid: string,
    tx?: PrismaTransactionClient,
  ): Promise<PaymentLinkRecord> {
    return this.update(
      { id },
      {
        txid,
        updatedAt: new Date(),
      },
      tx,
    );
  }

  /**
   * Count records for a payment link
   */
  async countByPaymentLinkId(
    paymentLinkId: number,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    return this.count({ paymentLinkId }, tx);
  }

  /**
   * Count records with txid (completed payments)
   */
  async countCompletedByPaymentLinkId(
    paymentLinkId: number,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    return this.count(
      {
        paymentLinkId,
        txid: { not: null },
      },
      tx,
    );
  }
}
