import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { B2BInvoiceService } from './services/b2b-invoice.service';
import { B2BInvoiceScheduleService } from './services/b2b-invoice-schedule.service';
import { PdfService } from './services/pdf.service';
import {
  CreateB2BInvoiceDto,
  UpdateB2BInvoiceDto,
  B2BInvoiceQueryDto,
  B2BInvoiceStatsDto,
  CreateB2BScheduleDto,
  UpdateB2BScheduleDto,
} from './invoice.dto';
import { InvoiceModel } from 'src/database/generated/models';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('B2B Invoice')
@ApiBearerAuth()
@Controller('api/v1/invoice/b2b')
export class B2BInvoiceController {
  constructor(
    private readonly b2bInvoiceService: B2BInvoiceService,
    private readonly b2bScheduleService: B2BInvoiceScheduleService,
    private readonly pdfService: PdfService,
  ) {}

  //#region B2B INVOICE ENDPOINTS
  // *************************************************
  // ************* B2B INVOICE ENDPOINTS *************
  // *************************************************

  @Get()
  @CompanyAuth()
  @ApiOperation({ summary: 'Get all B2B invoices for company with filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B invoices retrieved successfully',
  })
  async getB2BInvoices(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query() query: B2BInvoiceQueryDto,
  ): Promise<{
    invoices: InvoiceModel[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    return this.b2bInvoiceService.getB2BInvoices(user.company.id, query);
  }

  @Get('stats')
  @CompanyAuth()
  @ApiOperation({ summary: 'Get B2B invoice statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B invoice statistics retrieved successfully',
    type: B2BInvoiceStatsDto,
  })
  async getB2BInvoiceStats(
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<B2BInvoiceStatsDto> {
    return this.b2bInvoiceService.getB2BInvoiceStats(user.company.id);
  }

  @Get(':invoiceUUID')
  @CompanyAuth()
  @ApiOperation({ summary: 'Get B2B invoice by UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B invoice retrieved successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async getB2BInvoiceByUUID(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('invoiceUUID') invoiceUUID: string,
  ): Promise<InvoiceModel> {
    return this.b2bInvoiceService.getB2BInvoiceByUUID(
      invoiceUUID,
      user.company.id,
    );
  }

  @Get(':invoiceUUID/public')
  @Public()
  @ApiOperation({ summary: 'Get B2B invoice by UUID (public access for confirmation)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B invoice retrieved successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async getB2BInvoiceByUUIDPublic(
    @Param('invoiceUUID') invoiceUUID: string,
  ): Promise<InvoiceModel> {
    return this.b2bInvoiceService.getB2BInvoiceByUUIDPublic(invoiceUUID);
  }

  @Get(':invoiceUUID/pdf')
  @Public()
  @ApiOperation({ summary: 'Download B2B invoice as PDF (public access)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'PDF generated successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async downloadB2BInvoicePdf(
    @Param('invoiceUUID') invoiceUUID: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const invoice =
        await this.b2bInvoiceService.getB2BInvoiceByUUIDPublic(invoiceUUID);
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

  @Post()
  @CompanyAuth()
  @ApiOperation({ summary: 'Create a new B2B invoice' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'B2B invoice created successfully',
  })
  async createB2BInvoice(
    @Body() createB2BInvoiceDto: CreateB2BInvoiceDto,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<InvoiceModel> {
    return this.b2bInvoiceService.createB2BInvoice(
      createB2BInvoiceDto,
      user.company.id,
    );
  }

  @Put(':invoiceUUID')
  @CompanyAuth()
  @ApiOperation({ summary: 'Update B2B invoice (DRAFT only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B invoice updated successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async updateB2BInvoice(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('invoiceUUID') invoiceUUID: string,
    @Body() updateB2BInvoiceDto: UpdateB2BInvoiceDto,
  ): Promise<InvoiceModel> {
    return this.b2bInvoiceService.updateB2BInvoice(
      invoiceUUID,
      updateB2BInvoiceDto,
      user.company.id,
    );
  }

  @Patch(':invoiceUUID/send')
  @CompanyAuth()
  @ApiOperation({ summary: 'Send B2B invoice to recipient' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B invoice sent successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async sendB2BInvoice(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('invoiceUUID') invoiceUUID: string,
  ): Promise<InvoiceModel> {
    return this.b2bInvoiceService.sendB2BInvoice(invoiceUUID, user.company.id);
  }

  @Patch(':invoiceUUID/confirm')
  @Public()
  @ApiOperation({ summary: 'Confirm B2B invoice (public access for recipient)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B invoice confirmed successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async confirmB2BInvoice(
    @Param('invoiceUUID') invoiceUUID: string,
  ): Promise<InvoiceModel> {
    return this.b2bInvoiceService.confirmB2BInvoice(invoiceUUID);
  }

  @Patch(':invoiceUUID/mark-paid')
  @CompanyAuth()
  @ApiOperation({ summary: 'Mark B2B invoice as paid (sender only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B invoice marked as paid successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async markB2BInvoiceAsPaid(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('invoiceUUID') invoiceUUID: string,
    @Body() body: { transactionHash?: string },
  ): Promise<InvoiceModel> {
    return this.b2bInvoiceService.markB2BInvoiceAsPaid(
      invoiceUUID,
      user.company.id,
      body.transactionHash,
    );
  }

  @Patch(':invoiceUUID/cancel')
  @CompanyAuth()
  @ApiOperation({ summary: 'Cancel B2B invoice' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B invoice cancelled successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async cancelB2BInvoice(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('invoiceUUID') invoiceUUID: string,
  ): Promise<InvoiceModel> {
    return this.b2bInvoiceService.cancelB2BInvoice(
      invoiceUUID,
      user.company.id,
    );
  }

  @Delete(':invoiceUUID')
  @CompanyAuth()
  @ApiOperation({ summary: 'Delete B2B invoice (DRAFT only)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'B2B invoice deleted successfully',
  })
  @ApiParam({
    name: 'invoiceUUID',
    type: 'string',
    description: 'Invoice UUID',
  })
  async deleteB2BInvoice(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('invoiceUUID') invoiceUUID: string,
  ): Promise<void> {
    return this.b2bInvoiceService.deleteB2BInvoice(
      invoiceUUID,
      user.company.id,
    );
  }

  //#endregion B2B INVOICE ENDPOINTS

  //#region B2B SCHEDULE ENDPOINTS
  // *************************************************
  // ************* B2B SCHEDULE ENDPOINTS ************
  // *************************************************

  @Get('schedules')
  @CompanyAuth()
  @ApiOperation({ summary: 'Get all B2B invoice schedules for company' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B schedules retrieved successfully',
  })
  async getB2BSchedules(
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<any[]> {
    return this.b2bScheduleService.getSchedulesByCompany(user.company.id);
  }

  @Get('schedules/:scheduleUUID')
  @CompanyAuth()
  @ApiOperation({ summary: 'Get B2B invoice schedule by UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B schedule retrieved successfully',
  })
  @ApiParam({
    name: 'scheduleUUID',
    type: 'string',
    description: 'Schedule UUID',
  })
  async getB2BScheduleByUUID(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('scheduleUUID') scheduleUUID: string,
  ): Promise<any> {
    return this.b2bScheduleService.getScheduleByUUID(
      scheduleUUID,
      user.company.id,
    );
  }

  @Post('schedules')
  @CompanyAuth()
  @ApiOperation({ summary: 'Create a new B2B invoice schedule' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'B2B schedule created successfully',
  })
  async createB2BSchedule(
    @Body() createB2BScheduleDto: CreateB2BScheduleDto,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<any> {
    return this.b2bScheduleService.createSchedule(
      createB2BScheduleDto,
      user.company.id,
    );
  }

  @Put('schedules/:scheduleUUID')
  @CompanyAuth()
  @ApiOperation({ summary: 'Update B2B invoice schedule' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B schedule updated successfully',
  })
  @ApiParam({
    name: 'scheduleUUID',
    type: 'string',
    description: 'Schedule UUID',
  })
  async updateB2BSchedule(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('scheduleUUID') scheduleUUID: string,
    @Body() updateB2BScheduleDto: UpdateB2BScheduleDto,
  ): Promise<any> {
    return this.b2bScheduleService.updateSchedule(
      scheduleUUID,
      updateB2BScheduleDto,
      user.company.id,
    );
  }

  @Patch('schedules/:scheduleUUID/toggle')
  @CompanyAuth()
  @ApiOperation({ summary: 'Toggle B2B schedule active status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B schedule toggled successfully',
  })
  @ApiParam({
    name: 'scheduleUUID',
    type: 'string',
    description: 'Schedule UUID',
  })
  async toggleB2BSchedule(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('scheduleUUID') scheduleUUID: string,
  ): Promise<any> {
    return this.b2bScheduleService.toggleSchedule(
      scheduleUUID,
      user.company.id,
    );
  }

  @Delete('schedules/:scheduleUUID')
  @CompanyAuth()
  @ApiOperation({ summary: 'Delete B2B invoice schedule' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'B2B schedule deleted successfully',
  })
  @ApiParam({
    name: 'scheduleUUID',
    type: 'string',
    description: 'Schedule UUID',
  })
  async deleteB2BSchedule(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('scheduleUUID') scheduleUUID: string,
  ): Promise<void> {
    return this.b2bScheduleService.deleteSchedule(
      scheduleUUID,
      user.company.id,
    );
  }

  //#endregion B2B SCHEDULE ENDPOINTS
}
