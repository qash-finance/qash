// Basic Token and Network types
export interface TokenDto {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  maxSupply?: number;
}