import axios from "axios";

interface CurrencyRateList {
  currency: string;
  amount: number;
  transferRate: number;
}

// ============================================
// BACKGROUND RATE CACHE (CoinGecko every 60s — free, saves FastForex API calls)
// ============================================

// Background cache: populated by CoinGecko every 60s, used ONLY as fallback
const backgroundRateCache = new Map<string, { rate: number; timestamp: number }>();
const BACKGROUND_CACHE_TTL_MS = 90_000; // 90s — slightly longer than refresh interval for overlap

// FastForex API key (primary real-time provider — 150-300ms)
const FASTFOREX_API_KEY = process.env.FASTFOREX_API_KEY || '';

// Common fiat currencies to pre-cache rates for
const CACHE_FIAT_TARGETS = ['USD', 'EUR', 'GBP', 'BRL'];
// Core crypto currencies to pre-cache
const CACHE_CRYPTO_TARGETS = ['ETH', 'BTC', 'TRX', 'LTC', 'DOGE'];

/**
 * Background rate refresh — called every 60s by cron
 * Fetches ALL crypto rates from CoinGecko in minimal API calls (free)
 * If CoinGecko rate-limited → falls back to Tatum
 */
export const refreshBackgroundRateCache = async (): Promise<void> => {
  const startTime = Date.now();
  let provider = 'CoinGecko';
  let ratesUpdated = 0;
  
  try {
    // CoinGecko: Fetch ALL crypto→USD rates in 1 API call
    const coinIds = CACHE_CRYPTO_TARGETS
      .map(c => COINGECKO_IDS[c])
      .filter(Boolean)
      .join(',');
    const fiatTargets = CACHE_FIAT_TARGETS.map(f => f.toLowerCase()).join(',');
    
    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price`,
      {
        params: { ids: coinIds, vs_currencies: fiatTargets },
        timeout: 8000,
      }
    );

    // Store rates in background cache
    for (const crypto of CACHE_CRYPTO_TARGETS) {
      const coinId = COINGECKO_IDS[crypto];
      if (!coinId || !data[coinId]) continue;
      
      for (const fiat of CACHE_FIAT_TARGETS) {
        const priceInFiat = data[coinId][fiat.toLowerCase()];
        if (priceInFiat && priceInFiat > 0) {
          // Crypto→Fiat (e.g., ETH→USD = 2040)
          const cryptoToFiat = `rate_bg:${crypto}:${fiat}`;
          backgroundRateCache.set(cryptoToFiat, { rate: priceInFiat, timestamp: Date.now() });
          
          // Fiat→Crypto (e.g., USD→ETH = 1/2040)
          const fiatToCrypto = `rate_bg:${fiat}:${crypto}`;
          backgroundRateCache.set(fiatToCrypto, { rate: 1 / priceInFiat, timestamp: Date.now() });
          
          ratesUpdated += 2;
        }
      }
    }
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message?: string };
    const isRateLimited = err.response?.status === 429;
    
    if (isRateLimited) {
      console.warn(`[BackgroundCache] CoinGecko rate-limited, falling back to Tatum`);
    } else {
      console.warn(`[BackgroundCache] CoinGecko failed: ${err.message}, falling back to Tatum`);
    }
    
    // Fallback: Tatum — parallelize all rate fetches (already paid for, no extra cost)
    // Note: Some pairs may 403 (e.g., TRX→GBP) — getTatumRate handles negative caching silently
    provider = 'Tatum';
    const tatumPromises: Promise<void>[] = [];
    for (const crypto of CACHE_CRYPTO_TARGETS) {
      for (const fiat of CACHE_FIAT_TARGETS) {
        tatumPromises.push(
          (async () => {
            try {
              const priceInFiat = await getTatumRate(crypto, fiat);
              if (priceInFiat && priceInFiat > 0) {
                backgroundRateCache.set(`rate_bg:${crypto}:${fiat}`, { rate: priceInFiat, timestamp: Date.now() });
                backgroundRateCache.set(`rate_bg:${fiat}:${crypto}`, { rate: 1 / priceInFiat, timestamp: Date.now() });
                ratesUpdated += 2;
              }
            } catch {
              // Skip this pair silently
            }
          })()
        );
      }
    }
    await Promise.allSettled(tatumPromises);
    
    // Cross-rate recovery: fill gaps where direct Tatum pairs failed (e.g., TRX→BRL)
    // Strategy: crypto→USD (usually works) × USD→fiat (via USDT proxy or existing cache)
    for (const crypto of CACHE_CRYPTO_TARGETS) {
      for (const fiat of CACHE_FIAT_TARGETS) {
        const cacheKey = `rate_bg:${crypto}:${fiat}`;
        if (backgroundRateCache.has(cacheKey)) continue; // Already have it
        
        // Try cross-rate: crypto→USD × USD→fiat
        const cryptoUsdKey = `rate_bg:${crypto}:USD`;
        const usdFiatKey = `rate_bg:USD:${fiat}`;
        const cryptoUsd = backgroundRateCache.get(cryptoUsdKey);
        
        if (cryptoUsd && fiat === 'USD') {
          // Already have it via USD key
          continue;
        }
        
        // Get USD→fiat rate from existing cache or USDT proxy
        let usdToFiat = backgroundRateCache.get(usdFiatKey)?.rate;
        if (!usdToFiat) {
          // Try via any other crypto that HAS this fiat rate
          for (const otherCrypto of CACHE_CRYPTO_TARGETS) {
            const otherFiat = backgroundRateCache.get(`rate_bg:${otherCrypto}:${fiat}`)?.rate;
            const otherUsd = backgroundRateCache.get(`rate_bg:${otherCrypto}:USD`)?.rate;
            if (otherFiat && otherUsd && otherUsd > 0) {
              usdToFiat = otherFiat / otherUsd;
              break;
            }
          }
        }
        
        if (cryptoUsd && usdToFiat && usdToFiat > 0) {
          const crossRate = cryptoUsd.rate * usdToFiat;
          backgroundRateCache.set(cacheKey, { rate: crossRate, timestamp: Date.now() });
          backgroundRateCache.set(`rate_bg:${fiat}:${crypto}`, { rate: 1 / crossRate, timestamp: Date.now() });
          ratesUpdated += 2;
          console.log(`[BackgroundCache] 🔗 Cross-rate recovery: ${crypto}→${fiat} = ${crossRate.toFixed(6)} (via ${crypto}→USD × USD→${fiat})`);
        }
      }
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[BackgroundCache] ✅ Refreshed ${ratesUpdated} rates via ${provider} in ${elapsed}ms`);
};

