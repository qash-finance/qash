import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/swagger';
import { BillService } from './bill.service';
import {
  BillQueryDto,
  BillStatsDto,
  PayBillsDto,
  BatchPaymentResultDto,
} from './bill.dto';
import { BillModel } from 'src/database/generated/models';
import { BillStatusEnum } from 'src/database/generated/client';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';

@ApiTags('Bill')
@ApiBearerAuth()
@Controller('api/v1/bill')
@CompanyAuth()
export class BillController {
  constructor(private readonly billService: BillService) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************
  @Get()
  @ApiOperation({ summary: 'Get all bills with pagination and filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bills retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: BillStatusEnum })
  @ApiQuery({ name: 'groupId', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getBills(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query() query: BillQueryDto,
  ): Promise<{
    bills: BillModel[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    return this.billService.getBills(user.company.id, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get bill statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bill statistics retrieved successfully',
    type: BillStatsDto,
  })
  async getBillStats(
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<BillStatsDto> {
    return this.billService.getBillStats(user.company.id);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get bill details' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Bill not found',
  })
  @ApiParam({ name: 'uuid', type: 'string', description: 'Bill UUID' })
  async getBillDetails(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('uuid') uuid: string,
  ): Promise<any> {
    return this.billService.getBillDetails(uuid, user.company.id);
  }
  //#endregion GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************
  @Post('pay')
  @ApiOperation({ summary: 'Pay multiple bills in batch' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bills paid successfully',
    type: BatchPaymentResultDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid bill IDs or payment data',
  })
  async payBills(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() payBillsDto: PayBillsDto,
  ): Promise<BatchPaymentResultDto> {
    return this.billService.payBills(user.company.id, payBillsDto);
  }

  @Patch(':id/status/:status')
  @ApiOperation({ summary: 'Update bill status manually' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bill status updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Bill not found',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Bill ID' })
  @ApiParam({
    name: 'status',
    enum: BillStatusEnum,
    description: 'New bill status',
  })
  async updateBillStatus(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('id', ParseIntPipe) id: number,
    @Param('status') status: BillStatusEnum,
  ): Promise<BillModel> {
    return this.billService.updateBillStatus(id, user.company.id, status);
  }
  //#endregion POST METHODS
}
