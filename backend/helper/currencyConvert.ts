import axios from "axios";
import { getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";

interface CurrencyRateList {
  currency: string;
  amount: number;
  transferRate: number;
}

// Cache TTL in seconds (5 minutes for rates)
const RATE_CACHE_TTL = 300;

// List of crypto currencies
const CRYPTO_CURRENCIES = ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'BCH', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'SOL'];

// CoinGecko ID mapping
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  TRX: 'tron',
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  BCH: 'bitcoin-cash',
  BNB: 'binancecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
  XRP: 'ripple',
  ADA: 'cardano',
  SOL: 'solana',
};

/**
 * Get cached exchange rate from Redis
 */
const getCachedRate = async (from: string, to: string): Promise<number | null> => {
  try {
    const cacheKey = `rate_cache:${from}:${to}`;
    const cached: any = await getRedisItem(cacheKey);
    if (cached && cached.rate && cached.timestamp) {
      const age = (Date.now() - Number(cached.timestamp)) / 1000;
      if (age < RATE_CACHE_TTL) {
        console.log(`[currencyConvert] Using cached rate for ${from}→${to}: ${cached.rate} (age: ${Math.floor(age)}s)`);
        return Number(cached.rate);
      }
    }
  } catch (e) {
    console.warn(`[currencyConvert] Cache read failed for ${from}→${to}`);
  }
  return null;
};

/**
 * Cache exchange rate to Redis with TTL
 */
const setCachedRate = async (from: string, to: string, rate: number): Promise<void> => {
  try {
    const cacheKey = `rate_cache:${from}:${to}`;
    await setRedisItem(cacheKey, { rate: rate.toString(), timestamp: Date.now().toString() });
    await setRedisTTL(cacheKey, RATE_CACHE_TTL);
  } catch (e) {
    console.warn(`[currencyConvert] Cache write failed for ${from}→${to}`);
  }
};

/**
 * Get rate from FastForex API (supports both crypto and fiat)
 */
