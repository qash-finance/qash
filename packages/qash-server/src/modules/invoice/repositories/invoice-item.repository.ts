import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma, PrismaClient } from '../../../database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from 'src/database/base.repository';
import { ErrorInvoice } from 'src/common/constants/errors';

export interface CreateInvoiceItemData {
  invoiceUuid: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unit?: string;
  taxRate?: string;
  discount?: string;
  total: string;
  order?: number;
  metadata?: any;
}

export interface UpdateInvoiceItemData {
  description?: string;
  quantity?: string;
  unitPrice?: string;
  unit?: string;
  taxRate?: string;
  discount?: string;
  total?: string;
  order?: number;
  metadata?: any;
}

@Injectable()
export class InvoiceItemRepository extends BaseRepository<
  any,
  Prisma.InvoiceItemWhereInput,
  Prisma.InvoiceItemCreateInput,
  Prisma.InvoiceItemUpdateInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(
    tx?: PrismaTransactionClient,
  ): PrismaClient['invoiceItem'] {
    return tx ? tx.invoiceItem : this.prisma.invoiceItem;
  }

  protected getModelName(): string {
    return 'InvoiceItem';
  }

  private async resolveInvoiceId(
    invoiceUuid: string,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    const invoiceModel = tx ? tx.invoice : this.prisma.invoice;
    const invoice = await invoiceModel.findUnique({
      where: { uuid: invoiceUuid },
      select: { id: true },
    });
    if (!invoice) {
      throw new Error(ErrorInvoice.InvoiceNotFound);
    }
    return invoice.id;
  }

  /**
   * Create a single invoice item
   */
  async createItem(
    data: CreateInvoiceItemData,
    tx?: PrismaTransactionClient,
  ): Promise<any> {
    const model = this.getModel(tx);
    const invoiceId = await this.resolveInvoiceId(data.invoiceUuid, tx);
    return model.create({
      data: {
        invoiceId,
        description: data.description,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        unit: data.unit,
        taxRate: data.taxRate || '0.00',
        discount: data.discount || '0.00',
        total: data.total,
        order: data.order ?? 0,
        metadata: data.metadata,
      },
    });
  }

  /**
   * Create multiple invoice items in batch
   */
  async createItems(
    items: CreateInvoiceItemData[],
    tx: PrismaTransactionClient,
  ): Promise<void> {
    const model = this.getModel(tx);
    if (items.length === 0) return;
    // Assume all items share the same invoice uuid
    const invoiceId = await this.resolveInvoiceId(items[0].invoiceUuid, tx);
    await model.createMany({
      data: items.map((item, index) => ({
        invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unit: item.unit,
        taxRate: item.taxRate || '0.00',
        discount: item.discount || '0.00',
        total: item.total,
        order: item.order ?? index,
        metadata: item.metadata,
      })),
    });
  }

  /**
   * Find invoice item by ID
   */
  async findById(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<any | null> {
    const model = this.getModel(tx);
    return model.findUnique({
      where: { id },
      include: {
        invoice: true,
      },
    });
  }

  /**
   * Find all items for an invoice
   */
  async findByInvoiceUuid(
    invoiceUUID: string,
    tx?: PrismaTransactionClient,
  ): Promise<any[]> {
    const model = this.getModel(tx);
    return model.findMany({
      where: { invoice: { uuid: invoiceUUID } },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Update invoice item
   */
  async updateItem(
    id: number,
    data: UpdateInvoiceItemData,
    tx?: PrismaTransactionClient,
  ): Promise<any> {
    const model = this.getModel(tx);
    return model.update({
      where: { id },
      data,
    });
  }

  /**
   * Update multiple invoice items
   */
  async updateItems(
    updates: Array<{ id: number; data: UpdateInvoiceItemData }>,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const model = this.getModel(tx);
    await Promise.all(
      updates.map(({ id, data }) =>
        model.update({
          where: { id },
          data,
        }),
      ),
    );
  }

  /**
   * Delete invoice item
   */
  async deleteItem(id: number, tx?: PrismaTransactionClient): Promise<void> {
    const model = this.getModel(tx);
    await model.delete({
      where: { id },
    });
  }

  /**
   * Delete all items for an invoice
   */
  async deleteByInvoiceId(
    invoiceUuid: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const model = this.getModel(tx);
    const invoiceId = await this.resolveInvoiceId(invoiceUuid, tx);
    await model.deleteMany({
      where: { invoiceId },
    });
  }

  /**
   * Reorder items for an invoice
   */
  async reorder(
    invoiceUuid: string,
    itemOrders: Array<{ id: number; order: number }>,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const model = this.getModel(tx);
    await this.resolveInvoiceId(invoiceUuid, tx); // ensure invoice exists
    await Promise.all(
      itemOrders.map(({ id, order }) =>
        model.update({
          where: { id },
          data: { order },
        }),
      ),
    );
  }

  /**
   * Calculate totals for invoice items
   */
  async calculateTotals(
    invoiceUuid: string,
    tx?: PrismaTransactionClient,
  ): Promise<{
    subtotal: string;
    totalTax: string;
    totalDiscount: string;
    total: string;
  }> {
    const items = await this.findByInvoiceUuid(invoiceUuid, tx);

    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const item of items) {
      const quantity = parseFloat(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      const taxRate = parseFloat(item.taxRate || '0');
      const discount = parseFloat(item.discount || '0');

      const itemSubtotal = quantity * unitPrice;
      const itemDiscount = discount;
      const itemAfterDiscount = itemSubtotal - itemDiscount;
      const itemTax = (itemAfterDiscount * taxRate) / 100;

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
    }

    const total = subtotal - totalDiscount + totalTax;

    return {
      subtotal: subtotal.toFixed(2),
      totalTax: totalTax.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      total: total.toFixed(2),
    };
  }
}
