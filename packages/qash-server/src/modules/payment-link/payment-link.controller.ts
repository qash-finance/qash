import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PaymentLinkService } from './payment-link.service';
import {
  CreatePaymentLinkDto,
  UpdatePaymentLinkDto,
  PaymentLinkRecordDto,
  PaymentLinkOrderDto,
  DeletePaymentLinksDto,
} from './payment-link.dto';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';

@ApiTags('Payment Link')
@ApiBearerAuth()
@Controller('payment-link')
@CompanyAuth()
export class PaymentLinkController {
  constructor(private readonly paymentLinkService: PaymentLinkService) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ******************
  // *************************************************

  @Get()
  @ApiOperation({ summary: 'Get all payment links for authenticated company' })
  @ApiResponse({ status: 200, description: 'List of payment links' })
  async getAllPaymentLinks(@CurrentUser('withCompany') user: UserWithCompany) {
    return this.paymentLinkService.getPaymentLinks(user.company.id);
  }

  @Get(':code')
  @Public()
  @ApiOperation({ summary: 'Get payment link by code (public)' })
  @ApiResponse({ status: 200, description: 'Payment link details' })
  @ApiResponse({ status: 404, description: 'Payment link not found' })
  @ApiParam({ name: 'code', description: 'Payment link code' })
  async getPaymentLinkByCode(@Param('code') code: string) {
    return this.paymentLinkService.getPaymentLinkByCode(code);
  }

  @Get(':code/owner')
  @ApiOperation({
    summary: 'Get payment link by code for owner (with ownership check)',
  })
  @ApiResponse({ status: 200, description: 'Payment link details' })
  @ApiResponse({ status: 404, description: 'Payment link not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the owner of this payment link',
  })
  @ApiParam({ name: 'code', description: 'Payment link code' })
  async getPaymentLinkByCodeForOwner(
    @Param('code') code: string,
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    return this.paymentLinkService.getPaymentLinkByCodeForCompany(
      code,
      user.company.id,
    );
  }
  //#endregion

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS ******************
  // *************************************************

  @Post()
  @ApiOperation({ summary: 'Create a new payment link' })
  @ApiResponse({ status: 201, description: 'Payment link created' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation failed' })
  @ApiBody({ type: CreatePaymentLinkDto })
  async createPaymentLink(
    @Body() dto: CreatePaymentLinkDto,
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    return this.paymentLinkService.createPaymentLink(dto, user.company.id);
  }

  @Post(':code/pay')
  @Public()
  @ApiOperation({ summary: 'Record a payment to a payment link (public)' })
  @ApiResponse({ status: 201, description: 'Payment recorded' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation failed' })
  @ApiResponse({ status: 404, description: 'Payment link not found' })
  @ApiParam({ name: 'code', description: 'Payment link code' })
  @ApiBody({ type: PaymentLinkRecordDto })
  async recordPayment(
    @Param('code') code: string,
    @Body() dto: PaymentLinkRecordDto,
  ) {
    return this.paymentLinkService.recordPayment(code, dto);
  }
  //#endregion

  //#region PUT METHODS
  // *************************************************
  // **************** PUT METHODS *******************
  // *************************************************

  @Put(':code')
  @ApiOperation({ summary: 'Update a payment link' })
  @ApiResponse({ status: 200, description: 'Payment link updated' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation failed' })
  @ApiResponse({ status: 404, description: 'Payment link not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the owner of this payment link',
  })
  @ApiParam({ name: 'code', description: 'Payment link code' })
  @ApiBody({ type: UpdatePaymentLinkDto })
  async updatePaymentLink(
    @Param('code') code: string,
    @Body() dto: UpdatePaymentLinkDto,
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    return this.paymentLinkService.updatePaymentLink(
      code,
      user.company.id,
      dto,
    );
  }

  @Put(':code/deactivate')
  @ApiOperation({ summary: 'Deactivate a payment link' })
  @ApiResponse({ status: 200, description: 'Payment link deactivated' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Already deactivated',
  })
  @ApiResponse({ status: 404, description: 'Payment link not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the owner of this payment link',
  })
  @ApiParam({ name: 'code', description: 'Payment link code' })
  async deactivatePaymentLink(
    @Param('code') code: string,
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    return this.paymentLinkService.deactivatePaymentLink(code, user.company.id);
  }

  @Put(':code/activate')
  @ApiOperation({ summary: 'Activate a payment link' })
  @ApiResponse({ status: 200, description: 'Payment link activated' })
  @ApiResponse({ status: 400, description: 'Bad Request - Already active' })
  @ApiResponse({ status: 404, description: 'Payment link not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the owner of this payment link',
  })
  @ApiParam({ name: 'code', description: 'Payment link code' })
  async activatePaymentLink(
    @Param('code') code: string,
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    return this.paymentLinkService.activatePaymentLink(code, user.company.id);
  }

  @Put('payment/:paymentId/txid')
  @ApiOperation({ summary: 'Update payment record with transaction ID' })
  @ApiResponse({ status: 200, description: 'Payment updated' })
  @ApiResponse({ status: 404, description: 'Payment record not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the owner of this payment link',
  })
  @ApiParam({ name: 'paymentId', description: 'Payment record ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        txid: { type: 'string', example: '0x123...' },
      },
    },
  })
  async updatePaymentTxid(
    @Param('paymentId') paymentId: number,
    @Body() body: { txid: string },
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    return this.paymentLinkService.updatePaymentTxid(
      paymentId,
      body.txid,
      user.company.id,
    );
  }

  //#endregion

  //#region PATCH METHODS
  // *************************************************
  // **************** PATCH METHODS *****************
  // *************************************************

  @Patch('update-order')
  @ApiOperation({
    summary: 'Update order of payment links',
    description: 'Update the display order of payment links',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment links reordered successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid link IDs' })
  @ApiBody({ type: PaymentLinkOrderDto })
  async updatePaymentLinkOrder(
    @Body() dto: PaymentLinkOrderDto,
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    return this.paymentLinkService.updatePaymentLinkOrder(dto, user.company.id);
  }

  //#endregion PATCH METHODS

  //#region DELETE METHODS
  // *************************************************
  // **************** DELETE METHODS ****************
  // *************************************************
  @Delete()
  @ApiOperation({
    summary: 'Delete payment links',
    description:
      'Delete one or more payment links by providing their codes. Use an array with one code for single deletion.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment links deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: '3 payment link(s) deleted successfully',
        },
        deletedCount: { type: 'number', example: 3 },
        deletedCodes: {
          type: 'array',
          items: { type: 'string' },
          example: ['ABC123', 'DEF456', 'GHI789'],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid codes or validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'One or more payment links not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the owner of one or more payment links',
  })
  @ApiBody({ type: DeletePaymentLinksDto })
  async deletePaymentLinks(
    @Body() dto: DeletePaymentLinksDto,
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    return this.paymentLinkService.deletePaymentLinks(dto, user.company.id);
  }
  //#endregion DELETE METHODS
}
