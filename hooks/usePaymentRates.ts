import { useState, useEffect, useRef, useCallback } from "react";
import axiosBaseApi from "@/axiosConfig";

interface CurrencyRate {
  currency: string;
  amount: number;
  [key: string]: any;
}

interface UsePaymentRatesOptions {
  source: string;
  amount: number;
  currencyList: string[];
  fixedDecimal?: boolean;
  enabled?: boolean;
}

interface UsePaymentRatesReturn {
  rates: CurrencyRate[] | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Module-level cache to share across all payment component instances
const ratesCache: Record<string, { data: CurrencyRate[]; timestamp: number }> = {};
const CACHE_TTL_MS = 30_000; // 30 seconds

function buildCacheKey(source: string, amount: number, currencyList: string[]): string {
  return `${source}:${amount}:${[...currencyList].sort().join(",")}`;
}

/**
 * Shared hook for fetching currency rates.
 * Deduplicates identical requests across payment components and caches results.
 */
export function usePaymentRates({
  source,
  amount,
  currencyList,
  fixedDecimal = false,
  enabled = true,
}: UsePaymentRatesOptions): UsePaymentRatesReturn {
  const [rates, setRates] = useState<CurrencyRate[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchRates = useCallback(async () => {
    if (!source || !amount || !currencyList.length) return;

    const cacheKey = buildCacheKey(source, amount, currencyList);
    const cached = ratesCache[cacheKey];

    // Return cached if still fresh
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setRates(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { data },
      } = await axiosBaseApi.post("/wallet/getCurrencyRates", {
        source,
        amount,
        currencyList,
        fixedDecimal,
      });

      // Update cache
      ratesCache[cacheKey] = { data, timestamp: Date.now() };

      if (mountedRef.current) {
        setRates(data);
        setLoading(false);
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setError(e?.response?.data?.message ?? e?.message ?? "Failed to fetch rates");
        setLoading(false);
      }
    }
  }, [source, amount, currencyList.join(","), fixedDecimal]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      fetchRates();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [fetchRates, enabled]);

  return { rates, loading, error, refetch: fetchRates };
}

export default usePaymentRates;
