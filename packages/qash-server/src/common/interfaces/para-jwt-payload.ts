import { UserModel } from '../../database/generated/models/User';

/**
 * Para JWT Token Payload Structure
 * Based on Para's JWT token format from their documentation
 */
export interface ParaJwtPayload {
  // Standard JWT claims
  sub: string; // User ID (UUID)
  iat: number; // Issued at
  exp: number; // Expiration time

  // Para-specific data
  data: {
    userId: string; // User ID (UUID)
    email?: string; // Email (for email auth)
    phone?: string; // Phone (for phone auth)
    telegramUserId?: string; // Telegram user ID
    farcasterUsername?: string; // Farcaster username
    externalWalletAddress?: string; // External wallet address
    authType: 'email' | 'phone' | 'telegram' | 'farcaster' | 'externalWallet';
    identifier: string; // The identifier used for auth (email, phone, etc.)
    oAuthMethod?: 'google' | 'x' | 'discord' | 'facebook' | 'apple';
    wallets?: Array<{
      id: string;
      type: 'EVM' | 'SOLANA';
      address: string;
      publicKey?: string;
    }>;
  };

  // Normalized fields for our application
  email: string; // Extracted email or identifier
  userId?: string; // Alias for sub or data.userId
}

/**
 * Authenticated user payload with internal database user information
 * This is what gets attached to the request after Para JWT authentication
 */
export interface AuthenticatedUser extends ParaJwtPayload {
  internalUserId: number; // Our database user ID (integer)
  internalUser: UserModel; // Full user model from our database
}

