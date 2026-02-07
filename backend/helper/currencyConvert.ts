import axios from "axios";
import { getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";

interface CurrencyRateList {
  currency: string;
  amount: number;
  transferRate: number;
}

// Cache TTL in seconds
const RATE_CACHE_TTL = 5; // 5 seconds — crypto prices change rapidly

// In-memory rate cache (Layer 1 — zero latency, survives Redis disconnects)
const memoryRateCache = new Map<string, { rate: number; timestamp: number }>();
const MEMORY_CACHE_TTL_MS = 5_000; // 5 seconds — matches user requirement for crypto freshness

// FastForex API key (primary rate provider — 150-300ms vs Tatum's 1-6s)
const FASTFOREX_API_KEY = process.env.FASTFOREX_API_KEY || '';

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
 * Get cached exchange rate — checks in-memory cache first, then Redis
 */
const getCachedRate = async (from: string, to: string): Promise<number | null> => {
  const cacheKey = `rate_cache:${from}:${to}`;
  
  // Layer 1: In-memory cache (instant, no network)
  const memCached = memoryRateCache.get(cacheKey);
  if (memCached) {
    const age = Date.now() - memCached.timestamp;
    if (age < MEMORY_CACHE_TTL_MS) {
      console.log(`[currencyConvert] Using memory-cached rate for ${from}→${to}: ${memCached.rate} (age: ${Math.floor(age / 1000)}s)`);
      return memCached.rate;
    }
    memoryRateCache.delete(cacheKey); // expired
  }
  
  // Layer 2: Redis cache (survives server restart)
  try {
    const cached = await getRedisItem(cacheKey) as { rate?: string; timestamp?: string } | null;
    if (cached && cached.rate && cached.timestamp) {
      const age = (Date.now() - Number(cached.timestamp)) / 1000;
      if (age < RATE_CACHE_TTL) {
        const rate = Number(cached.rate);
        // Populate memory cache from Redis hit
        memoryRateCache.set(cacheKey, { rate, timestamp: Date.now() });
        console.log(`[currencyConvert] Using Redis-cached rate for ${from}→${to}: ${rate} (age: ${Math.floor(age)}s)`);
        return rate;
      }
    }
  } catch (e) {
    console.warn(`[currencyConvert] Cache read failed for ${from}→${to}`);
  }
  return null;
};

/**
 * Cache exchange rate to both memory and Redis
 */
const setCachedRate = async (from: string, to: string, rate: number): Promise<void> => {
  const cacheKey = `rate_cache:${from}:${to}`;
  
  // Layer 1: Always write to memory cache (instant, reliable)
  memoryRateCache.set(cacheKey, { rate, timestamp: Date.now() });
  
  // Layer 2: Write to Redis (best-effort, survives restart)
  try {
    await setRedisItem(cacheKey, { rate: rate.toString(), timestamp: Date.now().toString() });
    await setRedisTTL(cacheKey, RATE_CACHE_TTL);
  } catch (e) {
    console.warn(`[currencyConvert] Cache write failed for ${from}→${to}`);
  }
};

/**
 * Tatum rate IDs — maps our currency codes to Tatum's /v3/tatum/rate/{id}
 */
const TATUM_RATE_IDS: Record<string, string> = {
  BTC: 'BTC', ETH: 'ETH', TRX: 'TRX', LTC: 'LTC', DOGE: 'DOGE',
  BCH: 'BCH', BNB: 'BNB', USDT: 'USDT', USDC: 'USDC', XRP: 'XRP',
  ADA: 'ADA', SOL: 'SOL',
};

/**
 * Get crypto rate from Tatum in any fiat (already paid for, reliable, no extra cost)
 * Tatum supports basePair for any fiat: USD, EUR, GBP, CAD, AUD, JPY, CHF, etc.
 */
const getTatumRate = async (crypto: string, fiat: string = 'USD'): Promise<number | null> => {
  const id = TATUM_RATE_IDS[crypto.toUpperCase()];
  if (!id) return null;

  const apiKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
  if (!apiKey) {
    console.warn(`[currencyConvert] Tatum: no API key configured`);
    return null;
  }

  try {
    const { data } = await axios.get(
      `https://api.tatum.io/v3/tatum/rate/${id}`,
      {
        params: { basePair: fiat.toUpperCase() },
        headers: { 'x-api-key': apiKey },
        timeout: 15000,
      }
    );
    const rate = parseFloat(data?.value);
    if (rate > 0) {
      console.log(`[currencyConvert] Tatum rate for ${crypto}→${fiat}: ${rate}`);
      return rate;
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.warn(`[currencyConvert] Tatum rate API failed for ${crypto}→${fiat}: ${err.message}`);
  }
  return null;
};

/**
 * Get rate using Tatum for crypto conversions
 * Handles crypto-to-fiat, fiat-to-crypto, crypto-to-crypto, AND fiat-to-fiat (via USDT proxy)
 * Uses Tatum's basePair to get direct fiat rates (EUR, GBP, etc.) — no USD intermediary needed
 */
const getCryptoRateViaTatum = async (from: string, to: string): Promise<number | null> => {
  const fromIsCrypto = CRYPTO_CURRENCIES.includes(from.toUpperCase());
  const toIsCrypto = CRYPTO_CURRENCIES.includes(to.toUpperCase());
  const isStable = (c: string) => ['USDT', 'USDC'].includes(c.toUpperCase());

  if (fromIsCrypto && !toIsCrypto) {
    // Crypto → fiat (e.g., BTC → EUR) — Tatum returns crypto price in target fiat directly
    if (isStable(from)) return 1;
    const priceInFiat = await getTatumRate(from, to);
    if (priceInFiat) return priceInFiat;  // This is "1 BTC = X EUR"
  } else if (!fromIsCrypto && toIsCrypto) {
    // Fiat → crypto (e.g., EUR → BTC) — invert: 1/price
    if (isStable(to)) return 1;
    const priceInFiat = await getTatumRate(to, from);
    if (priceInFiat) return 1 / priceInFiat;  // "1 EUR = 1/X BTC"
  } else if (fromIsCrypto && toIsCrypto) {
    // Crypto → crypto (e.g., ETH → BTC) — convert via USD
    const fromUSD = isStable(from) ? 1 : await getTatumRate(from, 'USD');
    const toUSD = isStable(to) ? 1 : await getTatumRate(to, 'USD');
    if (fromUSD && toUSD) return fromUSD / toUSD;
  } else {
    // Fiat → fiat (e.g., GBP → USD, EUR → CAD) — use USDT as USD proxy
    // USDT ≈ $1 USD, so USDT→GBP rate ≈ USD→GBP rate
    const fromRate = from.toUpperCase() === 'USD' ? 1 : await getTatumRate('USDT', from);
    const toRate = to.toUpperCase() === 'USD' ? 1 : await getTatumRate('USDT', to);
    if (fromRate && toRate) {
      // fromRate = "1 USDT in FROM currency", toRate = "1 USDT in TO currency"
      const rate = toRate / fromRate;
      console.log(`[currencyConvert] Tatum fiat rate ${from}→${to}: ${rate} (via USDT proxy)`);
      return rate;
    }
  }
  return null;
};

/**
 * Get rate from FastForex API (primary provider — 150-300ms)
 * Uses fetch-one endpoint for optimal speed
 */
const getFastForexRate = async (from: string, to: string, amount: number): Promise<{ rate: number; converted: number } | null> => {
  const apiKey = FASTFOREX_API_KEY || process.env.FAST_FOREX_KEY;
  if (!apiKey) return null;
  
  try {
    const { data } = await axios.get(`https://api.fastforex.io/fetch-one`, {
      params: {
        api_key: apiKey,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
      },
      timeout: 5000,
    });

    if (data.result) {
      const rate = data.result[to.toUpperCase()];
      if (rate && rate > 0) {
        console.log(`[currencyConvert] FastForex rate for ${from}→${to}: ${rate} (${data.ms}ms server)`);
        return {
          rate: rate,
          converted: amount * rate,
        };
      }
    }
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string }; status?: number }; message?: string };
    const errorMsg = err.response?.data?.error || err.message;
    console.warn(`[currencyConvert] FastForex API failed for ${from}→${to}: ${errorMsg}`);
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
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.warn(`[currencyConvert] CoinGecko API failed for ${crypto}→${fiat}: ${err.message}`);
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

  // Strategy 1: Try cached rate first (memory → Redis, 5s TTL)
  rate = await getCachedRate(source, currentCurrency);

  const isCryptoConversion = CRYPTO_CURRENCIES.includes(source) || CRYPTO_CURRENCIES.includes(currentCurrency);

  // Strategy 2: FastForex — PRIMARY provider (150-300ms, supports crypto + fiat)
  if (!rate) {
    const fastForexResult = await getFastForexRate(source, currentCurrency, amount);
    if (fastForexResult) {
      rate = fastForexResult.rate;
      convertedAmount = fastForexResult.converted;
      await setCachedRate(source, currentCurrency, rate);
    }
  }

  // Strategy 3: Tatum — fallback for crypto conversions
  if (!rate) {
    rate = await getCryptoRateViaTatum(source, currentCurrency);
    if (rate) {
      await setCachedRate(source, currentCurrency, rate);
    }
  }

  // Strategy 4: CoinGecko — last resort for crypto
  if (!rate && isCryptoConversion) {
    rate = await getCryptoRateViaCoinGecko(source, currentCurrency);
    if (rate) {
      console.log(`[currencyConvert] CoinGecko rate for ${source}→${currentCurrency}: ${rate}`);
      await setCachedRate(source, currentCurrency, rate);
    }
  }

  if (!rate) {
    console.error(`[currencyConvert] ❌ No rate available for ${source}→${currentCurrency} - all providers failed (FastForex, Tatum, CoinGecko)`);
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
