import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MultisigService } from './services/multisig.service';
import {
  CreateMultisigAccountDto,
  CreateConsumeProposalDto,
  CreateSendProposalDto,
  CreateBatchSendProposalDto,
  CreateProposalFromBillsDto,
  SubmitSignatureDto,
  MultisigAccountResponseDto,
  MultisigProposalResponseDto,
  ExecuteTransactionResponseDto,
} from './dto/multisig.dto';
import { ParaJwtAuthGuard } from '../auth/guards/para-jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';
import { CurrentUser, UserWithCompany } from '../auth/decorators/current-user.decorator';

@ApiTags('Multisig')
@Controller('multisig')
@UseGuards(ParaJwtAuthGuard)
@ApiBearerAuth()
export class MultisigController {
  constructor(private readonly multisigService: MultisigService) {}

  // ============================================================================
  // Account Endpoints
  // ============================================================================

  @Post('accounts')
  @CompanyAuth()
  @ApiOperation({ summary: 'Create a new multisig account' })
  @ApiResponse({
    status: 201,
    description: 'Multisig account created successfully',
    type: MultisigAccountResponseDto,
  })
  async createAccount(
    @Body() dto: CreateMultisigAccountDto,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<MultisigAccountResponseDto> {
    return this.multisigService.createAccount(dto, user);
  }

  @Get('accounts/:accountId')
  @ApiOperation({ summary: 'Get a multisig account by ID' })
  @ApiResponse({
    status: 200,
    description: 'Multisig account found',
    type: MultisigAccountResponseDto,
  })
  async getAccount(
    @Param('accountId') accountId: string,
  ): Promise<MultisigAccountResponseDto> {
    return this.multisigService.getAccount(accountId);
  }

  @Get('companies/:companyId/accounts')
  @ApiOperation({ summary: 'List all multisig accounts for a company' })
  @ApiResponse({
    status: 200,
    description: 'List of multisig accounts',
    type: [MultisigAccountResponseDto],
  })
  async listAccountsByCompany(
    @Param('companyId', ParseIntPipe) companyId: number,
  ): Promise<MultisigAccountResponseDto[]> {
    return this.multisigService.listAccountsByCompany(companyId);
  }

  @Get('accounts/:accountId/notes')
  @ApiOperation({ summary: 'Get consumable notes for an account' })
  @ApiResponse({
    status: 200,
    description: 'List of consumable notes',
  })
  async getConsumableNotes(@Param('accountId') accountId: string): Promise<{ notes: any[] }> {
    const notes = await this.multisigService.getConsumableNotes(accountId);
    return { notes };
  }

  @Get('accounts/:accountId/balances')
  @ApiOperation({ summary: 'Get account balances' })
  @ApiResponse({
    status: 200,
    description: 'Account balances',
  })
  async getAccountBalances(@Param('accountId') accountId: string): Promise<{ balances: any[] }> {
    const balances = await this.multisigService.getAccountBalances(accountId);
    return { balances };
  }

  @Get('accounts/:accountId/members')
  @ApiOperation({ summary: 'List all team members for a multisig account' })
  @ApiResponse({
    status: 200,
    description: 'List of account members',
  })
  async listAccountMembers(@Param('accountId') accountId: string): Promise<{ members: any[] }> {
    const members = await this.multisigService.listAccountMembers(accountId);
    return { members };
  }

  // ============================================================================
  // Proposal Endpoints
  // ============================================================================

  @Post('proposals/consume')
  @ApiOperation({ summary: 'Create a consume notes proposal' })
  @ApiResponse({
    status: 201,
    description: 'Consume proposal created successfully',
    type: MultisigProposalResponseDto,
  })
  async createConsumeProposal(
    @Body() dto: CreateConsumeProposalDto,
  ): Promise<MultisigProposalResponseDto> {
    return this.multisigService.createConsumeProposal(dto);
  }

  @Post('proposals/send')
  @ApiOperation({ summary: 'Create a send funds proposal' })
  @ApiResponse({
    status: 201,
    description: 'Send proposal created successfully',
    type: MultisigProposalResponseDto,
  })
  async createSendProposal(
    @Body() dto: CreateSendProposalDto,
  ): Promise<MultisigProposalResponseDto> {
    return this.multisigService.createSendProposal(dto);
  }

  @Post('proposals/send-batch')
  @ApiOperation({ summary: 'Create a batch send funds proposal with multiple recipients' })
  @ApiResponse({
    status: 201,
    description: 'Batch send proposal created successfully',
    type: MultisigProposalResponseDto,
  })
  async createBatchSendProposal(
    @Body() dto: CreateBatchSendProposalDto,
  ): Promise<MultisigProposalResponseDto> {
    return this.multisigService.createBatchSendProposal(dto);
  }

  @Post('proposals/from-bills')
  @CompanyAuth()
  @ApiOperation({ summary: 'Create a proposal from bills for multi-signature payment' })
  @ApiResponse({
    status: 201,
    description: 'Proposal created from bills successfully',
    type: MultisigProposalResponseDto,
  })
  async createProposalFromBills(
    @Body() dto: CreateProposalFromBillsDto,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<MultisigProposalResponseDto> {
    return this.multisigService.createProposalFromBills(dto, user);
  }

  @Get('proposals/:proposalId')
  @ApiOperation({ summary: 'Get a proposal by ID' })
  @ApiResponse({
    status: 200,
    description: 'Proposal found',
    type: MultisigProposalResponseDto,
  })
  async getProposal(
    @Param('proposalId', ParseIntPipe) proposalId: number,
  ): Promise<MultisigProposalResponseDto> {
    return this.multisigService.getProposal(proposalId);
  }

  @Get('accounts/:accountId/proposals')
  @ApiOperation({ summary: 'List all proposals for an account' })
  @ApiResponse({
    status: 200,
    description: 'List of proposals',
    type: [MultisigProposalResponseDto],
  })
  async listProposals(
    @Param('accountId') accountId: string,
  ): Promise<MultisigProposalResponseDto[]> {
    return this.multisigService.listProposals(accountId);
  }

  @Get('companies/:companyId/proposals')
  @ApiOperation({ summary: 'List all proposals for a company across all multisig accounts' })
  @ApiResponse({
    status: 200,
    description: 'List of proposals for the company',
    type: [MultisigProposalResponseDto],
  })
  async listProposalsByCompany(
    @Param('companyId', ParseIntPipe) companyId: number,
  ): Promise<MultisigProposalResponseDto[]> {
    return this.multisigService.listProposalsByCompany(companyId);
  }

  @Post('proposals/:proposalId/signatures')
  @ApiOperation({ summary: 'Submit a signature for a proposal' })
  @ApiResponse({
    status: 200,
    description: 'Signature submitted successfully',
    type: MultisigProposalResponseDto,
  })
  async submitSignature(
    @Param('proposalId', ParseIntPipe) proposalId: number,
    @Body() dto: SubmitSignatureDto,
  ): Promise<MultisigProposalResponseDto> {
    return this.multisigService.submitSignature(proposalId, dto);
  }

  @Post('proposals/:proposalId/execute')
  @ApiOperation({ summary: 'Execute a proposal' })
  @ApiResponse({
    status: 200,
    description: 'Proposal execution result',
    type: ExecuteTransactionResponseDto,
  })
  async executeProposal(
    @Param('proposalId', ParseIntPipe) proposalId: number,
  ): Promise<ExecuteTransactionResponseDto> {
    return this.multisigService.executeProposal(proposalId);
  }

  @Post('proposals/:proposalUuid/cancel')
  @CompanyAuth()
  @ApiOperation({ summary: 'Cancel a proposal (deletes signatures, unlinks bills)' })
  @ApiResponse({
    status: 200,
    description: 'Proposal cancelled successfully',
    type: MultisigProposalResponseDto,
  })
  async cancelProposal(
    @Param('proposalUuid') proposalUuid: string,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<MultisigProposalResponseDto> {
    return this.multisigService.cancelProposal(proposalUuid, user);
  }

  // ============================================================================
  // Test/Development Endpoints
  // ============================================================================

  @Post('test/create-company')
  @ApiOperation({ summary: 'Create a test company (for development only)' })
  @ApiResponse({
    status: 201,
    description: 'Test company created successfully',
  })
  async createTestCompany() {
    return this.multisigService.createTestCompany();
  }
}