const getFastForexRate = async (from: string, to: string, amount: number): Promise<{ rate: number; converted: number } | null> => {
  try {
    const { data } = await axios.get(`https://api.fastforex.io/convert`, {
      params: {
        api_key: process.env.FAST_FOREX_KEY,
        from: from,
        to: to,
        amount: amount,
      },
      timeout: 10000,
    });

    if (data.result && data.result.rate) {
      console.log(`[currencyConvert] FastForex rate for ${from}→${to}: ${data.result.rate}`);
      return {
        rate: data.result.rate,
        converted: data.result[to],
      };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message;
    console.warn(`[currencyConvert] FastForex API failed for ${from}→${to}: ${errorMsg}`);
    
    // Check if it's a plan restriction error
    if (errorMsg?.includes('No access') || errorMsg?.includes('plan') || error.response?.status === 403) {
      console.warn(`[currencyConvert] FastForex plan restriction detected, will try CoinGecko fallback`);
    }
  }
  return null;
};

/**
 * Get crypto rate from CoinGecko API (free, no API key required)
 * Used as fallback when FastForex fails or is restricted
 */
const getCoinGeckoRate = async (crypto: string, fiat: string): Promise<number | null> => {
  try {
    const coinId = COINGECKO_IDS[crypto.toUpperCase()];
    if (!coinId) {
      console.warn(`[currencyConvert] CoinGecko: Unknown crypto ${crypto}`);
      return null;
    }

    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price`,
      {
        params: {
          ids: coinId,
          vs_currencies: fiat.toLowerCase(),
        },
        timeout: 5000,
      }
    );

    const rate = response.data[coinId]?.[fiat.toLowerCase()];
    if (rate) {
      console.log(`[currencyConvert] CoinGecko rate for ${crypto}→${fiat}: ${rate}`);
      return rate;
    }
  } catch (error: any) {
    console.warn(`[currencyConvert] CoinGecko API failed for ${crypto}→${fiat}: ${error.message}`);
  }
  return null;
};

/**
 * Get rate using CoinGecko for crypto conversions
 * Handles crypto-to-fiat, fiat-to-crypto, and crypto-to-crypto
 */
const getCryptoRateViaCoinGecko = async (from: string, to: string): Promise<number | null> => {
  const fromIsCrypto = CRYPTO_CURRENCIES.includes(from.toUpperCase());
  const toIsCrypto = CRYPTO_CURRENCIES.includes(to.toUpperCase());

  if (fromIsCrypto && !toIsCrypto) {
    // Crypto to fiat (e.g., ETH → USD)
    return await getCoinGeckoRate(from, to);
  } else if (!fromIsCrypto && toIsCrypto) {
    // Fiat to crypto (e.g., USD → ETH)
    const inverseRate = await getCoinGeckoRate(to, from);
    if (inverseRate) {
      return 1 / inverseRate;
    }
  } else if (fromIsCrypto && toIsCrypto) {
    // Crypto to crypto (e.g., ETH → BTC) - convert via USD
    const fromToUSD = await getCoinGeckoRate(from, 'USD');
    const toToUSD = await getCoinGeckoRate(to, 'USD');
    if (fromToUSD && toToUSD) {
      return fromToUSD / toToUSD;
    }
  }
  return null;
};

/**
 * Normalize currency code (handle variants like USDT-TRC20, USDT-ERC20, etc.)
 */
const normalizeCurrency = (currency: string): string => {
  const upper = currency.toUpperCase();
  if (upper.includes("USDT")) return "USDT";
  if (upper.includes("USDC")) return "USDC";
  if (upper.includes("TRON") || upper === "TRX") return "TRX";
  if (upper.includes("BSC") || upper === "BNB") return "BNB";
  return upper;
};

/**
 * Process a single currency conversion
 * Returns the rate data or throws an error
 */
const processSingleCurrency = async (
  source: string,
  defaultCurrency: string,
  amount: number,
  fixedDecimal: boolean
): Promise<CurrencyRateList> => {
  const currentCurrency = normalizeCurrency(defaultCurrency);

  // Same currency - no conversion needed
  if (source === currentCurrency) {
    return {
      currency: defaultCurrency.toUpperCase(),
      amount: amount,
      transferRate: 1,
    };
  }

  let rate: number | null = null;
  let convertedAmount: number | null = null;

  // Strategy 1: Try cached rate first
  rate = await getCachedRate(source, currentCurrency);

  if (!rate) {
    // Strategy 2: Try FastForex API (primary)
    const fastForexResult = await getFastForexRate(source, currentCurrency, amount);
    if (fastForexResult) {
      rate = fastForexResult.rate;
      convertedAmount = fastForexResult.converted;
      await setCachedRate(source, currentCurrency, rate);
    }
  }

  if (!rate) {
    // Strategy 3: Try CoinGecko API (fallback for crypto)
    const isCryptoConversion = CRYPTO_CURRENCIES.includes(source) || CRYPTO_CURRENCIES.includes(currentCurrency);
    if (isCryptoConversion) {
      rate = await getCryptoRateViaCoinGecko(source, currentCurrency);
      if (rate) {
        console.log(`[currencyConvert] Using CoinGecko fallback for ${source}→${currentCurrency}: ${rate}`);
        await setCachedRate(source, currentCurrency, rate);
      }
    }
  }

  if (!rate) {
    // No rate available from any API - fail safely
    console.error(`[currencyConvert] ❌ No rate available for ${source}→${currentCurrency} - both FastForex and CoinGecko failed`);
    throw new Error(`Currency conversion failed for ${source}→${currentCurrency}. Please try again later.`);
  }

  // Calculate converted amount if not already set by FastForex
  if (convertedAmount === null) {
    convertedAmount = amount * rate;
  }

  // Format the values based on magnitude
  const transferRate = fixedDecimal
    ? rate.toFixed(2)
    : rate > 1
    ? rate.toFixed(2)
    : Number(rate).toFixed(8);

  const formattedAmount = fixedDecimal
    ? convertedAmount.toFixed(2)
    : convertedAmount > 1
    ? convertedAmount.toFixed(2)
    : Number(convertedAmount).toFixed(8);

  return {
    currency: defaultCurrency.toUpperCase(),
    amount: Number(formattedAmount),
    transferRate: Number(transferRate),
  };
};

/**
 * Main currency conversion function
 * Supports crypto-to-crypto, crypto-to-fiat, and fiat-to-fiat conversions
 * Uses FastForex as primary, CoinGecko as fallback for crypto
 * 
 * OPTIMIZED: Uses Promise.all for parallel API calls instead of sequential
 */
const currencyConvert = async ({
  currency,
  sourceCurrency,
  amount,
  fixedDecimal,
}: {
  currency: string[];
  sourceCurrency: string;
  amount: number;
  fixedDecimal: boolean;
}) => {
  // Validate amount parameter
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    console.error(`[currencyConvert] Invalid amount: ${amount}`);
    throw new Error(`Invalid amount parameter: ${amount}`);
  }

  const source = normalizeCurrency(sourceCurrency);
  
  console.log(`[currencyConvert] Processing ${currency.length} currencies in parallel...`);
  const startTime = Date.now();

  // Process all currencies in parallel using Promise.all
  const currencyRateList = await Promise.all(
    currency.map((curr) => processSingleCurrency(source, curr, amount, fixedDecimal))
  );

  const elapsed = Date.now() - startTime;
  console.log(`[currencyConvert] Completed ${currency.length} currencies in ${elapsed}ms`);
  console.log(`[currencyConvert] Results:`, currencyRateList);
  
  return currencyRateList;
};

export default currencyConvert;
