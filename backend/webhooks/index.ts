import express from "express";
import crypto from "crypto";
import { apiLogger, webhookLogs} from "../utils/loggers";
import { getErrorMessage } from "../helper";
import { ITatumWebHook, IWebHook } from "../utils/types";
import { getRedisItem, setRedisItem, setRedisTTL, setRedisItemWithTTL } from "../utils/redisInstance";
import axios from "axios";
import { paymentController } from "../controller";
import { sendPendingPaymentNotification } from "../services/pendingPaymentService";
import { QueryTypes } from "sequelize";
import { getCompanyBaseCurrency, convertToFiat } from "../utils/currencyUtils";
import { ADMIN_WALLETS, FEE_WALLETS, isTagBasedChain, getCryptoRedisKey, XRP_MASTER_ADDRESS } from "../services/merchantPool/merchantPoolConfig";
import tatumApi from "../apis/tatumApi";
import { merchantTempAddressModel } from "../models";
import { enqueueWebhook } from "../services/webhookQueue";
import { toRedisStatus, PaymentState } from "../services/paymentStateMachine";

// Build a set of all admin/fee wallet addresses for fast lookup (lowercase for case-insensitive match)
const INTERNAL_WALLETS = new Set(
  [...Object.values(ADMIN_WALLETS), ...Object.values(FEE_WALLETS)]
    .filter(Boolean)
    .map(addr => addr.toLowerCase())
);

// FIX BUG-3: Track consecutive webhook delivery failures per URL
// Resets on successful delivery. Alerts admin after 3+ consecutive failures.
const webhookFailureTracker = new Map<string, number>();

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * @param payload - The webhook payload object
 * @param secret - The webhook secret key
 * @returns Hex-encoded HMAC signature
 */
const generateWebhookSignature = (payload: unknown, secret: string): string => {
  const payloadString = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadString);
  return hmac.digest('hex');
};

/**
 * Verify webhook signature (for merchants to use on their end)
 * @param payload - The received payload string
 * @param signature - The signature from X-DynoPay-Signature header
 * @param secret - The webhook secret
 * @returns boolean - true if signature is valid
 */
export const verifyWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
};

/**
 * Log webhook delivery to database for history/dashboard
 */
