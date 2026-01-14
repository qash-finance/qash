import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  InvoiceRepository,
  InvoiceWithRelations,
} from '../repositories/invoice.repository';
import { InvoiceItemService } from './invoice-item.service';
import {
  CreateB2BInvoiceDto,
  UpdateB2BInvoiceDto,
  B2BInvoiceQueryDto,
  B2BInvoiceStatsDto,
} from '../invoice.dto';
import {
  InvoiceCreateInput,
  InvoiceModel,
} from 'src/database/generated/models';
import {
  InvoiceStatusEnum,
  InvoiceTypeEnum,
} from 'src/database/generated/client';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from '../../mail/mail.service';
import { JsonValue } from '@prisma/client/runtime/client';
import { ErrorInvoice } from 'src/common/constants/errors';
import { handleError } from 'src/common/utils/errors';
import { BillService } from 'src/modules/bill/bill.service';
import { ClientRepository } from 'src/modules/client/repositories/client.repository';
import { CompanyRepository } from 'src/modules/company/company.repository';
import { TokenDto } from 'src/modules/employee/employee.dto';
import { UserRepository } from 'src/modules/auth/repositories/user.repository';
import { TeamMemberRepository } from 'src/modules/team-member/team-member.repository';

@Injectable()
export class B2BInvoiceService {
  private readonly logger = new Logger(B2BInvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly invoiceItemService: InvoiceItemService,
    private readonly billService: BillService,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly clientRepository: ClientRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly userRepository: UserRepository,
    private readonly teamMemberRepository: TeamMemberRepository,
  ) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************

