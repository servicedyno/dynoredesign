/**
 * Currency Formatting Utility
 * Provides consistent currency display across all endpoints
 * Format: "$ USD", "€ EUR", "£ GBP", "₦ NGN"
 */

// Supported base currencies for API keys
export const SUPPORTED_BASE_CURRENCIES = [
  'USD',  // US Dollar
  'EUR',  // Euro
  'GBP',  // British Pound
  'AUD',  // Australian Dollar
  'CAD',  // Canadian Dollar
  'INR',  // Indian Rupee
  'NGN',  // Nigerian Naira
  'VND',  // Vietnamese Dong
  'PKR',  // Pakistani Rupee
  'BRL',  // Brazilian Real
  'ARS',  // Argentine Peso
  'PHP',  // Philippine Peso
  'SGD',  // Singapore Dollar
  'AED',  // UAE Dirham
];

// Currency symbols mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  // Supported Base Currencies
  USD: '$',      // US Dollar
  EUR: '€',      // Euro
  GBP: '£',      // British Pound
  AUD: 'A$',     // Australian Dollar
  CAD: 'C$',     // Canadian Dollar
  INR: '₹',      // Indian Rupee
  NGN: '₦',      // Nigerian Naira
  VND: '₫',      // Vietnamese Dong
  PKR: '₨',      // Pakistani Rupee
  BRL: 'R$',     // Brazilian Real
  ARS: 'ARS$',   // Argentine Peso
  PHP: '₱',      // Philippine Peso
  SGD: 'S$',     // Singapore Dollar
  AED: 'د.إ',    // UAE Dirham
  // Legacy/Other (kept for backward compatibility)
  CHF: 'CHF', CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$',
  ZAR: 'R', KES: 'KSh', GHS: 'GH₵', MXN: 'MX$',
  // Crypto (for reference)
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
  SUPPORTED_BASE_CURRENCIES,
};

/**
 * SQL query to get company's preferred currency
 * Priority: Active production key > Active development key > Last used key (any status) > USD default
 */
export const COMPANY_CURRENCY_QUERY = `
  SELECT base_currency FROM tbl_api 
  WHERE company_id = :companyId 
  ORDER BY 
    CASE WHEN status = 'active' THEN 0 ELSE 1 END,
    CASE WHEN environment = 'production' THEN 0 ELSE 1 END, 
    "createdAt" DESC 
  LIMIT 1
`;
