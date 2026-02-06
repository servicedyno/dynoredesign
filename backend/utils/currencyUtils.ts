/**
 * Currency Formatting Utility
 * Provides consistent currency display across all endpoints
 * Format: "$ USD", "€ EUR", "£ GBP", "₦ NGN"
 */

// Currency symbols mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  // Major International
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CHF: 'CHF',
  CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$', SGD: 'S$',
  // Latin America
  BRL: 'R$', ARS: 'ARS', COP: 'COP', CLP: 'CLP', PEN: 'S/', MXN: 'MX$', VES: 'Bs.', UYU: '$U',
  // African
  NGN: '₦', ZAR: 'R', KES: 'KSh', GHS: 'GH₵', TZS: 'TSh', XAF: 'FCFA', XOF: 'CFA', EGP: 'E£', MAD: 'MAD',
  UGX: 'USh', RWF: 'FRw', ETB: 'Br', ZMW: 'ZK', BWP: 'P', MUR: '₨', AOA: 'Kz', MZN: 'MT', CDF: 'FC',
  // Crypto (for reference, though these shouldn't be base currencies)
  BTC: '₿', ETH: 'Ξ', USDT: '₮', USDC: 'USDC',
};

/**
 * Get currency symbol for a currency code
 * @param currency - ISO 4217 currency code
 * @returns Symbol string (e.g., '$', '€', '₦')
 */
export const getCurrencySymbol = (currency: string): string => {
  return CURRENCY_SYMBOLS[currency?.toUpperCase()] || currency || '';
};

/**
 * Format amount with symbol and currency code
 * @param amount - Numeric amount
 * @param currency - ISO 4217 currency code
 * @param includeCode - Whether to append currency code (default: true)
 * @returns Formatted string like "$1,234.56 USD" or "€1.234,56 EUR"
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  includeCode: boolean = true
): string => {
  const symbol = getCurrencySymbol(currency);
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  if (includeCode) {
    return `${symbol}${formattedAmount} ${currency}`;
  }
  return `${symbol}${formattedAmount}`;
};

/**
 * Format amount for display (returns object with all components)
 * @param amount - Numeric amount
 * @param currency - ISO 4217 currency code
 * @returns Object with symbol, amount, code, and formatted string
 */
export const formatAmountForDisplay = (
  amount: number,
  currency: string = 'USD'
): {
  symbol: string;
  amount: number;
  amount_formatted: string;
  currency_code: string;
  display_value: string;
} => {
  const symbol = getCurrencySymbol(currency);
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return {
    symbol,
    amount,
    amount_formatted: formattedAmount,
    currency_code: currency,
    display_value: `${symbol}${formattedAmount} ${currency}`,
  };
};

/**
 * Get currency info object for API responses
 * Provides consistent currency information across all endpoints
 */
export const getCurrencyInfo = (currency: string = 'USD'): {
  code: string;
  symbol: string;
  display_format: string;
} => {
  const symbol = getCurrencySymbol(currency);
  return {
    code: currency,
    symbol,
    display_format: `${symbol} ${currency}`, // e.g., "$ USD", "€ EUR"
  };
};

export default {
  getCurrencySymbol,
  formatCurrency,
  formatAmountForDisplay,
  getCurrencyInfo,
  CURRENCY_SYMBOLS,
};
