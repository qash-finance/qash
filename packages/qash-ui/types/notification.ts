/**
 * Frontend-specific notification types
 * 
 * Note: Core notification DTOs and enums are imported from @qash/types
 * This file only contains UI-specific helper types
 */

import type {
  NotificationsStatusEnum,
  NotificationsTypeEnum,
  NotificationResponseDto,
  NotificationWithPaginationDto,
  UnreadCountResponseDto,
  MarkAllReadResponseDto,
} from "@qash/types";

// Re-export shared types for convenience
export type {
  NotificationsStatusEnum,
  NotificationsTypeEnum,
  NotificationResponseDto,
  NotificationWithPaginationDto,
  UnreadCountResponseDto,
  MarkAllReadResponseDto,
};

// Deprecated: Use NotificationsTypeEnum from @qash/types
// Note: Backend enum currently only has NOP - these types need to be added to backend schema
export enum NotificationType {
  SEND = "SEND",
  CLAIM = "CLAIM",
  REFUND = "REFUND",
  BATCH_SEND = "BATCH_SEND",
  WALLET_CREATE = "WALLET_CREATE",
  REQUEST_PAYMENT = "REQUEST_PAYMENT",
  GIFT_SEND = "GIFT_SEND",
  GIFT_OPEN = "GIFT_OPEN",
  GIFT_CLAIM = "GIFT_CLAIM",
  NOP = "NOP", // Backend placeholder
}

// Deprecated: Use NotificationsStatusEnum from @qash/types
export enum NotificationStatus {
  UNREAD = "UNREAD",
  READ = "READ",
}

/**
 * UI-specific notification card display type
 * Used for rendering notification components with formatted data
 * Note: Uses deprecated NotificationType until backend enum is expanded
 */
export interface NotificationCardType {
  id: number;
  type: NotificationType; // Using deprecated enum until backend is updated
  title: string;
  subtitle: string | null;
  time: string;
  amount: string;
  tokenAddress: string;
  tokenName: string;
  address: string;
  payee: string;
  recipientCount: number;
  isRead: boolean;
  transactionId: string;
  giftOpener: string;
}

// Deprecated: Use NotificationWithPaginationDto from @qash/types
export interface NotificationResponse {
  notifications: NotificationResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

