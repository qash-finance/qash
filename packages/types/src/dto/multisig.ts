/**
 * Shared Multisig DTOs for Qash monorepo
 * 
 * These types define the contract between frontend and backend
 * for multisig account and proposal management.
 */

import { MultisigProposalStatusEnum, MultisigProposalTypeEnum } from '../enums/index.js';
import { TokenDto } from './token.js';

// Request DTOs
export interface CreateMultisigAccountDto {
  accountId: string;
  publicKeys: string[];
  name: string;
  description?: string;
  logo?: string;
  teamMemberIds: string[];
  threshold: number;
  companyId: number;
}

export interface CreateConsumeProposalDto {
  accountId: string;
  description: string;
  noteIds: string[];
  tokens: TokenDto[];
  /** PSM proposal ID (from MultisigClient TransactionProposal.id) */
  psmProposalId?: string;
  /** PSM proposal commitment (hex) — when provided, backend skips the Rust server */
  summaryCommitment?: string;
  /** PSM txSummary (base64) — stored as summaryBytesHex */
  summaryBytesHex?: string;
  /** PSM-created proposal has no separate requestBytes; stored for schema compat */
  requestBytesHex?: string;
}

export interface CreateSendProposalDto {
  accountId: string;
  description: string;
  recipientId: string;
  faucetId: string;
  amount: number;
  tokens: TokenDto[];
  /** PSM proposal ID (from MultisigClient TransactionProposal.id) */
  psmProposalId?: string;
  /** PSM proposal commitment (hex) */
  summaryCommitment?: string;
  /** PSM txSummary (base64) — stored as summaryBytesHex */
  summaryBytesHex?: string;
  /** PSM requestBytes (for schema compat) */
  requestBytesHex?: string;
}

export interface MintTokensDto {
  faucetId: string;
  amount: number;
}

export interface GetBatchAccountBalancesDto {
  accountIds: string[];
}

export interface AccountBalanceDto {
  faucetId: string;
  amount: number;
}

export interface TokenStatDto {
  faucetId: string;
  symbol?: string;
  amount: number; // normalized amount (e.g., divided by decimals for QASH)
  amountUSD: number; // USD value (assuming $1 per token)
}

export interface AccountBalanceStatDto {
  totalUSD: number;
  tokens: TokenStatDto[];
}

export interface AccountBalancesInfoDto {
  accountId: string;
  balances: AccountBalanceDto[];
  stats: AccountBalanceStatDto;
}

export interface GetBatchAccountBalancesResponseDto {
  accounts: AccountBalancesInfoDto[];
}

export interface BatchPaymentItem {
  recipientId: string;
  faucetId: string;
  amount: number;
}

export interface CreateBatchSendProposalDto {
  accountId: string;
  description: string;
  payments: BatchPaymentItem[];
  tokens: TokenDto[];
  /** PSM proposal ID (from MultisigClient TransactionProposal.id) */
  psmProposalId?: string;
  /** PSM proposal commitment (hex) */
  summaryCommitment?: string;
  /** PSM txSummary (base64) — stored as summaryBytesHex */
  summaryBytesHex?: string;
  /** PSM requestBytes (for schema compat) */
  requestBytesHex?: string;
}

export interface CreateProposalFromBillsDto {
  accountId: string;
  billUUIDs: string[];
  description: string;
  tokens: TokenDto[];
  payments?: BatchPaymentItem[];
  /** PSM proposal ID (from MultisigClient TransactionProposal.id) */
  psmProposalId?: string;
  /** PSM proposal commitment (hex) — when provided, backend skips the Rust server */
  summaryCommitment?: string;
  /** PSM txSummary (base64) — stored as summaryBytesHex */
  summaryBytesHex?: string;
  /** PSM-created proposal has no separate requestBytes; stored for schema compat */
  requestBytesHex?: string;
}

export interface SubmitSignatureDto {
  approverIndex: number;
  approverPublicKey: string;
  signatureHex: string;
}

export interface SubmitRejectionDto {
  reason?: string;
}

// Response DTOs
export interface MultisigAccountResponseDto {
  id: number;
  uuid: string;
  accountId: string;
  name: string;
  description?: string;
  logo?: string;
  publicKeys: string[];
  threshold: number;
  companyId: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MultisigSignatureDto {
  id: number;
  uuid: string;
  approverIndex: number;
  approverPublicKey: string;
  signatureHex: string;
  createdAt: string | Date;
  teamMember?: {
    uuid: string;
    firstName: string;
    lastName: string;
  };
}

export interface MultisigRejectionDto {
  id: number;
  uuid: string;
  teamMemberId: number;
  teamMember?: {
    id: number;
    uuid: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  reason?: string;
  createdAt: string | Date;
}

export interface MultisigProposalResponseDto {
  id: number;
  uuid: string;
  accountId: string;
  description: string;
  proposalType: MultisigProposalTypeEnum | string;
  psmProposalId?: string;
  summaryCommitment: string;
  summaryBytesHex: string;
  requestBytesHex: string;
  status: MultisigProposalStatusEnum | string;
  transactionId?: string;
  signaturesCount: number;
  threshold: number;
  noteIds?: string[];
  tokens: TokenDto[];
  recipientId?: string;
  faucetId?: string;
  amount?: string;
  payments?: BatchPaymentItem[]; // For batch send proposals
  signatures?: MultisigSignatureDto[];
  rejections?: MultisigRejectionDto[];
  rejectionCount?: number;
  approvers?: Array<{
    id?: number;
    uuid?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    publicKey?: string;
    joinedAt?: string | Date;
    signed?: boolean;
    signature?: {
      id: number;
      uuid: string;
      approverIndex: number;
      signatureHex: string;
      createdAt: string | Date;
    };
  }>;
  bills?: MultisigProposalBillDto[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MultisigProposalBillDto {
  uuid: string;
  invoiceNumber?: string;
  amount?: string;
  status: string;
  recipientName?: string;
  recipientAddress?: string;
  paymentToken?: any; // token metadata from invoice.paymentToken
}

export interface ExecuteTransactionResponseDto {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface ProposalTimelineEventDto {
  event: 'CREATED' | 'SIGNED' | 'EXECUTED' | 'FAILED' | 'CANCELLED';
  timestamp: string | Date;
  actorName?: string;
  metadata?: Record<string, any>;
}

export interface ProposalHistoryDto {
  proposalUuid: string;
  proposalStatus: MultisigProposalStatusEnum | string;
  transactionId?: string;
  threshold: number;
  signaturesCount: number;
  timeline: ProposalTimelineEventDto[];
}

// Type aliases for backwards compatibility
export type MultisigAccountResponse = MultisigAccountResponseDto;
export type MultisigProposalResponse = MultisigProposalResponseDto;
