import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { InvoiceService } from './services/invoice.service';
import { PdfService } from './services/pdf.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceQueryDto,
  InvoiceStatsDto,
} from './invoice.dto';
import { InvoiceModel } from 'src/database/generated/models';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/common/interfaces/para-jwt-payload';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Invoice')
@ApiBearerAuth()
@Controller('api/v1/invoice')
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly pdfService: PdfService,
  ) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************
  @Get()
  @CompanyAuth()
  @ApiOperation({ summary: 'Get all invoices for company with pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoices retrieved successfully',
  })
  async getInvoices(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query() query: InvoiceQueryDto,
  ): Promise<{
    invoices: InvoiceModel[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    return this.invoiceService.getInvoices(user.company.id, query);
  }

  @Get('stats')
  @CompanyAuth()
  @ApiOperation({ summary: 'Get invoice statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice statistics retrieved successfully',
    type: InvoiceStatsDto,
  })
  async getInvoiceStats(
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<InvoiceStatsDto> {
    return this.invoiceService.getInvoiceStats(user.company.id);
  }

  @Get('number/:invoiceUUID')
  @ApiOperation({
    summary: 'Get invoice by invoice uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice retrieved successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async getInvoiceByUUID(
    @Param('invoiceUUID') invoiceUUID: string,
  ): Promise<InvoiceModel> {
    return this.invoiceService.getInvoiceByUUID(invoiceUUID);
  }

  @Get(':invoiceUUID/pdf')
  @ApiOperation({ summary: 'Download invoice as PDF' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'PDF generated successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async downloadInvoicePdf(
    @Param('invoiceUUID') invoiceUUID: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const invoice = await this.invoiceService.getInvoiceByUUID(invoiceUUID);
      const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);
      const filename = this.pdfService.getInvoiceFilename(invoice);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to generate PDF',
        error: error.message,
      });
    }
  }
  //#region GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************
  @Post()
  @CompanyAuth()
  @ApiOperation({ summary: 'Create a new payroll invoice manually' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invoice created successfully',
  })
  async createPayrollInvoice(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<InvoiceModel> {
    return this.invoiceService.createPayrollInvoice(
      createInvoiceDto,
      user.company.id,
    );
  }

  @Post('generate/:payrollId')
  @CompanyAuth()
  @ApiOperation({ summary: 'Generate invoice from payroll (manual)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invoice generated successfully',
  })
  @ApiParam({ name: 'payrollId', type: 'number', description: 'Payroll ID' })
  async generateInvoice(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('payrollId', ParseIntPipe) payrollId: number,
  ): Promise<InvoiceModel> {
    return this.invoiceService.generateInvoiceFromPayroll(
      payrollId,
      user.company.id,
    );
  }
  //#endregion POST METHODS

  //#region PUT METHODS
  // *************************************************
  // **************** PUT METHODS ********************
  // *************************************************
  @Put(':invoiceUUID')
  @Auth()
  @ApiOperation({
    summary: 'Update invoice (employee can update their details)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice updated successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async updateInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceUUID') invoiceUUID: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<void> {
    this.invoiceService.updateInvoice(
      invoiceUUID,
      updateInvoiceDto,
      user.email,
    );
  }
  //#region PUT METHODS

  //#region PATCH METHODS
  // *************************************************
  // **************** PATCH METHODS ******************
  // *************************************************
  @Patch(':invoiceUUID/send')
  @CompanyAuth()
  @ApiOperation({ summary: 'Send invoice to employee' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice sent successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async sendInvoice(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('invoiceUUID') invoiceUUID: string,
  ): Promise<InvoiceModel> {
    return this.invoiceService.sendInvoice(invoiceUUID, user.company.id);
  }

  @Patch(':invoiceUUID/confirm')
  @Auth()
  @ApiOperation({ summary: 'Employee confirms invoice' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice confirmed successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async confirmInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceUUID') invoiceUUID: string,
  ): Promise<InvoiceModel> {
    return this.invoiceService.confirmInvoice(invoiceUUID, user.email);
  }

  @Patch(':invoiceUUID/cancel')
  @CompanyAuth()
  @ApiOperation({ summary: 'Cancel invoice' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice cancelled successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async cancelInvoice(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('invoiceUUID') invoiceUUID: string,
  ): Promise<InvoiceModel> {
    return this.invoiceService.cancelInvoice(invoiceUUID, user.company.id);
  }

  //#region PATCH METHODS
}
