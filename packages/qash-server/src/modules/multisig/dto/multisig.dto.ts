import { IsString, IsInt, IsArray, IsOptional, IsNotEmpty, MaxLength, Min, ArrayMinSize, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type * as SharedTypes from '@qash/types/dto/multisig';

export class CreateMultisigAccountDto implements SharedTypes.CreateMultisigAccountDto {
  @ApiProperty({
    description: 'Name of the multisig account',
    example: 'Company Treasury',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'name cannot be longer than 255 characters' })
  name: string;

  @ApiProperty({
    description: 'Optional description of the multisig account',
    example: 'Multi-signature account for treasury management',
    maxLength: 1000,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'description cannot be longer than 1000 characters' })
  description?: string;

  @ApiProperty({
    description: 'Array of team member IDs to include as approvers (owner is auto-included). IDs should be strings.',
    example: ['1', '2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  teamMemberIds: string[];

  @ApiProperty({
    description: 'Number of signatures required to execute transactions',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  threshold: number;

  @ApiProperty({
    description: 'Company ID that owns this multisig account',
    example: 1,
  })
  @IsInt()
  @Min(1)
  companyId: number;
}

export class CreateConsumeProposalDto implements SharedTypes.CreateConsumeProposalDto {
  @ApiProperty({
    description: 'Multisig account ID (bech32 format)',
    example: 'mtst1abc123...',
  })
  @IsString()
  accountId: string;

  @ApiProperty({
    description: 'Description of the proposal',
    example: 'Consume incoming payment notes',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Array of note IDs to consume',
    example: ['0x123...', '0x456...'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  noteIds: string[];
}

export class CreateSendProposalDto implements SharedTypes.CreateSendProposalDto {
  @ApiProperty({
    description: 'Multisig account ID (bech32 format)',
    example: 'mtst1abc123...',
  })
  @IsString()
  accountId: string;

  @ApiProperty({
    description: 'Description of the proposal',
    example: 'Send payment to contractor',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Recipient account ID',
    example: 'mtst1xyz789...',
  })
  @IsString()
  recipientId: string;

  @ApiProperty({
    description: 'Faucet ID for the token',
    example: 'mtst1faucet...',
  })
  @IsString()
  faucetId: string;

  @ApiProperty({
    description: 'Amount to send',
    example: 1000,
  })
  @IsInt()
  @Min(1)
  amount: number;
}

export class BatchPaymentItemDto {
  @ApiProperty({
    description: 'Recipient account ID (bech32 format)',
    example: 'mtst1recipient...',
  })
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @ApiProperty({
    description: 'Faucet ID for the token',
    example: 'mtst1faucet...',
  })
  @IsString()
  @IsNotEmpty()
  faucetId: string;

  @ApiProperty({
    description: 'Amount to send to this recipient',
    example: 1000,
  })
  @IsInt()
  @Min(1)
  amount: number;
}

export class CreateBatchSendProposalDto implements SharedTypes.CreateBatchSendProposalDto {
  @ApiProperty({
    description: 'Multisig account ID (bech32 format)',
    example: 'mtst1abc123...',
  })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({
    description: 'Description of the batch proposal',
    example: 'Batch payment for January payroll',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Array of batch payments with recipient, faucet, and amount',
    type: [BatchPaymentItemDto],
    example: [
      { recipientId: 'mtst1emp1...', faucetId: 'mtst1qash...', amount: 1000 },
      { recipientId: 'mtst1emp2...', faucetId: 'mtst1qash...', amount: 2000 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsNotEmpty({ each: true })
  payments: BatchPaymentItemDto[];
}

export class SubmitSignatureDto implements SharedTypes.SubmitSignatureDto {
  @ApiProperty({
    description: 'Index of the approver in the approvers array',
    example: 0,
  })
  @IsInt()
  @Min(0)
  approverIndex: number;

  @ApiProperty({
    description: 'Approver public key (for verification)',
    example: '0x04...',
  })
  @IsString()
  approverPublicKey: string;

  @ApiProperty({
    description: 'Signature hex string from Para wallet',
    example: '0x01...',
  })
  @IsString()
  signatureHex: string;
}

export class CreateProposalFromBillsDto implements SharedTypes.CreateProposalFromBillsDto {
  @ApiProperty({
    description: 'Multisig account ID (bech32 format)',
    example: 'mtst1abc123...',
  })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({
    description: 'Array of bill UUIDs to include in the proposal',
    example: ['cuid1...', 'cuid2...'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  billUUIDs: string[];

  @ApiProperty({
    description: 'Description of the proposal',
    example: 'Pay invoices for January 2026',
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class MultisigAccountResponseDto implements SharedTypes.MultisigAccountResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  accountId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  publicKeys: string[];

  @ApiProperty()
  threshold: number;

  @ApiProperty()
  companyId: number;

  @ApiProperty({ type: [Object], required: false })
  teamMembers?: Array<{
    id: number;
    uuid: string;
    multisigAccountId: number;
    teamMemberId: number;
    createdAt: Date;
    updatedAt: Date;
  }>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class MultisigProposalResponseDto implements SharedTypes.MultisigProposalResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  accountId: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: ['CONSUME', 'SEND'] })
  proposalType: string;

  @ApiProperty()
  summaryCommitment: string;

  @ApiProperty()
  summaryBytesHex: string;

  @ApiProperty()
  requestBytesHex: string;

  @ApiProperty({ enum: ['PENDING', 'READY', 'EXECUTED', 'FAILED', 'CANCELLED'] })
  status: string;

  @ApiProperty({ required: false })
  transactionId?: string;

  @ApiProperty()
  signaturesCount: number;

  @ApiProperty()
  threshold: number;

  @ApiProperty({ type: [String], required: false })
  noteIds?: string[];

  @ApiProperty({ required: false })
  recipientId?: string;

  @ApiProperty({ required: false })
  faucetId?: string;

  @ApiProperty({ required: false })
  amount?: string;

  @ApiProperty({ type: [Object], required: false })
  signatures?: Array<{
    id: number;
    uuid: string;
    approverIndex: number;
    approverPublicKey: string;
    signatureHex: string;
    createdAt: Date;
    teamMember?: {
      uuid: string;
      firstName: string;
      lastName: string;
    };
  }>;

  @ApiProperty({ type: [Object], required: false })
  bills?: Array<{
    uuid: string;
    invoiceNumber?: string;
    amount?: string;
    status: string;
    recipientName?: string;
    recipientAddress?: string;
  }>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ExecuteTransactionResponseDto implements SharedTypes.ExecuteTransactionResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ required: false })
  transactionId?: string;

  @ApiProperty({ required: false })
  error?: string;
}