  /**
   * Get B2B invoices for a company with filters
   */
  async getB2BInvoices(
    companyId: number,
    query: B2BInvoiceQueryDto,
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
      const { invoices, total } =
        await this.invoiceRepository.findB2BInvoicesByCompany(
          companyId,
          query.direction || 'both',
          {
            status: query.status,
            currency: query.currency,
            search: query.search,
          },
          {
            page: query.page || 1,
            limit: query.limit || 10,
          },
        );

      return {
        invoices,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 10,
          total,
          totalPages: Math.ceil(total / (query.limit || 10)),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching B2B invoices:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get B2B invoice by UUID with company access check
   */
  async getB2BInvoiceByUUID(
    invoiceUUID: string,
    companyId: number,
  ): Promise<InvoiceWithRelations> {
    try {
      const invoice = await this.invoiceRepository.findB2BByUUIDWithAccess(
        invoiceUUID,
        companyId,
      );

      if (!invoice) {
        throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
      }

      return invoice;
    } catch (error) {
      this.logger.error('Error fetching B2B invoice by UUID:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get B2B invoice by UUID (public access for confirmation)
   */
  async getB2BInvoiceByUUIDPublic(
    invoiceUUID: string,
  ): Promise<InvoiceWithRelations> {
    try {
      const invoice =
        await this.invoiceRepository.findB2BByUUIDPublic(invoiceUUID);

      if (!invoice) {
        throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
      }

      return invoice;
    } catch (error) {
      this.logger.error('Error fetching B2B invoice (public):', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get B2B invoice statistics
   */
  async getB2BInvoiceStats(companyId: number): Promise<B2BInvoiceStatsDto> {
    try {
      return this.invoiceRepository.getB2BStats(companyId);
    } catch (error) {
      this.logger.error('Error fetching B2B invoice stats:', error);
      handleError(error, this.logger);
    }
  }

  //#endregion GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************

  /**
   * Create a B2B invoice
   */
  async createB2BInvoice(
    dto: CreateB2BInvoiceDto,
    companyId: number,
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Get sender company details
        const fromCompany = await this.companyRepository.findById(
          companyId,
          tx,
        );
        if (!fromCompany) {
          throw new NotFoundException('Sender company not found');
        }

        // Prepare recipient details
        let toCompanyId: number | null = null;
        let toCompanyName: string | null = null;
        let toCompanyEmail: string | null = null;
        let toCompanyAddress: string | null = null;
        let toCompanyTaxId: string | null = null;
        let toCompanyContactName: string | null = null;
        let toCompanyMetadata: JsonValue | null = null;
        let emailTo: string;
        let emailCc: string[] = [];

        if (dto.clientId) {
          // Fetch client from database
          const client = await this.clientRepository.findByUUID(
            dto.clientId,
            companyId,
            tx,
          );

          if (!client) {
            throw new NotFoundException('Client not found');
          }

          toCompanyName = client.companyName;
          toCompanyEmail = client.email;
          emailTo = client.email;
          emailCc = client.ccEmails || [];

          // Build address from client fields
          const addressParts = [
            client.address1,
            client.address2,
            client.city,
            client.state,
            client.postalCode,
            client.country,
          ].filter(Boolean);
          toCompanyAddress = addressParts.join(', ') || null;
          toCompanyTaxId = client.taxId || null;
        } else if (dto.unregisteredCompany) {
          // Use unregistered company details
          toCompanyName = dto.unregisteredCompany.companyName;
          toCompanyEmail = dto.unregisteredCompany.email;
          toCompanyAddress = dto.unregisteredCompany.address || null;
          toCompanyTaxId = dto.unregisteredCompany.taxId || null;
          toCompanyContactName = dto.unregisteredCompany.contactName || null;
          toCompanyMetadata = dto.unregisteredCompany.metadata || null;
          emailTo = dto.unregisteredCompany.email;
          emailCc = dto.unregisteredCompany.ccEmails || [];
        } else {
          throw new BadRequestException(
            'Either clientId or unregisteredCompany details must be provided',
          );
        }

        // Generate invoice number (with recipient context for per-recipient sequencing)
        const invoiceNumber =
          await this.invoiceRepository.generateB2BInvoiceNumber(
            companyId,
            toCompanyId,
            toCompanyName,
            tx,
          );

        // Prepare from details
        const fromDetails = dto.fromDetails || {
          companyName: fromCompany.companyName,
          email: fromCompany.notificationEmail || '',
          address1: fromCompany.address1,
          address2: fromCompany.address2,
          city: fromCompany.city,
          country: fromCompany.country,
          postalCode: fromCompany.postalCode,
          taxId: fromCompany.taxId,
        };

        // Prepare to details
        const toDetails = {
          companyName: toCompanyName,
          email: toCompanyEmail,
          address: toCompanyAddress,
          taxId: toCompanyTaxId,
          contactName: toCompanyContactName,
        };

        // Calculate invoice totals
        const { subtotal, taxAmount, total } = this.calculateInvoiceTotals(
          dto.items,
          dto.taxRate || '0.00',
          dto.discount || '0.00',
        );

        // Create invoice
        const invoiceData: InvoiceCreateInput = {
          invoiceType: InvoiceTypeEnum.B2B,
          invoiceNumber,
          issueDate: new Date(dto.issueDate),
          dueDate: new Date(dto.dueDate),
          fromCompany: { connect: { id: companyId } },
          ...(toCompanyId && { toCompany: { connect: { id: toCompanyId } } }),
          toCompanyName,
          toCompanyEmail,
          toCompanyAddress,
          toCompanyTaxId,
          toCompanyContactName,
          toCompanyMetadata,
          emailTo,
          emailCc,
          emailBcc: dto.emailBcc || [],
          emailSubject: dto.emailSubject,
          emailBody: dto.emailBody,
          fromDetails: fromDetails as unknown as JsonValue,
          toDetails: toDetails as unknown as JsonValue,
          subtotal,
          taxRate: dto.taxRate || '0.00',
          taxAmount,
          discount: dto.discount || '0.00',
          total,
          currency: dto.currency,
          status: InvoiceStatusEnum.DRAFT,
          paymentNetwork: dto.network as unknown as JsonValue,
          paymentToken: dto.token as unknown as JsonValue,
          paymentWalletAddress: dto.walletAddress,
          memo: dto.memo as JsonValue,
          footer: dto.footer as JsonValue,
          terms: dto.terms as JsonValue,
          metadata: dto.metadata as JsonValue,
        };

        const invoice = await this.invoiceRepository.create(invoiceData, tx);

        // Create invoice items
        await this.invoiceItemService.createItems(
          invoice.uuid,
          dto.items.map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: item.unit,
            taxRate: item.taxRate || '0.00',
            discount: item.discount || '0.00',
            order: item.order ?? index,
          })),
          tx,
        );

        return invoice;
      });
    } catch (error) {
      this.logger.error('Error creating B2B invoice:', error);
      handleError(error, this.logger);
    }
  }

  //#endregion POST METHODS

  //#region PUT METHODS
  // *************************************************
  // **************** PUT METHODS ********************
  // *************************************************

  /**
   * Update a B2B invoice (only for DRAFT status)
   */
  async updateB2BInvoice(
    invoiceUUID: string,
    dto: UpdateB2BInvoiceDto,
    companyId: number,
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await this.invoiceRepository.findB2BByUUIDWithAccess(
          invoiceUUID,
          companyId,
          tx,
        );

        if (!invoice) {
          throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
        }

        // Only sender can update
        if (invoice.fromCompanyId !== companyId) {
          throw new ForbiddenException(ErrorInvoice.NotOwner);
        }

        // Only DRAFT invoices can be updated
        if (invoice.status !== InvoiceStatusEnum.DRAFT) {
          throw new BadRequestException('Only draft invoices can be updated');
        }

        // Prepare update data
        const updateData: any = {};

        if (dto.dueDate) {
          updateData.dueDate = new Date(dto.dueDate);
        }

        if (dto.fromDetails) {
          updateData.fromDetails = dto.fromDetails as unknown as JsonValue;
        }

        if (dto.network) {
          updateData.paymentNetwork = dto.network as unknown as JsonValue;
        }

        if (dto.token) {
          updateData.paymentToken = dto.token as unknown as JsonValue;
        }

        if (dto.walletAddress) {
          updateData.paymentWalletAddress = dto.walletAddress;
        }

        if (dto.emailSubject) {
          updateData.emailSubject = dto.emailSubject;
        }

        if (dto.emailBody) {
          updateData.emailBody = dto.emailBody;
        }

        if (dto.memo !== undefined) {
          updateData.memo = dto.memo as JsonValue;
        }

        if (dto.footer !== undefined) {
          updateData.footer = dto.footer as JsonValue;
        }

        if (dto.terms !== undefined) {
          updateData.terms = dto.terms as JsonValue;
        }

        if (dto.metadata !== undefined) {
          updateData.metadata = dto.metadata as JsonValue;
        }

        // Recalculate totals if items or tax/discount changed
        if (
          dto.items ||
          dto.taxRate !== undefined ||
          dto.discount !== undefined
        ) {
          const items = dto.items || invoice.items;
          const taxRate = dto.taxRate ?? invoice.taxRate;
          const discount = dto.discount ?? invoice.discount;

          const { subtotal, taxAmount, total } = this.calculateInvoiceTotals(
            items,
            taxRate,
            discount,
          );

          updateData.subtotal = subtotal;
          updateData.taxRate = taxRate;
          updateData.taxAmount = taxAmount;
          updateData.discount = discount;
          updateData.total = total;
        }

        const updatedInvoice = await this.invoiceRepository.update(
          { uuid: invoiceUUID },
          updateData,
          tx,
        );

        // Update items if provided
        if (dto.items) {
          // Delete existing items
          await this.invoiceItemService.deleteAllItems(invoice.id, tx);

          // Create new items
          await this.invoiceItemService.createItems(
            invoice.uuid,
            dto.items.map((item, index) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unit: item.unit,
              taxRate: item.taxRate || '0.00',
              discount: item.discount || '0.00',
              order: item.order ?? index,
            })),
            tx,
          );
        }

        return updatedInvoice;
      });
    } catch (error) {
      this.logger.error('Error updating B2B invoice:', error);
      handleError(error, this.logger);
    }
  }

  //#endregion PUT METHODS

  //#region PATCH METHODS
  // *************************************************
  // **************** PATCH METHODS ******************
  // *************************************************

  /**
   * Send B2B invoice to recipient
   */
  async sendB2BInvoice(
    invoiceUUID: string,
    companyId: number,
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await this.invoiceRepository.findB2BByUUIDWithAccess(
          invoiceUUID,
          companyId,
          tx,
        );

        if (!invoice) {
          throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
        }

        // Only sender can send
        if (invoice.fromCompanyId !== companyId) {
          throw new ForbiddenException(ErrorInvoice.NotOwner);
        }

        if (invoice.status !== InvoiceStatusEnum.DRAFT) {
          throw new BadRequestException(ErrorInvoice.InvoiceNotSendable);
        }

        // Check if recipient email belongs to a registered user with team membership
        const teamMember = await this.teamMemberRepository.findByUserEmail(
          invoice.emailTo,
          tx,
        );

        let reviewUrl: string;
        let billCreated = false;

        if (teamMember && teamMember.company) {
          // Recipient is a registered user with company membership
          // Update invoice to link to recipient company
          await this.invoiceRepository.update(
            { uuid: invoiceUUID },
            { toCompany: { connect: { id: teamMember.company.id } } },
            tx,
          );

          try {
            await this.billService.createBillFromB2BInvoice(
              invoice.uuid,
              teamMember.company.id,
              tx,
            );
            billCreated = true;
            reviewUrl = `/bill/review?invoiceUUID=${invoice.uuid}`;
            this.logger.log(
              `✅ Bill successfully created for registered user's company (${teamMember.company.companyName})`,
            );
          } catch (billError) {
            this.logger.error(
              `❌ Failed to create bill for registered user in company ${teamMember.company.companyName}:`,
              billError,
            );
            // Fallback to public confirmation flow
            reviewUrl = `/invoice-review/b2b?uuid=${invoice.uuid}&email=${encodeURIComponent(invoice.emailTo)}`;
          }
        } else {
          // Recipient is not a registered user - use public confirmation flow
          reviewUrl = `/invoice-review/b2b?uuid=${invoice.uuid}&email=${encodeURIComponent(invoice.emailTo)}`;
        }

        const updatedInvoice = await this.invoiceRepository.update(
          { uuid: invoiceUUID },
          {
            status: InvoiceStatusEnum.SENT,
            sentAt: new Date(),
          },
          tx,
        );

        // Send email to recipient with appropriate review link
        try {
          await this.mailService.sendB2BInvoiceNotification(
            invoice.emailTo,
            invoice.invoiceNumber,
            invoice.uuid,
            invoice.dueDate,
            invoice.fromCompany?.companyName || 'Unknown Company',
            invoice.toCompanyName || 'Unknown Recipient',
            invoice.total,
            invoice.paymentToken as unknown as TokenDto,
            invoice.emailSubject || `Invoice ${invoice.invoiceNumber}`,
            reviewUrl,
            billCreated,
          );
        } catch (emailError) {
          this.logger.error(
            'Failed to send B2B invoice notification email:',
            emailError,
          );
        }

        return updatedInvoice;
      });
    } catch (error) {
      this.logger.error('Error sending B2B invoice:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Confirm B2B invoice (by recipient - public access via UUID)
   */
  async confirmB2BInvoice(invoiceUUID: string): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await this.invoiceRepository.findB2BByUUIDPublic(
          invoiceUUID,
          tx,
        );

        if (!invoice) {
          throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
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

        // Create bill for the sender company (they will receive payment)
        // Only create if not already created (for unregistered users)
        if (invoice.fromCompanyId && !invoice.bill) {
          try {
            await this.billService.createBillFromB2BInvoice(
              invoice.uuid,
              invoice.fromCompanyId,
              tx,
            );
            this.logger.log(
              `✅ Bill created for sender company after public confirmation`,
            );
          } catch (billError) {
            this.logger.error(
              'Failed to create bill from B2B invoice:',
              billError,
            );
          }
        }

        // Send confirmation notification to sender
        try {
          await this.mailService.sendB2BInvoiceConfirmationNotification(
            invoice.fromCompany?.notificationEmail || '',
            invoice.invoiceNumber,
            invoice.fromCompany?.companyName || 'Your Company',
            invoice.toCompanyName || 'Unknown Recipient',
            invoice.toCompanyEmail || invoice.emailTo || '',
            invoice.total,
            (invoice.paymentToken as any).symbol,
          );
        } catch (emailError) {
          this.logger.error(
            'Failed to send B2B confirmation email:',
            emailError,
          );
        }

        return updatedInvoice;
      });
    } catch (error) {
      this.logger.error('Error confirming B2B invoice:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Mark B2B invoice as paid (by sender company)
   */
  async markB2BInvoiceAsPaid(
    invoiceUUID: string,
    companyId: number,
    _transactionHash?: string,
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await this.invoiceRepository.findB2BByUUIDWithAccess(
          invoiceUUID,
          companyId,
          tx,
        );

        if (!invoice) {
          throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
        }

        // Only sender can mark as paid
        if (invoice.fromCompanyId !== companyId) {
          throw new ForbiddenException(ErrorInvoice.NotOwner);
        }

        if (invoice.status !== InvoiceStatusEnum.CONFIRMED) {
          throw new BadRequestException(
            'Only confirmed invoices can be marked as paid',
          );
        }

        const updatedInvoice = await this.invoiceRepository.update(
          { uuid: invoiceUUID },
          {
            status: InvoiceStatusEnum.PAID,
            paidAt: new Date(),
          },
          tx,
        );

        // Update related bill to paid
        if (invoice.bill) {
          await this.billService.updateBillStatus(
            invoice.bill.id,
            companyId,
            'PAID' as any, // BillStatusEnum.PAID
          );
        }

        return updatedInvoice;
      });
    } catch (error) {
      this.logger.error('Error marking B2B invoice as paid:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Cancel B2B invoice (by sender company)
   */
  async cancelB2BInvoice(
    invoiceUUID: string,
    companyId: number,
  ): Promise<InvoiceModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await this.invoiceRepository.findB2BByUUIDWithAccess(
          invoiceUUID,
          companyId,
          tx,
        );

        if (!invoice) {
          throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
        }

        // Only sender can cancel
        if (invoice.fromCompanyId !== companyId) {
          throw new ForbiddenException(ErrorInvoice.NotOwner);
        }

        // Cannot cancel paid invoices
        if (invoice.status === InvoiceStatusEnum.PAID) {
          throw new BadRequestException('Paid invoices cannot be cancelled');
        }

        const updatedInvoice = await this.invoiceRepository.update(
          { uuid: invoiceUUID },
          { status: InvoiceStatusEnum.CANCELLED },
          tx,
        );

        // Delete related bill if exists
        if (invoice.bill) {
          await this.billService.deleteBill(invoice.bill.uuid, companyId, tx);
        }

        return updatedInvoice;
      });
    } catch (error) {
      this.logger.error('Error cancelling B2B invoice:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Delete B2B invoice (only DRAFT status)
   */
  async deleteB2BInvoice(
    invoiceUUID: string,
    companyId: number,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const invoice = await this.invoiceRepository.findB2BByUUIDWithAccess(
          invoiceUUID,
          companyId,
          tx,
        );

        if (!invoice) {
          throw new NotFoundException(ErrorInvoice.InvoiceNotFound);
        }

        // Only sender can delete
        if (invoice.fromCompanyId !== companyId) {
          throw new ForbiddenException(ErrorInvoice.NotOwner);
        }

        // Only DRAFT invoices can be deleted
        if (invoice.status !== InvoiceStatusEnum.DRAFT) {
          throw new BadRequestException('Only draft invoices can be deleted');
        }

        await this.invoiceRepository.delete({ uuid: invoiceUUID }, tx);
      });
    } catch (error) {
      this.logger.error('Error deleting B2B invoice:', error);
      handleError(error, this.logger);
    }
  }

  //#endregion PATCH METHODS

  //#region HELPER METHODS
  // *************************************************
  // **************** HELPER METHODS *****************
  // *************************************************

  /**
   * Calculate invoice totals from items
   */
  private calculateInvoiceTotals(
    items: Array<{
      quantity: string;
      unitPrice: string;
      taxRate?: string;
      discount?: string;
    }>,
    invoiceTaxRate: string,
    invoiceDiscount: string,
  ): { subtotal: string; taxAmount: string; total: string } {
    let subtotal = 0;

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      const itemDiscount = parseFloat(item.discount || '0');
      const lineTotal = qty * price - itemDiscount;
      subtotal += lineTotal;
    }

    const invoiceDiscountAmount = parseFloat(invoiceDiscount);
    const subtotalAfterDiscount = subtotal - invoiceDiscountAmount;

    const taxRate = parseFloat(invoiceTaxRate);
    const taxAmount = subtotalAfterDiscount * (taxRate / 100);

    const total = subtotalAfterDiscount + taxAmount;

    return {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
    };
  }

  //#endregion HELPER METHODS
}
