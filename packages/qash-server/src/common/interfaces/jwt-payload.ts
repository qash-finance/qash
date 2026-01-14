export interface JwtPayload {
  sub: number; // User ID (standard JWT claim)
  userId?: number; // Alias for sub for backward compatibility
  email: string;
  iat?: number; // Issued at (standard JWT claim)
  exp?: number; // Expiration time (standard JWT claim)
  tokenId?: string; // For refresh tokens
}
