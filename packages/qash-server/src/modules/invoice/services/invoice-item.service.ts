import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InvoiceItemRepository } from '../repositories/invoice-item.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { PrismaService } from '../../../database/prisma.service';
import { CreateInvoiceItemDto, UpdateInvoiceItemDto } from '../invoice.dto';
import { ErrorInvoice, ErrorInvoiceItem } from 'src/common/constants/errors';
import { InvoiceTypeEnum } from 'src/database/generated/enums';
import { PrismaTransactionClient } from 'src/database/base.repository';

@Injectable()
export class InvoiceItemService {
  private readonly logger = new Logger(InvoiceItemService.name);

  constructor(
    private readonly itemRepository: InvoiceItemRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get all items for an invoice
   */
  async getItemsByInvoiceUuid(
    invoiceUUID: string,
    companyId: number,
  ): Promise<any[]> {
    await this.getAccessibleInvoice(invoiceUUID, companyId);

    return this.itemRepository.findByInvoiceUuid(invoiceUUID);
  }

  /**
   * Create multiple invoice items
   */
  async createItems(
    invoiceUUID: string,
    items: CreateInvoiceItemDto[],
    tx: PrismaTransactionClient,
  ): Promise<any[]> {
    // Calculate totals for each item
    const itemsToCreate = items.map((dto, index) => {
      const quantity = parseFloat(dto.quantity);
      const unitPrice = parseFloat(dto.unitPrice);
      const discount = parseFloat(dto.discount || '0');
      const taxRate = parseFloat(dto.taxRate || '0');

      const subtotal = quantity * unitPrice;
      const afterDiscount = subtotal - discount;
      const tax = (afterDiscount * taxRate) / 100;
      const total = afterDiscount + tax;

      return {
        invoiceUuid: invoiceUUID,
        description: dto.description,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        unit: dto.unit,
        taxRate: dto.taxRate || '0.00',
        discount: dto.discount || '0.00',
        total: total.toFixed(2),
        order: dto.order ?? index,
        metadata: dto.metadata,
      };
    });

    await this.itemRepository.createItems(itemsToCreate, tx);

    // Recalculate invoice totals
    await this.recalculateInvoiceTotals(invoiceUUID, tx);

    return this.itemRepository.findByInvoiceUuid(invoiceUUID, tx);
  }

  /**
   * Update invoice item
   */
  async updateItem(
    id: number,
    invoiceUUID: string,
    dto: UpdateInvoiceItemDto,
    tx: PrismaTransactionClient,
  ): Promise<any> {
    // Verify item exists and belongs to invoice
    const item = await this.itemRepository.findById(id, tx);

    if (!item || item.invoice.uuid !== invoiceUUID) {
      throw new NotFoundException(ErrorInvoiceItem.InvoiceItemNotFound);
    }

    const updateData: any = { ...dto };

    if (
      dto.quantity ||
      dto.unitPrice ||
      dto.discount !== undefined ||
      dto.taxRate !== undefined
    ) {
      const quantity = parseFloat(dto.quantity || item.quantity);
      const unitPrice = parseFloat(dto.unitPrice || item.unitPrice);
      const discount = parseFloat(dto.discount ?? item.discount);
      const taxRate = parseFloat(dto.taxRate ?? item.taxRate);

      const subtotal = quantity * unitPrice;
      const afterDiscount = subtotal - discount;
      const tax = (afterDiscount * taxRate) / 100;
      const total = afterDiscount + tax;

      updateData.total = total.toFixed(2);
    }

    const updated = await this.itemRepository.updateItem(id, updateData, tx);

    // Recalculate invoice totals
    await this.recalculateInvoiceTotals(invoiceUUID, tx);

    return updated;
  }

  /**
   * Delete invoice item
   */
  async deleteItem(
    id: number,
    invoiceUUID: string,
    tx: PrismaTransactionClient,
  ): Promise<void> {
    // Verify item exists and belongs to invoice
    const item = await this.itemRepository.findById(id, tx);

    if (!item || item.invoice.uuid !== invoiceUUID) {
      throw new NotFoundException(ErrorInvoiceItem.InvoiceItemNotFound);
    }

    await this.itemRepository.deleteItem(id, tx);

    // Recalculate invoice totals
    await this.recalculateInvoiceTotals(invoiceUUID, tx);
  }

  /**
   * Delete all items for an invoice
   */
  async deleteAllItems(
    invoiceId: number,
    tx: PrismaTransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;
    await client.invoiceItem.deleteMany({
      where: { invoiceId },
    });
  }

  /**
   * Recalculate invoice totals from items
   */
  async recalculateInvoiceTotals(
    invoiceUUID: string,
    tx: PrismaTransactionClient,
  ): Promise<{
    subtotal: string;
    taxAmount: string;
    total: string;
  }> {
    const totals = await this.itemRepository.calculateTotals(invoiceUUID, tx);

    // Update invoice with new totals
    const client = tx || this.prisma;
    await client.invoice.update({
      where: { uuid: invoiceUUID },
      data: {
        subtotal: totals.subtotal,
        taxAmount: totals.totalTax,
        total: totals.total,
        // Note: discount is not stored at invoice level, only at item level
      },
    });

    return {
      subtotal: totals.subtotal,
      taxAmount: totals.totalTax,
      total: totals.total,
    };
  }

  /**
   * Ensure invoice exists and belongs to the given company
   */
  private async getAccessibleInvoice(
    invoiceUUID: string,
    companyId: number,
    tx?: any,
  ) {
    const invoice = await this.invoiceRepository.findByUUID(invoiceUUID, tx);

    if (!invoice) {
      throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
    }

    if (invoice.invoiceType === InvoiceTypeEnum.EMPLOYEE) {
      if (invoice.payroll?.companyId !== companyId) {
        throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
      }
    } else if (invoice.invoiceType === InvoiceTypeEnum.B2B) {
      if (
        invoice.fromCompanyId !== companyId &&
        invoice.toCompanyId !== companyId
      ) {
        throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
      }
    }

    return invoice;
  }
}
