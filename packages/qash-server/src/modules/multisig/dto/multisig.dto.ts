import { IsString, IsInt, IsArray, IsOptional, Min, ArrayMinSize, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type * as SharedTypes from '@qash/types/dto/multisig';

export class CreateMultisigAccountDto implements SharedTypes.CreateMultisigAccountDto {
  @ApiProperty({
    description: 'Array of approver public keys (hex-encoded, uncompressed format)',
    example: ['0x04...', '0x04...'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  publicKeys: string[];

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

  @ApiProperty({
    description: 'Additional team member IDs to add to the account (owner is added automatically)',
    example: [2, 3],
    required: false,
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  teamMemberIds?: number[];
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

export class MultisigAccountResponseDto implements SharedTypes.MultisigAccountResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  accountId: string;

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

  @ApiProperty({ type: [Object], required: false })
  signatures?: Array<{
    id: number;
    approverIndex: number;
    approverPublicKey: string;
    signatureHex: string;
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
