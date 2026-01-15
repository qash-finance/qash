/**
 * Shared Payment Link DTOs for Qash monorepo
 * 
 * These types define the contract between frontend and backend
 * for payment link management.
 */

import type { PaymentLinkStatusEnum } from '../enums/index.js';
import { PaymentLinkStatusEnum as PaymentLinkStatusEnumValue } from '../enums/index.js';
import type { TokenDto } from './token.js';
import type { NetworkDto } from './network.js';

// Shared metadata interfaces (re-exported for convenience)
export type TokenMetadata = TokenDto;
export type ChainMetadata = NetworkDto;

// Re-export enum and type alias for backwards compatibility
export { PaymentLinkStatusEnumValue as PaymentLinkStatus };
export { PaymentLinkStatusEnumValue };
export type { PaymentLinkStatusEnum };

// Request DTOs
export interface CreatePaymentLinkDto {
  title: string;
  description: string;
  amount: string;
  paymentWalletAddress: string;
  acceptedTokens?: TokenDto[];
  acceptedChains?: NetworkDto[];
}

export interface UpdatePaymentLinkDto {
  title?: string;
  description?: string;
  amount?: string;
  status?: PaymentLinkStatusEnum;
  acceptedTokens?: TokenDto[];
  acceptedChains?: NetworkDto[];
}

export interface PaymentRecordDto {
  payer: string;
  txid?: string;
  token?: TokenDto;
  chain?: NetworkDto;
}

export interface PaymentLinkOrderDto {
  linkIds: number[];
}

export interface DeletePaymentLinksDto {
  codes: string[];
}

// Response DTOs
export interface PaymentLinkRecordDto {
  id: number;
  payer: string;
  txid?: string;
  token?: TokenDto;
  chain?: NetworkDto;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PaymentLinkResponseDto {
  id: number;
  code: string;
  title: string;
  description: string;
  amount: string;
  paymentWalletAddress: string;
  status: PaymentLinkStatusEnum;
  order: number;
  acceptedTokens?: TokenDto[];
  acceptedChains?: NetworkDto[];
  records?: PaymentLinkRecordDto[];
  company: {
    companyName: string;
    metadata?: Record<string, any>;
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Type aliases for backwards compatibility
export type PaymentLink = PaymentLinkResponseDto;
export type PaymentLinkRecord = PaymentLinkRecordDto;
