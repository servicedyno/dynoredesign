import axios from "axios";
import { getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";

interface CurrencyRateList {
  currency: string;
  amount: number;
  transferRate: number;
}

// Cache TTL in seconds (5 minutes for crypto rates)
const RATE_CACHE_TTL = 300;

// Fallback rates (updated periodically - last update: Jan 2026)
// These are used ONLY when both API and cache fail
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  BTC: { USD: 95000, EUR: 88000, GBP: 76000 },
  ETH: { USD: 2824, EUR: 2615, GBP: 2250 },  // Updated based on recent transactions
  TRX: { USD: 0.25, EUR: 0.23, GBP: 0.20 },
  LTC: { USD: 105, EUR: 97, GBP: 84 },
  DOGE: { USD: 0.38, EUR: 0.35, GBP: 0.30 },
  BCH: { USD: 480, EUR: 445, GBP: 385 },
  USDT: { USD: 1, EUR: 0.93, GBP: 0.80 },
  USDC: { USD: 1, EUR: 0.93, GBP: 0.80 },
  BNB: { USD: 700, EUR: 650, GBP: 560 },
  USD: { BTC: 0.0000105, ETH: 0.000354, TRX: 4.0, LTC: 0.0095, DOGE: 2.63, BCH: 0.00208, USDT: 1, USDC: 1 },
};

// List of crypto currencies that need special handling
const CRYPTO_CURRENCIES = ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'BCH', 'USDT', 'USDC', 'BNB'];

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
 * Get crypto rate from CoinGecko (free, no API key required)
 */
const getCryptoRate = async (crypto: string, fiat: string): Promise<number | null> => {
  try {
    // Map our currency codes to CoinGecko IDs
    const coinGeckoIds: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      TRX: 'tron',
      LTC: 'litecoin',
      DOGE: 'dogecoin',
      BCH: 'bitcoin-cash',
      BNB: 'binancecoin',
      USDT: 'tether',
      USDC: 'usd-coin',
    };

    const coinId = coinGeckoIds[crypto.toUpperCase()];
    if (!coinId) return null;

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
  } catch (error) {
    console.warn(`[currencyConvert] CoinGecko API failed for ${crypto}→${fiat}:`, error.message);
  }
  return null;
};

/**
 * Get fallback rate from hardcoded values
 * Returns null if no fallback available
 */
const getFallbackRate = (from: string, to: string): number | null => {
  // Direct lookup
  if (FALLBACK_RATES[from] && FALLBACK_RATES[from][to]) {
    console.warn(`[currencyConvert] ⚠️ Using FALLBACK rate for ${from}→${to}: ${FALLBACK_RATES[from][to]}`);
    return FALLBACK_RATES[from][to];
  }
  
  // Try inverse lookup
  if (FALLBACK_RATES[to] && FALLBACK_RATES[to][from]) {
    const rate = 1 / FALLBACK_RATES[to][from];
    console.warn(`[currencyConvert] ⚠️ Using FALLBACK inverse rate for ${from}→${to}: ${rate}`);
    return rate;
  }
  
  // Try via USD pivot
  if (from !== "USD" && to !== "USD") {
    const fromToUSD = FALLBACK_RATES[from]?.USD;
    const toToUSD = FALLBACK_RATES[to]?.USD;
    if (fromToUSD && toToUSD) {
      const rate = fromToUSD / toToUSD;
      console.warn(`[currencyConvert] ⚠️ Using FALLBACK USD-pivot rate for ${from}→${to}: ${rate}`);
      return rate;
    }
  }
  
  return null;
};

