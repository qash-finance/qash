import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import {
  CreatePayrollDto,
  UpdatePayrollDto,
  PayrollQueryDto,
  PayrollStatsDto,
  PendingInvoiceReviewsDto,
} from './payroll.dto';
import { PayrollModel } from 'src/database/generated/models';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';

@ApiTags('Payroll')
@ApiBearerAuth()
@Controller('api/v1/payroll')
@CompanyAuth()
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************
  @Get()
  @ApiOperation({ summary: 'Get all payrolls with pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payrolls retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'employeeId', required: false, type: Number })
  @ApiQuery({
    name: 'contractTerm',
    required: false,
    enum: ['PERMANENT', 'CONTRACTOR'],
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getPayrolls(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query() query: PayrollQueryDto,
  ): Promise<{
    payrolls: PayrollModel[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    return this.payrollService.getPayrolls(user.company.id, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get payroll statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payroll statistics retrieved successfully',
    type: PayrollStatsDto,
  })
  async getPayrollStats(
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<PayrollStatsDto> {
    return this.payrollService.getPayrollStats(user.company.id);
  }

  @Get(':id/pending-reviews')
  @ApiOperation({
    summary: 'Check if payroll has pending invoice reviews from employee',
    description:
      'Returns information about invoices that are SENT and waiting for employee review',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending invoice reviews status retrieved successfully',
    type: PendingInvoiceReviewsDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payroll not found',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Payroll ID' })
  async checkPendingInvoiceReviews(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PendingInvoiceReviewsDto> {
    return this.payrollService.checkPendingInvoiceReviews(id, user.company.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payroll details with payment history' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payroll details retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payroll not found',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Payroll ID' })
  async getPayrollDetails(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PayrollModel> {
    return this.payrollService.getPayrollDetails(id, user.company.id);
  }

  //#endregion GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************
  @Post()
  @ApiOperation({ summary: 'Create a new payroll' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Payroll created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Employee already has an active payroll',
  })
  async createPayroll(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() createPayrollDto: CreatePayrollDto,
  ): Promise<PayrollModel> {
    return this.payrollService.createPayroll(user.company.id, createPayrollDto);
  }

  @Post('sandbox')
  @ApiOperation({
    summary:
      'Create a sandbox payroll scheduled ~30s from now (for scheduler test)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Sandbox payroll created; invoice scheduler should generate shortly',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        employeeId: { type: 'number' },
        amount: { type: 'number' },
      },
    },
  })
  async createSandboxPayroll(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() body: { employeeId: number; amount?: number },
  ): Promise<PayrollModel> {
    return this.payrollService.createSandboxPayroll(
      user.company.id,
      body.employeeId,
      body.amount,
    );
  }
  //#endregion POST METHODS

  //#region PUT METHODS
  // *************************************************
  // **************** PUT METHODS ********************
  // *************************************************
  @Put(':id')
  @ApiOperation({ summary: 'Update payroll' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payroll updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payroll not found',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Payroll ID' })
  async updatePayroll(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePayrollDto: UpdatePayrollDto,
  ): Promise<PayrollModel> {
    return this.payrollService.updatePayroll(
      id,
      user.company.id,
      updatePayrollDto,
    );
  }
  //#endregion PUT METHODS

  //#region PATCH METHODS
  // *************************************************
  // **************** PATCH METHODS ******************
  // *************************************************
  @Patch(':id/pause')
  @ApiOperation({ summary: 'Pause payroll' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payroll paused successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payroll not found',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Payroll ID' })
  async pausePayroll(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PayrollModel> {
    return this.payrollService.pausePayroll(id, user.company.id);
  }

  @Patch(':id/resume')
  @ApiOperation({ summary: 'Resume payroll' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payroll resumed successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payroll not found',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Payroll ID' })
  async resumePayroll(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PayrollModel> {
    return this.payrollService.resumePayroll(id, user.company.id);
  }
  //#endregion PATCH METHODS

  //#region DELETE METHODS
  // *************************************************
  // **************** DELETE METHODS ****************
  // *************************************************
  @Delete(':id')
  @ApiOperation({ summary: 'Delete payroll' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Payroll deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payroll not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Cannot delete payroll with existing invoices',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Payroll ID' })
  async deletePayroll(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.payrollService.deletePayroll(id, user.company.id);
  }
  //#endregion DELETE METHODS
}
