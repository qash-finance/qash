/**
 * Shared Multisig DTOs for Qash monorepo
 * 
 * These types define the contract between frontend and backend
 * for multisig account and proposal management.
 */

// Request DTOs
export interface CreateMultisigAccountDto {
  publicKeys: string[];
  threshold: number;
  companyId: number;
}

export interface CreateConsumeProposalDto {
  accountId: string;
  description: string;
  noteIds: string[];
}

export interface CreateSendProposalDto {
  accountId: string;
  description: string;
  recipientId: string;
  faucetId: string;
  amount: number;
}

export interface SubmitSignatureDto {
  approverIndex: number;
  approverPublicKey: string;
  signatureHex: string;
}

// Response DTOs
export interface MultisigAccountResponseDto {
  id: number;
  uuid: string;
  accountId: string;
  publicKeys: string[];
  threshold: number;
  companyId: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MultisigSignatureDto {
  id: number;
  approverIndex: number;
  approverPublicKey: string;
  signatureHex: string;
}

export interface MultisigProposalResponseDto {
  id: number;
  uuid: string;
  accountId: string;
  description: string;
  proposalType: string;
  summaryCommitment: string;
  summaryBytesHex: string;
  requestBytesHex: string;
  status: string;
  transactionId?: string;
  signaturesCount: number;
  threshold: number;
  noteIds?: string[];
  signatures?: MultisigSignatureDto[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ExecuteTransactionResponseDto {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// Type aliases for backwards compatibility
export type MultisigAccountResponse = MultisigAccountResponseDto;
export type MultisigProposalResponse = MultisigProposalResponseDto;