/**
 * Get rate from background cache (populated by CoinGecko every 60s)
 * Used ONLY as fallback when real-time providers fail
 */
const getBackgroundCachedRate = (from: string, to: string): number | null => {
  const cacheKey = `rate_bg:${from}:${to}`;
  const cached = backgroundRateCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < BACKGROUND_CACHE_TTL_MS) {
      console.log(`[currencyConvert] Using background-cached rate for ${from}→${to}: ${cached.rate} (age: ${Math.floor(age / 1000)}s, source: CoinGecko/Tatum)`);
      return cached.rate;
    }
  }
  return null;
};

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

// No per-request cache — FastForex is always called fresh for real-time payments
// Background cache (CoinGecko 60s) is the ONLY fallback cache

/**
 * Tatum rate IDs — maps our currency codes to Tatum's /v3/tatum/rate/{id}
 */
const TATUM_RATE_IDS: Record<string, string> = {
  BTC: 'BTC', ETH: 'ETH', TRX: 'TRX', LTC: 'LTC', DOGE: 'DOGE',
  BCH: 'BCH', BNB: 'BNB', USDT: 'USDT', USDC: 'USDC', XRP: 'XRP',
  ADA: 'ADA', SOL: 'SOL',
};

// Negative cache for Tatum rate API failures — avoid hammering failing pairs
// Key: "tatum_fail:{crypto}:{fiat}", Value: timestamp of last failure
const tatumFailureCache = new Map<string, number>();
const TATUM_FAILURE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get crypto rate from Tatum in any fiat (already paid for, reliable, no extra cost)
 * Tatum supports basePair for any fiat: USD, EUR, GBP, CAD, AUD, JPY, CHF, etc.
 */
const getTatumRate = async (crypto: string, fiat: string = 'USD'): Promise<number | null> => {
  const id = TATUM_RATE_IDS[crypto.toUpperCase()];
  if (!id) return null;

  // Check negative cache — skip pairs that recently failed (avoids log spam)
  const failKey = `tatum_fail:${crypto}:${fiat}`;
  const lastFail = tatumFailureCache.get(failKey);
  if (lastFail && (Date.now() - lastFail) < TATUM_FAILURE_CACHE_TTL_MS) {
    return null; // Silently skip — already logged on first failure
  }

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
    const err = error as { response?: { status?: number }; message?: string };
    // Cache the failure to avoid hammering and log spam
    tatumFailureCache.set(failKey, Date.now());
    // Log once per failure window (not every cron tick)
    if (!lastFail) {
      console.warn(`[currencyConvert] Tatum rate API failed for ${crypto}→${fiat}: ${err.message} (suppressing for 10 min)`);
    }
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

  const isCryptoConversion = CRYPTO_CURRENCIES.includes(source) || CRYPTO_CURRENCIES.includes(currentCurrency);

  // Strategy 1: FastForex — ALWAYS called fresh for real-time payments (150-300ms)
  const fastForexResult = await getFastForexRate(source, currentCurrency, amount);
  if (fastForexResult) {
    rate = fastForexResult.rate;
    convertedAmount = fastForexResult.converted;
  }

  // Strategy 2: Background cache — CoinGecko rates refreshed every 60s (instant, 0 API calls)
  if (!rate) {
    rate = getBackgroundCachedRate(source, currentCurrency);
  }

  // Strategy 3: Tatum — direct fallback if FastForex + cache both failed
  if (!rate) {
    rate = await getCryptoRateViaTatum(source, currentCurrency);
  }

  // Strategy 4: CoinGecko — direct last resort
  if (!rate && isCryptoConversion) {
    rate = await getCryptoRateViaCoinGecko(source, currentCurrency);
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
