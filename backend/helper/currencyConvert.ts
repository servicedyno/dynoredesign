import axios from "axios";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";

interface CurrencyRateList {
  currency: string;
  amount: number;
  transferRate: number;
}

// Cache TTL in seconds (1 hour)
const RATE_CACHE_TTL = 3600;

// Fallback rates (updated periodically - last update: Jan 2026)
// These are used ONLY when both API and cache fail
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  BTC: { USD: 95000, EUR: 88000, GBP: 76000 },
  ETH: { USD: 3400, EUR: 3150, GBP: 2700 },
  TRX: { USD: 0.25, EUR: 0.23, GBP: 0.20 },
  LTC: { USD: 105, EUR: 97, GBP: 84 },
  DOGE: { USD: 0.38, EUR: 0.35, GBP: 0.30 },
  BCH: { USD: 480, EUR: 445, GBP: 385 },
  USDT: { USD: 1, EUR: 0.93, GBP: 0.80 },
  USDC: { USD: 1, EUR: 0.93, GBP: 0.80 },
  BNB: { USD: 700, EUR: 650, GBP: 560 },
  USD: { BTC: 0.0000105, ETH: 0.000294, TRX: 4.0, LTC: 0.0095, DOGE: 2.63, BCH: 0.00208, USDT: 1, USDC: 1 },
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
 * Cache exchange rate to Redis
 */
const setCachedRate = async (from: string, to: string, rate: number): Promise<void> => {
  try {
    const cacheKey = `rate_cache:${from}:${to}`;
    await setRedisItem(cacheKey, { rate, timestamp: Date.now() });
  } catch (e) {
    console.warn(`[currencyConvert] Cache write failed for ${from}→${to}`);
  }
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
  // Validate amount parameter to prevent FastForex API errors
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
      let apiSucceeded = false;
      
      // Strategy 1: Try API first
      try {
        const {
          data: { result },
        } = await axios.get(`https://api.fastforex.io/convert`, {
          params: {
            api_key: process.env.FAST_FOREX_KEY,
            from: source,
            to: currentCurrency,
            amount: amount,
          },
          timeout: 10000, // 10 second timeout
        });
        
        console.log(currentCurrency, result[currentCurrency], result);
        rate = result.rate;
        apiSucceeded = true;
        
        // Cache the successful rate
        await setCachedRate(source, currentCurrency, rate);
        
        const transferRate = fixedDecimal
          ? result.rate.toFixed(2)
          : result.rate > 1
          ? result.rate.toFixed(2)
          : Number(result.rate).toFixed(8);
        const currentCurrencyAmount = fixedDecimal
          ? result[currentCurrency].toFixed(2)
          : result[currentCurrency] > 1
          ? result[currentCurrency].toFixed(2)
          : Number(result[currentCurrency]).toFixed(8);

        currencyRateList.push({
          currency: defaultCurrency.toUpperCase(),
          amount: Number(currentCurrencyAmount),
          transferRate: Number(transferRate),
        });
        
      } catch (apiError) {
        console.error(`[currencyConvert] API failed for ${source}→${currentCurrency}:`, apiError.message);
        
        // Strategy 2: Try cached rate
        rate = await getCachedRate(source, currentCurrency);
        
        // Strategy 3: Try fallback rates
        if (!rate) {
          rate = getFallbackRate(source, currentCurrency);
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
          // No fallback available - throw error
          console.error(`[currencyConvert] ❌ No fallback available for ${source}→${currentCurrency}`);
          throw new Error(`Currency conversion failed and no fallback available for ${source}→${currentCurrency}`);
        }
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
