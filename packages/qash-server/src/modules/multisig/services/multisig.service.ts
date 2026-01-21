import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MidenClientService } from './miden-client.service';
import {
  CreateMultisigAccountDto,
  CreateConsumeProposalDto,
  CreateSendProposalDto,
  SubmitSignatureDto,
  MultisigAccountResponseDto,
  MultisigProposalResponseDto,
  ExecuteTransactionResponseDto,
} from '../dto/multisig.dto';
import { UserWithCompany } from '../../auth/decorators/current-user.decorator';
import { ActivityActionEnum, ActivityEntityTypeEnum } from '../../../database/generated/client';
import { ActivityLogService } from 'src/modules/activity-log/activity-log.service';

@Injectable()
export class MultisigService {
  private readonly logger = new Logger(MultisigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly midenClient: MidenClientService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  /**
   * Create a new multisig account
   */
  async createAccount(
    dto: CreateMultisigAccountDto,
    user: UserWithCompany,
  ): Promise<MultisigAccountResponseDto> {
    this.logger.log(
      `Creating multisig account for company ${dto.companyId} with threshold ${dto.threshold}`,
    );

    // Verify company matches authenticated user's company
    if (dto.companyId !== user.company.id) {
      throw new BadRequestException(
        'Cannot create multisig account for a different company',
      );
    }

    // Validate company exists
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(
        `Company with ID ${dto.companyId} not found`,
      );
    }

    // Get team member (owner/creator)
    const creatorTeamMember = await this.prisma.teamMember.findUnique({
      where: { userId: user.internalUserId },
    });

    if (!creatorTeamMember) {
      throw new NotFoundException(
        `Team member not found for user ${user.internalUserId}`,
      );
    }

    // Prepare team member IDs (always include creator) and convert to numbers
    const memberIds = new Set<number>([creatorTeamMember.id]);
    if (dto.teamMemberIds) {
      dto.teamMemberIds.forEach((idStr) => {
        const idNum = Number(idStr);
        if (Number.isNaN(idNum)) {
          throw new BadRequestException(`Invalid team member ID: ${idStr}`);
        }
        memberIds.add(idNum);
      });
    }

    // Verify all team members exist, belong to the company, and fetch related user (for publicKey)
    const memberIdArray = Array.from(memberIds);
    const teamMembers = await this.prisma.teamMember.findMany({
      where: {
        id: { in: memberIdArray },
        companyId: dto.companyId,
      },
      include: { user: true },
    });

    if (teamMembers.length !== memberIdArray.length) {
      throw new BadRequestException(
        'One or more team members do not exist or do not belong to this company',
      );
    }

    // Preserve ordering (creator first, then any others in provided order)
    const orderedTeamMembers = memberIdArray.map((id) => {
      const tm = teamMembers.find((t) => t.id === id);
      if (!tm) {
        throw new BadRequestException(`Team member ${id} not found`);
      }
      return tm;
    });

    // Extract public keys and validate presence
    const publicKeys = orderedTeamMembers.map((tm) => {
      const pk = tm.user?.publicKey;
      if (!pk) {
        throw new BadRequestException(`Missing public key for team member ${tm.id}`);
      }
      return pk;
    });

    // Validate threshold against number of approvers
    if (dto.threshold > publicKeys.length) {
      throw new BadRequestException(
        `Threshold (${dto.threshold}) cannot be greater than number of approvers (${publicKeys.length})`,
      );
    }

    // Create account via Miden client
    const { accountId } = await this.midenClient.createMultisigAccount(
      publicKeys,
      dto.threshold,
    );

    // Store in database with team members
    const account = await this.prisma.multisigAccount.create({
      data: {
        accountId,
        name: dto.name,
        description: dto.description,
        publicKeys,
        threshold: dto.threshold,
        companyId: dto.companyId,
        teamMembers: {
          create: memberIdArray.map((teamMemberId) => ({
            teamMemberId,
          })),
        },
      },
      include: {
        teamMembers: true,
      },
    });

    this.logger.log(`Multisig account created: ${accountId} with ${memberIds.size} team members`);

    // Log activity
    await this.activityLogService.logActivity({
      companyId: dto.companyId,
      teamMemberId: creatorTeamMember.id,
      action: ActivityActionEnum.CREATE,
      entityType: ActivityEntityTypeEnum.MULTISIG_ACCOUNT,
      entityId: account.id,
      entityUuid: account.uuid,
      description: `Created multisig account "${dto.name}" (${accountId}) with ${memberIds.size} members and threshold ${dto.threshold}`,
      metadata: {
        accountId,
        name: dto.name,
        description: dto.description,
        threshold: dto.threshold,
        memberCount: memberIds.size,
      },
    });

    return account;
  }