const currencyConvert = async ({
  currency,
  sourceCurrency,
  amount,
  fixedDecimal,
}) => {
  // Validate amount parameter to prevent API errors
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    console.error(`[currencyConvert] Invalid amount: ${amount}`);
    throw new Error(`Invalid amount parameter: ${amount}`);
  }
  
  let source = sourceCurrency.toUpperCase();
  if (source.includes("USDT")) {
    source = "USDT";
  } else if (source.includes("TRON")) {
    source = "TRX";
  } else if (source.includes("BSC")) {
    source = "BNB";
  }
  let currencyRateList: CurrencyRateList[] = [];

  for (let i = 0; i < currency.length; i++) {
    const defaultCurrency: string = currency[i];
    let currentCurrency = currency[i].toUpperCase() as string;
    if (currentCurrency.includes("USDT")) {
      currentCurrency = "USDT";
    } else if (currentCurrency.includes("TRON")) {
      currentCurrency = "TRX";
    } else if (currentCurrency.includes("BSC")) {
      currentCurrency = "BNB";
    }

    if (source !== currentCurrency) {
      let rate: number | null = null;
      
      // Strategy 1: Try cached rate first
      rate = await getCachedRate(source, currentCurrency);
      
      if (!rate) {
        // Strategy 2: Check if this involves crypto - use CoinGecko
        const isCryptoConversion = CRYPTO_CURRENCIES.includes(source) || CRYPTO_CURRENCIES.includes(currentCurrency);
        
        if (isCryptoConversion) {
          // For crypto conversions, try CoinGecko first
          if (CRYPTO_CURRENCIES.includes(source) && !CRYPTO_CURRENCIES.includes(currentCurrency)) {
            // Crypto to fiat (e.g., ETH → USD)
            rate = await getCryptoRate(source, currentCurrency);
          } else if (!CRYPTO_CURRENCIES.includes(source) && CRYPTO_CURRENCIES.includes(currentCurrency)) {
            // Fiat to crypto (e.g., USD → ETH)
            const inverseRate = await getCryptoRate(currentCurrency, source);
            if (inverseRate) {
              rate = 1 / inverseRate;
            }
          } else {
            // Crypto to crypto - convert via USD
            const sourceToUSD = await getCryptoRate(source, 'USD');
            const targetToUSD = await getCryptoRate(currentCurrency, 'USD');
            if (sourceToUSD && targetToUSD) {
              rate = sourceToUSD / targetToUSD;
            }
          }
          
          // Cache the rate if we got one
          if (rate) {
            await setCachedRate(source, currentCurrency, rate);
          }
        }
        
        // Strategy 3: Try FastForex for fiat-to-fiat
        if (!rate && !isCryptoConversion) {
          try {
            const { data: { result } } = await axios.get(`https://api.fastforex.io/convert`, {
              params: {
                api_key: process.env.FAST_FOREX_KEY,
                from: source,
                to: currentCurrency,
                amount: amount,
              },
              timeout: 10000,
            });
            
            rate = result.rate;
            await setCachedRate(source, currentCurrency, rate);
          } catch (apiError) {
            console.warn(`[currencyConvert] FastForex API failed for ${source}→${currentCurrency}:`, apiError.message);
          }
        }
        
        // Strategy 4: Use fallback rates
        if (!rate) {
          rate = getFallbackRate(source, currentCurrency);
        }
      }
      
      if (rate) {
        const convertedAmount = amount * rate;
        const transferRate = fixedDecimal
          ? rate.toFixed(2)
          : rate > 1
          ? rate.toFixed(2)
          : Number(rate).toFixed(8);
        const currentCurrencyAmount = fixedDecimal
          ? convertedAmount.toFixed(2)
          : convertedAmount > 1
          ? convertedAmount.toFixed(2)
          : Number(convertedAmount).toFixed(8);

        currencyRateList.push({
          currency: defaultCurrency.toUpperCase(),
          amount: Number(currentCurrencyAmount),
          transferRate: Number(transferRate),
        });
      } else {
        // No rate available - throw error
        console.error(`[currencyConvert] ❌ No rate available for ${source}→${currentCurrency}`);
        throw new Error(`Currency conversion failed for ${source}→${currentCurrency}`);
      }
    } else {
      currencyRateList.push({
        currency: defaultCurrency.toUpperCase(),
        amount: amount,
        transferRate: 1,
      });
    }
  }
  console.log(currencyRateList);
  return currencyRateList;
};

export default currencyConvert;
