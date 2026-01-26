import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MidenClientService } from './miden-client.service';
import {
  CreateMultisigAccountDto,
  CreateConsumeProposalDto,
  CreateSendProposalDto,
  CreateBatchSendProposalDto,
  CreateProposalFromBillsDto,
  SubmitSignatureDto,
  MintTokensDto,
  MultisigAccountResponseDto,
  MultisigProposalResponseDto,
  ExecuteTransactionResponseDto,
} from '../dto/multisig.dto';
import { UserWithCompany } from '../../auth/decorators/current-user.decorator';
import { ActivityActionEnum, ActivityEntityTypeEnum, BillStatusEnum } from '../../../database/generated/client';
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
   * Mint tokens to a multisig account from a faucet
   */
  async mintTokens(
    accountId: string,
    dto: MintTokensDto,
  ): Promise<{ transactionId: string }> {
    this.logger.log(
      `Minting ${dto.amount} tokens to account ${accountId} from faucet ${dto.faucetId}`,
    );

    // Verify account exists
    await this.getAccount(accountId);

    // Call Miden client to mint tokens
    const { transactionId } = await this.midenClient.mintTokens(
      accountId,
      dto.faucetId,
      dto.amount,
    );

    return { transactionId };
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
   * Create a batch send funds proposal with multiple recipients
   */
  async createBatchSendProposal(
    dto: CreateBatchSendProposalDto,
  ): Promise<MultisigProposalResponseDto> {
    this.logger.log(
      `Creating batch send proposal for account ${dto.accountId} with ${dto.payments.length} payments`,
    );

    // Verify account exists
    const account = await this.getAccount(dto.accountId);

    // Validate batch has at least one payment
    if (!dto.payments || dto.payments.length === 0) {
      throw new BadRequestException(
        'Batch send proposal must have at least one payment',
      );
    }

    // Validate batch doesn't exceed UI limit (50 recipients)
    if (dto.payments.length > 50) {
      throw new BadRequestException(
        'Batch send proposal cannot exceed 50 recipients per proposal. Please split into multiple proposals.',
      );
    }

    // Create proposal via Miden client with batch payments
    const { summaryCommitment, summaryBytesHex, requestBytesHex } =
      await this.midenClient.createBatchSendProposal(
        dto.accountId,
        dto.payments,
      );

    // Store proposal in database with payments stored as JSON
    const proposal = await this.prisma.multisigProposal.create({
      data: {
        accountId: dto.accountId,
        description: dto.description,
        proposalType: 'SEND',
        summaryCommitment: summaryCommitment,
        summaryBytesHex: summaryBytesHex,
        requestBytesHex: requestBytesHex,
        noteIds: [],
        status: 'PENDING',
      },
      include: {
        signatures: true,
      },
    });

    this.logger.log(
      `Batch send proposal created with ${dto.payments.length} payments: ${proposal.uuid}`,
    );

    return this.mapProposalToDto(proposal, account.threshold);
  }

  /**
   * Create a proposal from bills (for multi-signature bill payments)
   */
  async createProposalFromBills(
    dto: CreateProposalFromBillsDto,
    user: UserWithCompany,
  ): Promise<MultisigProposalResponseDto> {
    this.logger.log(
      `Creating proposal from ${dto.billUUIDs.length} bills for account ${dto.accountId}`,
    );

    // Verify account exists and belongs to user's company
    const account = await this.prisma.multisigAccount.findUnique({
      where: { accountId: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException(`Multisig account ${dto.accountId} not found`);
    }

    if (account.companyId !== user.company.id) {
      throw new BadRequestException(
        'Cannot create proposal for a multisig account from a different company',
      );
    }

    // Fetch bills with their invoices
    this.logger.debug(`Searching for bills with UUIDs: ${dto.billUUIDs.join(', ')} in company ${user.company.id}`);
    
    const bills = await this.prisma.bill.findMany({
      where: {
        uuid: { in: dto.billUUIDs },
        companyId: user.company.id,
      },
      include: {
        invoice: {
          include: {
            employee: true,
            items: true,
          },
        },
      },
    });

    if (bills.length === 0) {
      this.logger.error(`No bills found with UUIDs: ${dto.billUUIDs.join(', ')} in company ${user.company.id}. Available bills in this company:`, 
        await this.prisma.bill.findMany({ where: { companyId: user.company.id }, select: { uuid: true } }));
      throw new NotFoundException('No valid bills found for the provided UUIDs');
    }

    this.logger.debug(`Found ${bills.length} bills out of ${dto.billUUIDs.length} requested`);

    // Validate all bills are in payable status (PENDING or OVERDUE)
    const invalidBills = bills.filter(
      (b) => b.status !== BillStatusEnum.PENDING && b.status !== BillStatusEnum.OVERDUE,
    );
    if (invalidBills.length > 0) {
      throw new BadRequestException(
        `Bills with status other than PENDING or OVERDUE cannot be paid: ${invalidBills.map((b) => b.uuid).join(', ')}`,
      );
    }

    // Check that bills are not already linked to another proposal
    const linkedBills = bills.filter((b) => b.multisigProposalId !== null);
    if (linkedBills.length > 0) {
      throw new BadRequestException(
        `Bills are already linked to another proposal: ${linkedBills.map((b) => b.uuid).join(', ')}`,
      );
    }

    // For now, create a placeholder proposal (Miden client integration for multi-bill payment TBD)
    // The actual summaryCommitment, summaryBytesHex, requestBytesHex would come from Miden
    const proposal = await this.prisma.$transaction(async (tx) => {
      // Group bills by faucet (token type) to determine how many proposals we need
      const billsByFaucet = new Map<
        string,
        (typeof bills)[0][]
      >();

      for (const bill of bills) {
        // Extract faucetId from payment_token JSON
        const paymentToken = bill.invoice?.paymentToken as any;
        const faucetId = paymentToken?.address || 'default-qash'; // Default to main token if not specified
        if (!billsByFaucet.has(faucetId)) {
          billsByFaucet.set(faucetId, []);
        }
        billsByFaucet.get(faucetId)!.push(bill);
      }

      this.logger.debug(
        `Bills grouped by faucet: ${Array.from(billsByFaucet.keys()).join(', ')}`,
      );

      // For now, create a single proposal for the first faucet group (multi-currency can be handled later)
      // In future, we can create multiple proposals (one per faucet) and link them together
      const firstFaucetId = Array.from(billsByFaucet.keys())[0];
      const billsForProposal = billsByFaucet.get(firstFaucetId)!;

      // Build batch payments from bills
      const payments = billsForProposal.map((bill) => {
        const paymentToken = bill.invoice?.paymentToken as any;
        const decimals = paymentToken?.decimals ?? 6;
        const amount = Math.floor(Number(bill.invoice?.total) * Math.pow(10, decimals));
        
        return {
          recipientId:
            bill.invoice?.employee?.walletAddress || `employee-${bill.invoice?.employeeId}`,
          faucetId: firstFaucetId,
          amount,
        };
      });

      this.logger.debug(`Creating batch proposal with ${payments.length} payments`);



      //TODO: Integrate with Miden client to create batch proposal
      // Create batch proposal via Miden client
      // const { summaryCommitment, summaryBytesHex, requestBytesHex } =
      //   await this.midenClient.createBatchSendProposal(dto.accountId, payments);

      const summaryCommitment = 'placeholder-commitment';
      const summaryBytesHex = 'placeholder-bytes-hex';
      const requestBytesHex = 'placeholder-bytes-hex';

      // Create the proposal
      const newProposal = await tx.multisigProposal.create({
        data: {
          accountId: dto.accountId,
          description: dto.description,
          proposalType: 'SEND',
          summaryCommitment,
          summaryBytesHex,
          requestBytesHex,
          noteIds: [],
          status: 'PENDING',
          metadata: {
            billUUIDs: dto.billUUIDs,
            totalBills: bills.length,
            billsInProposal: billsForProposal.length,
            faucetId: firstFaucetId,
            // Note: Multi-currency payments would require additional proposals
            multiCurrencyNote:
              billsByFaucet.size > 1
                ? `${billsByFaucet.size} different faucets detected - additional proposals needed for other currencies`
                : undefined,
          },
        },
        include: {
          signatures: true,
        },
      });

      // Link bills to the proposal
      await tx.bill.updateMany({
        where: {
          uuid: { in: billsForProposal.map((b) => b.uuid) },
        },
        data: {
          multisigProposalId: newProposal.id,
        },
      });

      // Re-fetch the proposal including linked bills and signatures so callers receive updated relations
      const proposalWithBills = await tx.multisigProposal.findUnique({
        where: { id: newProposal.id },
        include: {
          signatures: true,
          bills: {
            include: {
              invoice: true,
            },
          },
        },
      });

      return proposalWithBills!;
    });

    // Get team member for activity log
    const teamMember = await this.prisma.teamMember.findUnique({
      where: { userId: user.internalUserId },
    });

    // Log activity
    if (teamMember) {
      await this.activityLogService.logActivity({
        companyId: user.company.id,
        teamMemberId: teamMember.id,
        action: ActivityActionEnum.CREATE,
        entityType: ActivityEntityTypeEnum.MULTISIG_PROPOSAL,
        entityId: proposal.id,
        entityUuid: proposal.uuid,
        description: `Created payment proposal for ${bills.length} bills`,
        metadata: {
          accountId: dto.accountId,
          billUUIDs: dto.billUUIDs,
          billCount: bills.length,
        },
      });
    }

    this.logger.log(`Proposal created from bills: ${proposal.uuid}`);

    return this.mapProposalToDto(proposal, account.threshold);
  }

  /**
   * Cancel a proposal (deletes signatures, unlinks bills, sets status to CANCELLED)
   * Uses optimistic locking via status validation
   */
  async cancelProposal(
    proposalUuid: string,
    user: UserWithCompany,
  ): Promise<MultisigProposalResponseDto> {
    this.logger.log(`Cancelling proposal ${proposalUuid}`);

    // Get proposal with all data
    const proposal = await this.prisma.multisigProposal.findUnique({
      where: { uuid: proposalUuid },
      include: {
        account: true,
        signatures: true,
        bills: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalUuid} not found`);
    }

    // Verify company ownership
    if (proposal.account.companyId !== user.company.id) {
      throw new BadRequestException(
        'Cannot cancel a proposal from a different company',
      );
    }

    // Validate status - only allow cancellation of PENDING or READY proposals
    if (proposal.status !== 'PENDING' && proposal.status !== 'READY') {
      throw new ConflictException(
        `Cannot cancel proposal with status ${proposal.status}. Only PENDING or READY proposals can be cancelled.`,
      );
    }

    // Use transaction for atomic operation with optimistic locking
    const updatedProposal = await this.prisma.$transaction(async (tx) => {
      // Re-check status to prevent race conditions (optimistic locking)
      const currentProposal = await tx.multisigProposal.findUnique({
        where: { uuid: proposalUuid },
        select: { status: true },
      });

      if (currentProposal?.status !== 'PENDING' && currentProposal?.status !== 'READY') {
        throw new ConflictException(
          `Proposal status changed to ${currentProposal?.status}. Cannot cancel.`,
        );
      }

      // Delete all signatures
      await tx.multisigSignature.deleteMany({
        where: { proposalId: proposal.id },
      });

      // Unlink bills and reset their status to PENDING
      if (proposal.bills.length > 0) {
        await tx.bill.updateMany({
          where: { multisigProposalId: proposal.id },
          data: {
            multisigProposalId: null,
            status: BillStatusEnum.PENDING,
          },
        });
      }

      // Update proposal status to CANCELLED
      return tx.multisigProposal.update({
        where: { uuid: proposalUuid },
        data: { status: 'CANCELLED' },
        include: {
          account: true,
          signatures: true,
          bills: true,
        },
      });
    });

    // Get team member for activity log
    const teamMember = await this.prisma.teamMember.findUnique({
      where: { userId: user.internalUserId },
    });

    // Log activity
    if (teamMember) {
      await this.activityLogService.logActivity({
        companyId: user.company.id,
        teamMemberId: teamMember.id,
        action: ActivityActionEnum.CANCEL,
        entityType: ActivityEntityTypeEnum.MULTISIG_PROPOSAL,
        entityId: proposal.id,
        entityUuid: proposal.uuid,
        description: `Cancelled payment proposal (${proposal.bills.length} bills unlinked, ${proposal.signatures.length} signatures deleted)`,
        metadata: {
          accountId: proposal.accountId,
          billUUIDs: proposal.bills.map((b) => b.uuid),
          signaturesDeleted: proposal.signatures.length,
        },
      });
    }

    this.logger.log(
      `Proposal ${proposalUuid} cancelled: ${proposal.bills.length} bills unlinked, ${proposal.signatures.length} signatures deleted`,
    );

    return this.mapProposalToDto(updatedProposal, updatedProposal.account.threshold);
  }

  /**
   * List all proposals for a company (across all multisig accounts)
   */
  async listProposalsByCompany(
    companyId: number,
  ): Promise<MultisigProposalResponseDto[]> {
    const proposals = await this.prisma.multisigProposal.findMany({
      where: {
        account: {
          companyId,
        },
      },
      include: {
        account: true,
        signatures: true,
        bills: true
      },
      orderBy: { createdAt: 'desc' },
    });

    return proposals.map((p) => this.mapProposalToDto(p, p.account.threshold));
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
        bills: {
          include: {
            invoice: true,
          },
        },
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
        bills: {
          include: {
            invoice: true,
          },
        },
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
        bills: {
          include: {
            invoice: true,
          },
        },
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
   * Handles linked bills: validates, filters invalid, updates status on success/failure
   */
  async executeProposal(
    proposalId: number,
  ): Promise<ExecuteTransactionResponseDto> {
    this.logger.log(`Executing proposal ${proposalId}`);

    // Get proposal with all data including linked bills
    const proposal = await this.prisma.multisigProposal.findUnique({
      where: { id: proposalId },
      include: {
        account: true,
        signatures: true,
        bills: {
          include: {
            invoice: true,
          },
        },
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

    // Filter valid bills (those with valid invoices and payable status)
    const validBills = proposal.bills.filter(
      (b) =>
        b.invoice !== null &&
        (b.status === BillStatusEnum.PENDING || b.status === BillStatusEnum.OVERDUE),
    );

    const invalidBillIds = proposal.bills
      .filter((b) => !validBills.includes(b))
      .map((b) => b.uuid);

    if (invalidBillIds.length > 0) {
      this.logger.warn(
        `Skipping ${invalidBillIds.length} invalid bills: ${invalidBillIds.join(', ')}`,
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

    const now = new Date();

    // Update proposal and bills based on result
    if (result.success) {
      await this.prisma.$transaction(async (tx) => {
        // Update proposal status
        await tx.multisigProposal.update({
          where: { id: proposalId },
          data: {
            status: 'EXECUTED',
            transactionId: result.transactionId,
          },
        });

        // Update valid bills to PAID
        if (validBills.length > 0) {
          await tx.bill.updateMany({
            where: {
              id: { in: validBills.map((b) => b.id) },
            },
            data: {
              status: BillStatusEnum.PAID,
              paidAt: now,
              transactionHash: result.transactionId,
            },
          });

          // Update corresponding invoices to PAID
          const invoiceIds = validBills
            .map((b) => b.invoice?.id)
            .filter((id): id is number => id !== undefined);

          if (invoiceIds.length > 0) {
            await tx.invoice.updateMany({
              where: { id: { in: invoiceIds } },
              data: {
                status: 'PAID',
                paidAt: now,
              },
            });
          }
        }
      });

      this.logger.log(
        `Proposal ${proposalId} executed successfully: ${result.transactionId}. ${validBills.length} bills paid.`,
      );
    } else {
      await this.prisma.$transaction(async (tx) => {
        // Update proposal status to FAILED
        await tx.multisigProposal.update({
          where: { id: proposalId },
          data: { status: 'FAILED' },
        });

        // Update linked bills to FAILED (but keep them linked for audit trail)
        if (proposal.bills.length > 0) {
          await tx.bill.updateMany({
            where: { multisigProposalId: proposalId },
            data: { status: BillStatusEnum.FAILED },
          });
        }
      });

      this.logger.error(
        `Proposal ${proposalId} execution failed: ${result.error}. ${proposal.bills.length} bills marked as FAILED.`,
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
      recipientId: proposal.recipientId,
      faucetId: proposal.faucetId,
      amount: proposal.amount,
      signatures: proposal.signatures?.map((sig: any) => ({
        id: sig.id,
        uuid: sig.uuid,
        approverIndex: sig.approverIndex,
        approverPublicKey: sig.approverPublicKey,
        signatureHex: sig.signatureHex,
        createdAt: sig.createdAt,
        teamMember: sig.teamMember ? {
          uuid: sig.teamMember.uuid,
          firstName: sig.teamMember.firstName,
          lastName: sig.teamMember.lastName,
        } : undefined,
      })) || [],
      bills: proposal.bills?.map((bill: any) => ({
        uuid: bill.uuid,
        invoiceNumber: bill.invoice?.invoiceNumber,
        amount: bill.invoice?.total,
        status: bill.status,
        recipientName: bill.invoice?.employee?.name || bill.invoice?.fromDetails?.name,
        recipientAddress: bill.invoice?.paymentWalletAddress,
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
