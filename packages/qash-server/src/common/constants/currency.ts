export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY',
  AUD = 'AUD',
  CAD = 'CAD',
  CHF = 'CHF',
  CNY = 'CNY',
  HKD = 'HKD',
  INR = 'INR',
  MXN = 'MXN',
  VND = 'VND',
  MYR = 'MYR',
  PHP = 'PHP',
  SGD = 'SGD',
  THB = 'THB',
  TWD = 'TWD',
}

/**
 * Currency symbols map for display formatting
 */
export const CurrencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF ',
  CNY: '¥',
  HKD: 'HK$',
  INR: '₹',
  MXN: 'MX$',
  VND: '₫',
  MYR: 'RM',
  PHP: '₱',
  SGD: 'S$',
  THB: '฿',
  TWD: 'NT$',
};