  /**
   * Get a multisig account by ID
   */
  async getAccount(accountId: string): Promise<MultisigAccountResponseDto> {
    const account = await this.prisma.multisigAccount.findUnique({
      where: { accountId },
      include: {
        teamMembers: true,
      },
    });

    if (!account) {
      throw new NotFoundException(
        `Multisig account ${accountId} not found`,
      );
    }

    return account;
  }

  /**
   * List all multisig accounts for a company
   */
  async listAccountsByCompany(
    companyId: number,
  ): Promise<MultisigAccountResponseDto[]> {
    return this.prisma.multisigAccount.findMany({
      where: { companyId },
      include: {
        teamMembers: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get consumable notes for an account
   */
  async getConsumableNotes(accountId: string): Promise<any[]> {
    // Verify account exists
    await this.getAccount(accountId);

    // Get notes from Miden client
    return this.midenClient.getConsumableNotes(accountId);
  }

  /**
   * Get account balances
   */
  async getAccountBalances(accountId: string): Promise<any[]> {
    // Verify account exists
    await this.getAccount(accountId);

    // Get balances from Miden client
    return this.midenClient.getAccountBalances(accountId);
  }

  /**
   * List all team members associated with a multisig account (by accountId)
   */
  async listAccountMembers(accountId: string): Promise<any[]> {
    // Verify account exists (using external accountId)
    const account = await this.prisma.multisigAccount.findUnique({
      where: { accountId },
    });

    if (!account) {
      throw new NotFoundException(`Multisig account ${accountId} not found`);
    }

    // Fetch account members by joining on multisig.accountId and include team member + user relations
    const members = await this.prisma.multisigAccountMember.findMany({
      where: { multisigAccount: { accountId } },
      include: {
        teamMember: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Map to a simple response shape for the API
    return members.map((m) => ({
      id: m.teamMember.id,
      uuid: m.teamMember.uuid,
      name: `${m.teamMember.firstName || ''} ${m.teamMember.lastName || ''}`.trim(),
      firstName: m.teamMember.firstName,
      lastName: m.teamMember.lastName,
      email: m.teamMember.user?.email,
      role: m.teamMember.role,
      position: m.teamMember.position,
      publicKey: m.teamMember.user?.publicKey,
      joinedAt: m.createdAt,
    }));
  }

  /**
   * Create a consume notes proposal
   */
  async createConsumeProposal(
    dto: CreateConsumeProposalDto,
  ): Promise<MultisigProposalResponseDto> {
    this.logger.log(
      `Creating consume proposal for account ${dto.accountId}`,
    );

    // Verify account exists
    const account = await this.getAccount(dto.accountId);

    // Create proposal via Miden client
    const { summaryCommitment, summaryBytesHex, requestBytesHex } =
      await this.midenClient.createConsumeProposal(
        dto.accountId,
        dto.noteIds,
      );

    // Store proposal in database
    const proposal = await this.prisma.multisigProposal.create({
      data: {
        accountId: dto.accountId,
        description: dto.description,
        proposalType: 'CONSUME',
        summaryCommitment,
        summaryBytesHex,
        requestBytesHex,
        noteIds: dto.noteIds,
        status: 'PENDING',
      },
      include: {
        signatures: true,
      },
    });

    this.logger.log(`Consume proposal created: ${proposal.uuid}`);

    return this.mapProposalToDto(proposal, account.threshold);
  }

  /**
   * Create a send funds proposal
   */
  async createSendProposal(
    dto: CreateSendProposalDto,
  ): Promise<MultisigProposalResponseDto> {
    this.logger.log(`Creating send proposal for account ${dto.accountId}`);

    // Verify account exists
    const account = await this.getAccount(dto.accountId);

    // Create proposal via Miden client
    const { summaryCommitment, summaryBytesHex, requestBytesHex } =
      await this.midenClient.createSendProposal(
        dto.accountId,
        dto.recipientId,
        dto.faucetId,
        dto.amount,
      );

    // Store proposal in database
    const proposal = await this.prisma.multisigProposal.create({
      data: {
        accountId: dto.accountId,
        description: dto.description,
        proposalType: 'SEND',
        summaryCommitment,
        summaryBytesHex,
        requestBytesHex,
        noteIds: [],
        recipientId: dto.recipientId,
        faucetId: dto.faucetId,
        amount: dto.amount.toString(),
        status: 'PENDING',
      },
      include: {
        signatures: true,
      },
    });

    this.logger.log(`Send proposal created: ${proposal.uuid}`);

    return this.mapProposalToDto(proposal, account.threshold);
  }

  /**
   * Get a proposal by ID
   */
  async getProposal(proposalId: number): Promise<MultisigProposalResponseDto> {
    const proposal = await this.prisma.multisigProposal.findUnique({
      where: { id: proposalId },
      include: {
        account: true,
        signatures: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    return this.mapProposalToDto(proposal, proposal.account.threshold);
  }

  /**
   * List all proposals for an account
   */
  async listProposals(
    accountId: string,
  ): Promise<MultisigProposalResponseDto[]> {
    const account = await this.getAccount(accountId);

    const proposals = await this.prisma.multisigProposal.findMany({
      where: { accountId },
      include: {
        signatures: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return proposals.map((p) => this.mapProposalToDto(p, account.threshold));
  }

  /**
   * Submit a signature for a proposal
   */
  async submitSignature(
    proposalId: number,
    dto: SubmitSignatureDto,
  ): Promise<MultisigProposalResponseDto> {
    this.logger.log(`Submitting signature for proposal ${proposalId}`);

    // Get proposal and account
    const proposal = await this.prisma.multisigProposal.findUnique({
      where: { id: proposalId },
      include: {
        account: true,
        signatures: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'PENDING' && proposal.status !== 'READY') {
      throw new BadRequestException(
        `Cannot add signature to proposal with status ${proposal.status}`,
      );
    }

    // Verify approver index is valid
    if (dto.approverIndex >= proposal.account.publicKeys.length) {
      throw new BadRequestException(
        `Invalid approver index ${dto.approverIndex}`,
      );
    }

    // Verify public key matches
    const expectedKey = proposal.account.publicKeys[dto.approverIndex];
    const normalizeKey = (key: string) =>
      key.toLowerCase().replace(/^0x/, '');

    if (normalizeKey(expectedKey) !== normalizeKey(dto.approverPublicKey)) {
      throw new BadRequestException(
        `Public key mismatch for approver ${dto.approverIndex}`,
      );
    }

    // Store signature (upsert to handle re-signing)
    await this.prisma.multisigSignature.upsert({
      where: {
        proposalId_approverIndex: {
          proposalId,
          approverIndex: dto.approverIndex,
        },
      },
      create: {
        proposalId,
        approverIndex: dto.approverIndex,
        approverPublicKey: dto.approverPublicKey,
        signatureHex: dto.signatureHex,
      },
      update: {
        signatureHex: dto.signatureHex,
      },
    });

    // Count signatures
    const signatureCount = await this.prisma.multisigSignature.count({
      where: { proposalId },
    });

    // Update proposal status if threshold met
    let updatedStatus = proposal.status;
    if (signatureCount >= proposal.account.threshold) {
      await this.prisma.multisigProposal.update({
        where: { id: proposalId },
        data: { status: 'READY' },
      });
      updatedStatus = 'READY';
      this.logger.log(`Proposal ${proposalId} is ready for execution`);
    }

    // Return updated proposal
    const updatedProposal = await this.getProposal(proposalId);
    return updatedProposal;
  }

  /**
   * Execute a proposal
   */
  async executeProposal(
    proposalId: number,
  ): Promise<ExecuteTransactionResponseDto> {
    this.logger.log(`Executing proposal ${proposalId}`);

    // Get proposal with all data
    const proposal = await this.prisma.multisigProposal.findUnique({
      where: { id: proposalId },
      include: {
        account: true,
        signatures: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    // Check status
    if (proposal.status !== 'READY' && proposal.status !== 'PENDING') {
      throw new BadRequestException(
        `Proposal is not ready for execution (status: ${proposal.status})`,
      );
    }

    // Check threshold
    if (proposal.signatures.length < proposal.account.threshold) {
      throw new BadRequestException(
        `Not enough signatures (${proposal.signatures.length}/${proposal.account.threshold})`,
      );
    }

    // Prepare signatures array (indexed by approver position)
    const signaturesHex: (string | null)[] = proposal.account.publicKeys.map(
      (_, index) => {
        const sig = proposal.signatures.find(
          (s) => s.approverIndex === index,
        );
        return sig ? sig.signatureHex : null;
      },
    );

    // Execute via Miden client
    const result = await this.midenClient.executeTransaction(
      proposal.accountId,
      proposal.requestBytesHex,
      proposal.summaryBytesHex,
      signaturesHex,
      proposal.account.publicKeys,
    );

    // Update proposal status
    if (result.success) {
      await this.prisma.multisigProposal.update({
        where: { id: proposalId },
        data: {
          status: 'EXECUTED',
          transactionId: result.transactionId,
        },
      });
      this.logger.log(
        `Proposal ${proposalId} executed successfully: ${result.transactionId}`,
      );
    } else {
      await this.prisma.multisigProposal.update({
        where: { id: proposalId },
        data: { status: 'FAILED' },
      });
      this.logger.error(
        `Proposal ${proposalId} execution failed: ${result.error}`,
      );
    }

    return result;
  }

  /**
   * Map proposal entity to DTO
   */
  private mapProposalToDto(
    proposal: any,
    threshold: number,
  ): MultisigProposalResponseDto {
    return {
      id: proposal.id,
      uuid: proposal.uuid,
      accountId: proposal.accountId,
      description: proposal.description,
      proposalType: proposal.proposalType,
      summaryCommitment: proposal.summaryCommitment,
      summaryBytesHex: proposal.summaryBytesHex,
      requestBytesHex: proposal.requestBytesHex,
      status: proposal.status,
      transactionId: proposal.transactionId,
      signaturesCount: proposal.signatures?.length || 0,
      threshold,
      noteIds: proposal.noteIds || [],
      signatures: proposal.signatures?.map((sig: any) => ({
        id: sig.id,
        approverIndex: sig.approverIndex,
        approverPublicKey: sig.approverPublicKey,
        signatureHex: sig.signatureHex,
      })) || [],
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
    };
  }

  /**
   * Create a test company for development/testing
   * WARNING: This should be disabled in production
   */
  async createTestCompany() {
    this.logger.warn('Creating test company - this should only be used in development!');

    // Check if company with ID 1 already exists
    const existingCompany = await this.prisma.company.findUnique({
      where: { id: 1 },
    });

    if (existingCompany) {
      return {
        message: 'Test company already exists',
        company: {
          id: existingCompany.id,
          companyName: existingCompany.companyName,
        },
      };
    }

    // Create a test company with dummy data
    const company = await this.prisma.company.create({
      data: {
        companyName: 'Test Company for Multisig',
        registrationNumber: `TEST-${Date.now()}`,
        companyType: 'PRIVATE_LIMITED_COMPANY',
        notificationEmail: 'test@example.com',
        ccNotifications: [],
        country: 'Singapore',
        address1: '123 Test Street',
        city: 'Singapore',
        postalCode: '123456',
      },
    });

    this.logger.log(`Created test company with ID ${company.id}`);

    return {
      message: 'Test company created successfully',
      company: {
        id: company.id,
        companyName: company.companyName,
      },
    };
  }
}
