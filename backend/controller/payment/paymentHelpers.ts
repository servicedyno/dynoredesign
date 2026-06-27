/**
 * Generic, side-effect-light payment helpers.
 * Extracted verbatim from paymentController.ts (no behavior change).
 */
import { convertToUSD as convertToUSDUtil } from "../../utils/currencyUtils";
import { getErrorMessage } from "../../helper";
import { cronLogger } from "../../utils/loggers";
import { RETRY_CONFIG } from "./paymentConfig";

/**
 * Convert crypto amount to USD
 * Used for displaying pending amounts in USD
 * Returns NaN on conversion failure so callers can detect and handle it
 */
export const convertToUSD = async (amount: number, currency: string): Promise<number> => {
  try {
    if (!amount || amount <= 0) return 0;
    const result = await convertToUSDUtil(currency, amount);
    if (result === undefined || result === null || isNaN(result)) {
      cronLogger.error(`[convertToUSD] Conversion returned invalid value for ${amount} ${currency}: ${result}`);
      return NaN;
    }
    return result;
  } catch (error) {
    cronLogger.error(`[convertToUSD] Failed to convert ${amount} ${currency} to USD:`, error);
    return NaN;
  }
};

/**
 * Retry helper with exponential backoff for blockchain operations
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = RETRY_CONFIG.MAX_RETRIES
): Promise<T> => {
  let lastError: Error = new Error('Operation failed');

  // Hard failures that should NOT be retried (invalid data, auth issues, permanent errors)
  const NON_RETRYABLE_ERRORS = [
    'invalid address',
    'invalid private key',
    'insufficient balance',
    'insufficient funds',
    'nonce too low',
    'replacement transaction underpriced',
    'already known',
    'invalid signature',
    'bad request',
    'unauthorized',
    'forbidden',
    'not found',
    '400',
    '401',
    '403',
    '404',
  ];

  const isRetryable = (error: Error): boolean => {
    const message = error.message?.toLowerCase() || '';
    return !NON_RETRYABLE_ERRORS.some(pattern => message.includes(pattern.toLowerCase()));
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const message = getErrorMessage(error);

      // Check if error is retryable (soft failure like network timeout, rate limit)
      if (!isRetryable(lastError)) {
        cronLogger.error(`[PaymentController] ❌ ${operationName} failed with non-retryable error: ${message}`);
        throw lastError; // Don't retry hard failures
      }

      if (attempt < maxRetries) {
        const waitTime = RETRY_CONFIG.INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        cronLogger.warn(`[PaymentController] ⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}): ${message}`);
        cronLogger.warn(`[PaymentController] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        cronLogger.error(`[PaymentController] ❌ ${operationName} failed after ${maxRetries} attempts: ${message}`);
      }
    }
  }

  throw lastError;
};