const logWebhookDelivery = async (
  companyId: number,
  webhookUrl: string,
  eventType: string,
  webhookId: string,
  payload: unknown,
  status: 'success' | 'failed',
  responseStatus: number | null,
  responseTimeMs: number,
  errorMessage: string | null,
  retryCount: number
): Promise<void> => {
  try {
    const sequelize = require('../utils/dbInstance').default;
    await sequelize.query(
      `INSERT INTO tbl_webhook_delivery_log 
       (company_id, webhook_url, event_type, webhook_id, payload, status, response_status, response_time_ms, error_message, retry_count, created_at, completed_at)
       VALUES (:companyId, :webhookUrl, :eventType, :webhookId, :payload, :status, :responseStatus, :responseTimeMs, :errorMessage, :retryCount, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      {
        replacements: {
          companyId,
          webhookUrl,
          eventType,
          webhookId,
          payload: JSON.stringify(payload),
          status,
          responseStatus,
          responseTimeMs,
          errorMessage,
          retryCount,
        },
        type: QueryTypes.INSERT,
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    webhookLogs.error(`[logWebhookDelivery] Failed to log webhook: ${errorMsg}`);
  }
};

/**
 * Call merchant's webhook URL with payment event
 * Merchants can configure webhook_url when creating payment links
 * 
 * Webhook Headers:
 * - Content-Type: application/json
 * - X-DynoPay-Event: payment.pending | payment.confirmed
 * - X-DynoPay-Signature: HMAC-SHA256 signature (only if webhook_secret is configured)
 * - X-DynoPay-Timestamp: Unix timestamp of when webhook was sent
 * 
 * Note: webhook_secret is OPTIONAL. If not configured, X-DynoPay-Signature will not be included.
 */
interface WebhookResult {
  success: boolean;
  error?: string;
  url?: string;
}

const callMerchantWebhook = async (customerData: Record<string, unknown>, eventData: Record<string, unknown>): Promise<WebhookResult> => {
  try {
    // Get webhook URL, callback URL, and secret from payment link or company settings
    const sequelize = require('../utils/dbInstance').default;
    
    let webhookUrl = null;
    let callbackUrl = null;
    let webhookSecret = null;
    let companyId = customerData?.company_id;
    
    // First, check if webhook_url was passed directly with the payment (e.g. merchant crypto payment API stores it in Redis)
    if (customerData?.webhook_url) {
      webhookUrl = customerData.webhook_url as string;
      callbackUrl = (customerData?.callback_url as string) || null;
      webhookSecret = (customerData?.webhook_secret as string) || null;
      webhookLogs.info(`[callMerchantWebhook] Using webhook URL from payment data: ${webhookUrl}`);
    }
    
    // Then try payment link record (for payment link flow)
    const linkId = customerData?.link_id || customerData?.payment_link_id;
    if (linkId && !webhookUrl) {
      const [linkResult] = await sequelize.query(
        `SELECT webhook_url, callback_url FROM tbl_payment_link WHERE link_id = :linkId`,
        { replacements: { linkId }, type: QueryTypes.SELECT }
      );
      webhookUrl = linkResult?.webhook_url;
      callbackUrl = linkResult?.callback_url;
    }
    
    // If no webhook on link, try company settings
    if (!webhookUrl && companyId) {
      const [companyResult] = await sequelize.query(
        `SELECT webhook_url, webhook_secret FROM tbl_company WHERE company_id = :companyId`,
        { replacements: { companyId }, type: QueryTypes.SELECT }
      );
      webhookUrl = companyResult?.webhook_url;
      webhookSecret = companyResult?.webhook_secret;
    }
    
    // If still no webhook, check the active API key for this company (for API-initiated payments)
    if (!webhookUrl && !callbackUrl && companyId) {
      const [apiResult] = await sequelize.query(
        `SELECT webhook_url, webhook_secret FROM tbl_api WHERE company_id = :companyId AND status = 'active' ORDER BY api_id DESC LIMIT 1`,
        { replacements: { companyId }, type: QueryTypes.SELECT }
      );
      if (apiResult?.webhook_url) {
        webhookUrl = apiResult.webhook_url;
        if (!webhookSecret) webhookSecret = apiResult.webhook_secret;
        webhookLogs.info(`[callMerchantWebhook] Found webhook URL from API key for company ${companyId}: ${webhookUrl}`);
      }
    }
    
    // If neither webhook_url nor callback_url configured, skip
    if (!webhookUrl && !callbackUrl) {
      webhookLogs.info("[callMerchantWebhook] No webhook URL or callback URL configured (checked: payment_link, company, API key), skipping");
      return { success: true }; // No webhook configured is not an error
    }
    
    // Validate webhook URL - localhost URLs won't work from cloud server
    const urlToCheck = webhookUrl || callbackUrl;
    if (urlToCheck && (urlToCheck.includes('localhost') || urlToCheck.includes('127.0.0.1'))) {
      const errorMsg = `Webhook URL "${urlToCheck}" uses localhost which is unreachable from Dynopay servers. Please use a public URL.`;
      webhookLogs.error(`[callMerchantWebhook] ❌ ${errorMsg}`);
      return { success: false, error: errorMsg, url: urlToCheck };
    }
    
    let lastResult: WebhookResult = { success: true };
    
    // Enrich event data with fiat equivalent in the merchant's preferred currency
    const enrichedEventData = { ...eventData };
    if (eventData.amount && eventData.currency && companyId) {
      try {
        const preferredCurrency = await getCompanyBaseCurrency(companyId as string | number);
        const cryptoAmount = Number(eventData.amount);
        if (cryptoAmount > 0 && preferredCurrency) {
          const fiatResult = await convertToFiat(String(eventData.currency), preferredCurrency, cryptoAmount);
          if (fiatResult.amount > 0) {
            enrichedEventData.base_amount = Number(fiatResult.amount.toFixed(2));
            enrichedEventData.base_currency = preferredCurrency;
            enrichedEventData.exchange_rate = fiatResult.rate;
          }
        }
      } catch (convErr) {
        // Non-blocking — send webhook without fiat enrichment
        webhookLogs.warn(`[callMerchantWebhook] Fiat enrichment failed:`, convErr);
      }
    }
    // Preserve any base_amount/base_currency already set by the caller
    if (eventData.base_amount) enrichedEventData.base_amount = eventData.base_amount;
    if (eventData.base_currency) enrichedEventData.base_currency = eventData.base_currency;
    
    // Call callback_url first (instant notification, synchronous)
    if (callbackUrl) {
      lastResult = await callUrlWithPayload(callbackUrl, enrichedEventData, webhookSecret, Number(companyId), 'callback');
    }
    
    // Then call webhook_url (transaction updates, can be same or different)
    if (webhookUrl && webhookUrl !== callbackUrl) {
      lastResult = await callUrlWithPayload(webhookUrl, enrichedEventData, webhookSecret, Number(companyId), 'webhook');
    } else if (webhookUrl && !callbackUrl) {
      // If only webhook_url is configured (no callback_url)
      lastResult = await callUrlWithPayload(webhookUrl, enrichedEventData, webhookSecret, Number(companyId), 'webhook');
    }
    
    return lastResult;
    
  } catch (error: unknown) {
    // Log but don't throw - webhook failure shouldn't block payment processing
    const errorMsg = error instanceof Error ? error.message : String(error);
    webhookLogs.error(`[callMerchantWebhook] Failed to send webhook: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
};

/**
 * Helper function to call a URL with webhook payload
 */
const callUrlWithPayload = async (
  url: string, 
  eventData: Record<string, unknown>, 
  webhookSecret: string | null, 
  companyId: number | null,
  urlType: 'webhook' | 'callback'
): Promise<WebhookResult> => {
  try {
    if (!url) return { success: true };
    
    // Add metadata to payload
    const timestamp = Math.floor(Date.now() / 1000);
    const webhookPayload = {
      ...eventData,
      webhook_id: crypto.randomUUID(),
      sent_at: new Date().toISOString(),
    };
    
    // Build headers - signature is optional
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-DynoPay-Event': String(eventData.event || ''),
      'X-DynoPay-Timestamp': timestamp.toString(),
      'X-DynoPay-Webhook-Id': String(webhookPayload.webhook_id),
      'X-DynoPay-Type': urlType, // 'webhook' or 'callback'
      'User-Agent': 'Dynopay-Webhook/1.0',
    };
    
    // Only add signature header if secret is configured
    if (webhookSecret) {
      const signaturePayload = { ...webhookPayload, timestamp };
      headers['X-DynoPay-Signature'] = generateWebhookSignature(signaturePayload, webhookSecret);
    }
    
    webhookLogs.info(`[callMerchantWebhook] Sending ${urlType} ${eventData.event} to ${url}`);
    webhookLogs.info(`[callMerchantWebhook] Signature included: ${!!webhookSecret}`);
    // Log payload for debugging (truncate large payloads)
    const payloadStr = JSON.stringify(webhookPayload);
    webhookLogs.info(`[callMerchantWebhook] Payload (${payloadStr.length} bytes): ${payloadStr.substring(0, 500)}${payloadStr.length > 500 ? '...' : ''}`);
    
    // Send webhook with timeout and retry
    const maxRetries = 3;
    let lastError: Error | null = null;
    let finalResponseStatus: number | null = null;
    let totalRetries = 0;
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(url, webhookPayload, {
          timeout: 10000,
          headers,
        });
        
        const responseTimeMs = Date.now() - startTime;
        finalResponseStatus = response.status;
        
        webhookLogs.info(`[callMerchantWebhook] ✅ ${urlType} sent successfully, status: ${response.status}`);
        
        // FIX BUG-3: Reset failure counter on success
        const successFailKey = `webhook-failures:${url}`;
        if (webhookFailureTracker.has(successFailKey)) {
          webhookFailureTracker.delete(successFailKey);
        }
        
        // Log successful delivery
        if (companyId) {
          await logWebhookDelivery(
            companyId,
            url,
            String(eventData.event || ''),
            webhookPayload.webhook_id,
            webhookPayload,
            'success',
            response.status,
            responseTimeMs,
            null,
            totalRetries
          );
        }
        
        return { success: true, url }; // Success
        
      } catch (err: unknown) {
        const error = err as { response?: { status?: number; data?: unknown }; message?: string; code?: string };
        lastError = error as Error;
        totalRetries = attempt;
        finalResponseStatus = error.response?.status || null;
        
        // Capture response body for debugging
        const responseBody = error.response?.data;
        const responseBodyStr = responseBody 
          ? (typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody))
          : null;
        
        // Build descriptive error message
        let errorMessage = error.code === 'ECONNREFUSED' 
          ? `Connection refused - server at ${url} is not reachable`
          : error.code === 'ETIMEDOUT'
          ? `Connection timed out - server at ${url} did not respond`
          : error.message || 'Unknown error';
        
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (finalResponseStatus && finalResponseStatus >= 400 && finalResponseStatus < 500 && finalResponseStatus !== 429) {
          webhookLogs.error(`[callMerchantWebhook] ❌ Client error ${finalResponseStatus}, not retrying: ${errorMessage}`);
          if (responseBodyStr) {
            webhookLogs.error(`[callMerchantWebhook] ❌ Response body: ${responseBodyStr.substring(0, 500)}`);
          }
          // FIX BUG-3: Track consecutive webhook failures per URL and alert admin
          if (finalResponseStatus === 404) {
            const failKey = `webhook-failures:${url}`;
            const failCount = webhookFailureTracker.get(failKey) || 0;
            webhookFailureTracker.set(failKey, failCount + 1);
            if (failCount + 1 >= 3) {
              webhookLogs.error(
                `[callMerchantWebhook] 🚨 ALERT: Webhook URL "${url}" has returned 404 for ${failCount + 1} consecutive attempts. ` +
                `Company ${companyId} will NOT receive payment notifications. Merchant should update their webhook URL.`
              );
            }
          }
          // Include response body in error message for caller
          if (responseBodyStr) {
            errorMessage = `${errorMessage} - Server response: ${responseBodyStr.substring(0, 200)}`;
          }
          break;
        }
        
        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
          webhookLogs.warn(`[callMerchantWebhook] ⚠️ Attempt ${attempt} failed, retrying in ${delay}ms: ${errorMessage}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed - log the failure
    const responseTimeMs = Date.now() - startTime;
    const finalErrorMessage = lastError?.message || 'Unknown error';
    webhookLogs.error(`[callMerchantWebhook] ❌ ${urlType} failed after ${maxRetries} attempts: ${finalErrorMessage}`);
    
    if (companyId) {
      await logWebhookDelivery(
        companyId,
        url,
        eventData.event as string,
        webhookPayload.webhook_id,
        webhookPayload,
        'failed',
        finalResponseStatus,
        responseTimeMs,
        finalErrorMessage,
        totalRetries
      );
    }
    
    return { success: false, error: finalErrorMessage, url };
    
  } catch (error: unknown) {
    const err = error as { message?: string };
    webhookLogs.error(`[callMerchantWebhook] Error in callUrlWithPayload: ${err.message}`);
    return { success: false, error: err.message || 'Unknown error', url };
  }
};

const flutterwaveWebHook = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const secretHash = process.env.FLW_SECRET_HASH;
    const signature = req.headers["verif-hash"];
    if (!signature || signature !== secretHash) {
      res.status(401).end();
    }
    const payload: IWebHook = req.body;
    const txRef = payload.txRef.includes("customer")
      ? payload.txRef
      : "flw-txt-" + payload.txRef;
    const items = await getRedisItem(txRef);
    webhookLogs.info("here==========>", payload.id, payload.status, items);
    await setRedisItem(txRef, {
      ...items,
      id: payload.id,
      status: payload.status,
    });

    webhookLogs.info("IWebHook=============>", payload);
    res.status(200).end();
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, { from: "flutterwave_webhook" }, new Error(e));
    res.status(401).end();
  }
};
const tatumWebHook = async (req: express.Request, res: express.Response) => {
  const payload: ITatumWebHook = req.body;
  let address = payload.address;
  let items;
  items = await getRedisItem("crypto-" + address);
  if (Object.keys(items).length < 1) {
    address = payload.counterAddress;
    items = await getRedisItem("crypto-" + address);
  }
  webhookLogs.info("items===========>", items, payload);
  let newPayload;
  if (Object.keys(items).length > 0) {
    if (
      Number(items.amount) >= Number(payload.amount) ||
      Number(payload.amount) > 0
    ) {
      newPayload = {
        ...items,
        status: toRedisStatus(PaymentState.PAYOUT_COMPLETE),
      };
      webhookLogs.info("here payload");
    } else {
      newPayload = {
        ...items,
        status: toRedisStatus(PaymentState.FAILED),
        message: "your amount is less then required amount!",
      };
    }

    if (!items?.txId && Number(payload.amount) > 0) {
      // NOTE: Pending notification is handled by tatumCryptoWebHook to avoid duplicates.
      // Only update Redis state here.
      await setRedisItem("crypto-" + address, {
        ...newPayload,
        txId: payload.txId,
        receivedAmount: payload.amount,
      });
    }
  }
  res.status(200).end();
};

/**
 * tatumCryptoWebHook — QUEUE-BASED (thin handler)
 * 
 * This handler immediately ACKs the Tatum webhook (200) and enqueues the payload
 * for asynchronous processing by the BullMQ worker. This ensures:
 * 1. No webhooks are lost during server processing time
 * 2. Tatum doesn't retry-storm due to slow responses
 * 3. If the server crashes mid-processing, the job survives in Redis
 */
const tatumCryptoWebHook = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const payload: ITatumWebHook = req.body;

    // Extract company info from query params (BlockBee style)
    const queryCompanyId = req.query.company_id ? Number(req.query.company_id) : undefined;
    const queryUserId = req.query.user_id ? Number(req.query.user_id) : undefined;
    const queryAddressId = req.query.address_id ? Number(req.query.address_id) : undefined;

    webhookLogs.info("[tatumCryptoWebHook] Received webhook, enqueuing:", {
      address: payload.address,
      amount: payload.amount,
      txId: payload.txId,
      asset: payload.asset,
    });

    // Basic validation before enqueue
    if (!payload.txId) {
      webhookLogs.warn("[tatumCryptoWebHook] Missing txId, ignoring");
      return res.status(200).end();
    }

    // BUG-10 FIX: Short-lived receiver-level dedup to reject duplicate Tatum webhooks
    // that arrive within milliseconds of each other (same txId sent twice by Tatum).
    // This is separate from the processed-tx dedup which checks fully processed TXs.
    const receiverDedupKey = `recv-dedup-${payload.txId}`;
    const [alreadyReceived] = await Promise.all([getRedisItem(receiverDedupKey)]);
    if (alreadyReceived && Object.keys(alreadyReceived).length > 0) {
      webhookLogs.info(`[tatumCryptoWebHook] Duplicate webhook at receiver level, skipping: ${payload.txId}`);
      return res.status(200).end();
    }
    // Mark as received with 30s TTL (covers the duplicate window without blocking legitimate retries)
    await setRedisItemWithTTL(receiverDedupKey, { received: Date.now() }, 30);

    // PERF: Parallelize the two Redis dedup checks — saves ~100-200ms per webhook
    // (Railway Redis round-trip is ~100-200ms, running sequentially doubled that)
    const processedTxKey = `processed-tx-${payload.txId}`;
    const outgoingTxKey = `outgoing-tx-${payload.txId}`;
    const [alreadyProcessed, isOutgoingTx] = await Promise.all([
      getRedisItem(processedTxKey),
      getRedisItem(outgoingTxKey),
    ]);

    // Quick duplicate check (fast-path reject, worker also checks)
    if (alreadyProcessed && Object.keys(alreadyProcessed).length > 0) {
      webhookLogs.info("[tatumCryptoWebHook] Already processed, skipping:", payload.txId);
      return res.status(200).end();
    }

    // BUG-3/4 FIX: Skip webhooks for our own outgoing transactions (settlement/sweep TXs).
    // When DynoPay sends settlement or sweep TXs, Tatum fires webhooks back to us.
    // These are false positives — not incoming payments — and should be ignored.
    if (isOutgoingTx && Object.keys(isOutgoingTx).length > 0) {
      webhookLogs.info(`[tatumCryptoWebHook] Outgoing TX detected (${isOutgoingTx.type || 'unknown'}), skipping: ${payload.txId}`);
      return res.status(200).end();
    }

    // Enqueue for async processing by BullMQ worker
    await enqueueWebhook({
      payload: {
        address: payload.address,
        counterAddress: payload.counterAddress,
        amount: payload.amount,
        txId: payload.txId,
        asset: payload.asset,
      },
      queryParams: {
        company_id: queryCompanyId,
        user_id: queryUserId,
        address_id: queryAddressId,
      },
      receivedAt: new Date().toISOString(),
      source: "webhook",
    });

    // ACK immediately — processing happens asynchronously
    return res.status(200).end();
  } catch (error) {
    webhookLogs.error("[tatumCryptoWebHook] Error enqueuing webhook:", error);
    // Still return 200 to prevent Tatum retries (the raw payload is logged)
    return res.status(200).end();
  }
};


export { flutterwaveWebHook, tatumWebHook, tatumCryptoWebHook, callMerchantWebhook };
