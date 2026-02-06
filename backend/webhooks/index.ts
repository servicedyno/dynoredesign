import express from "express";
import crypto from "crypto";
import { apiLogger } from "../utils/loggers";
import { getErrorMessage } from "../helper";
import { ITatumWebHook, IWebHook } from "../utils/types";
import { getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";
import axios from "axios";
import { paymentController } from "../controller";
import { sendPendingPaymentNotification } from "../services/pendingPaymentService";
import { QueryTypes } from "sequelize";

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
    console.error(`[logWebhookDelivery] Failed to log webhook: ${errorMsg}`);
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
      console.log(`[callMerchantWebhook] Using webhook URL from payment data: ${webhookUrl}`);
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
        console.log(`[callMerchantWebhook] Found webhook URL from API key for company ${companyId}: ${webhookUrl}`);
      }
    }
    
    // If neither webhook_url nor callback_url configured, skip
    if (!webhookUrl && !callbackUrl) {
      console.log("[callMerchantWebhook] No webhook URL or callback URL configured (checked: payment_link, company, API key), skipping");
      return { success: true }; // No webhook configured is not an error
    }
    
    // Validate webhook URL - localhost URLs won't work from cloud server
    const urlToCheck = webhookUrl || callbackUrl;
    if (urlToCheck && (urlToCheck.includes('localhost') || urlToCheck.includes('127.0.0.1'))) {
      const errorMsg = `Webhook URL "${urlToCheck}" uses localhost which is unreachable from Dynopay servers. Please use a public URL.`;
      console.error(`[callMerchantWebhook] ❌ ${errorMsg}`);
      return { success: false, error: errorMsg, url: urlToCheck };
    }
    
    let lastResult: WebhookResult = { success: true };
    
    // Call callback_url first (instant notification, synchronous)
    if (callbackUrl) {
      lastResult = await callUrlWithPayload(callbackUrl, eventData, webhookSecret, Number(companyId), 'callback');
    }
    
    // Then call webhook_url (transaction updates, can be same or different)
    if (webhookUrl && webhookUrl !== callbackUrl) {
      lastResult = await callUrlWithPayload(webhookUrl, eventData, webhookSecret, Number(companyId), 'webhook');
    } else if (webhookUrl && !callbackUrl) {
      // If only webhook_url is configured (no callback_url)
      lastResult = await callUrlWithPayload(webhookUrl, eventData, webhookSecret, Number(companyId), 'webhook');
    }
    
    return lastResult;
    
  } catch (error: unknown) {
    // Log but don't throw - webhook failure shouldn't block payment processing
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[callMerchantWebhook] Failed to send webhook: ${errorMsg}`);
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
    
    console.log(`[callMerchantWebhook] Sending ${urlType} ${eventData.event} to ${url}`);
    console.log(`[callMerchantWebhook] Signature included: ${!!webhookSecret}`);
    // Log payload for debugging (truncate large payloads)
    const payloadStr = JSON.stringify(webhookPayload);
    console.log(`[callMerchantWebhook] Payload (${payloadStr.length} bytes): ${payloadStr.substring(0, 500)}${payloadStr.length > 500 ? '...' : ''}`);
    
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
        
        console.log(`[callMerchantWebhook] ✅ ${urlType} sent successfully, status: ${response.status}`);
        
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
          console.error(`[callMerchantWebhook] ❌ Client error ${finalResponseStatus}, not retrying: ${errorMessage}`);
          if (responseBodyStr) {
            console.error(`[callMerchantWebhook] ❌ Response body: ${responseBodyStr.substring(0, 500)}`);
          }
          // Include response body in error message for caller
          if (responseBodyStr) {
            errorMessage = `${errorMessage} - Server response: ${responseBodyStr.substring(0, 200)}`;
          }
          break;
        }
        
        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
          console.warn(`[callMerchantWebhook] ⚠️ Attempt ${attempt} failed, retrying in ${delay}ms: ${errorMessage}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed - log the failure
    const responseTimeMs = Date.now() - startTime;
    const finalErrorMessage = lastError?.message || 'Unknown error';
    console.error(`[callMerchantWebhook] ❌ ${urlType} failed after ${maxRetries} attempts: ${finalErrorMessage}`);
    
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
    console.error(`[callMerchantWebhook] Error in callUrlWithPayload: ${err.message}`);
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
    console.log("here==========>", payload.id, payload.status, items);
    await setRedisItem(txRef, {
      ...items,
      id: payload.id,
      status: payload.status,
    });

    console.log("IWebHook=============>", payload);
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
  console.log("items===========>", items, payload);
  let newPayload;
  if (Object.keys(items).length > 0) {
    if (
      Number(items.amount) >= Number(payload.amount) ||
      Number(payload.amount) > 0
    ) {
      newPayload = {
        ...items,
        status: "successful",
      };
      console.log("here payload");
    } else {
      newPayload = {
        ...items,
        status: "failed",
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

const tatumCryptoWebHook = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const payload: ITatumWebHook = req.body;
    
    // BLOCKBEE STYLE: Extract company info from query params
    // URL format: /api/tatum-crypto-webhook?company_id=38&user_id=28&address_id=5
    const queryCompanyId = req.query.company_id ? Number(req.query.company_id) : null;
    const queryUserId = req.query.user_id ? Number(req.query.user_id) : null;
    const queryAddressId = req.query.address_id ? Number(req.query.address_id) : null;

    console.log("[tatumCryptoWebHook] Received webhook:", {
      address: payload.address,
      amount: payload.amount,
      currency: (payload as unknown as Record<string, unknown>).currency || payload.asset,
      txId: payload.txId,
      // BlockBee style params from URL
      queryCompanyId,
      queryUserId,
      queryAddressId,
    });

    // Check for duplicate txId (prevent processing same blockchain tx twice)
    const processedTxKey = `processed-tx-${payload.txId}`;
    const processingLockKey = `processing-lock-${payload.txId}`;
    
    const alreadyProcessed = await getRedisItem(processedTxKey);
    if (alreadyProcessed && Object.keys(alreadyProcessed).length > 0) {
      console.log("[tatumCryptoWebHook] Transaction already processed, ignoring duplicate:", payload.txId);
      return res.status(200).end();
    }

    // RACE CONDITION FIX: Acquire processing lock BEFORE doing any work
    // This prevents multiple simultaneous webhooks from all processing the same transaction
    const existingLock = await getRedisItem(processingLockKey);
    if (existingLock && existingLock.locked) {
      console.log("[tatumCryptoWebHook] Transaction already being processed by another request, ignoring:", payload.txId);
      return res.status(200).end();
    }
    
    // Set processing lock immediately (expires in 5 minutes as safety)
    await setRedisItem(processingLockKey, { locked: true, startedAt: new Date().toISOString() });
    await setRedisTTL(processingLockKey, 300); // 5 minute TTL
    console.log("[tatumCryptoWebHook] Acquired processing lock for tx:", payload.txId);

    let address = payload.address;
    let items = await getRedisItem("crypto-" + address);

    if (!items || Object.keys(items).length === 0) {
      console.log("[tatumCryptoWebHook] No Redis data for primary address, checking counterAddress");
      address = payload.counterAddress;
      items = await getRedisItem("crypto-" + address);
    }

    if (!items || Object.keys(items).length === 0) {
      console.log("[tatumCryptoWebHook] No Redis data found, ignoring webhook");
      return res.status(200).end();
    }
    
    // BLOCKBEE STYLE: Enrich items with company info from URL if not present
    if (queryCompanyId && !items.company_id) {
      items.company_id = queryCompanyId;
      console.log(`[tatumCryptoWebHook] Added company_id from URL: ${queryCompanyId}`);
    }
    if (queryUserId && !items.user_id) {
      items.user_id = queryUserId;
      console.log(`[tatumCryptoWebHook] Added user_id from URL: ${queryUserId}`);
    }

    console.log("[tatumCryptoWebHook] Redis data found:", {
      currency: items.currency,
      expectedAmount: items.amount,
      payment_id: items.payment_id,
      company_id: items.company_id || queryCompanyId,
      hasTxId: !!items.txId
    });

    const incomingAmount = Number(payload.amount);
    if (!Number.isFinite(incomingAmount) || incomingAmount <= 0) {
      console.log("[tatumCryptoWebHook] Invalid amount, ignoring");
      return res.status(200).end();
    }

    // FIXED: Process when:
    // 1. First transaction (no txId set)
    // 2. OR this is a completion payment for an underpayment (incomplete=true and this is a NEW txId)
    // 3. AND payment is NOT already successful
    const isFirstTransaction = !items.txId;
    const isCompletionPayment = String(items.incomplete) === "true" && 
                                items.txId !== payload.txId;  // New transaction for underpayment completion
    const isAlreadySuccessful = items.status === "successful" || items.status === "completed";
    
    // Skip if payment is already successful (prevents duplicate processing from merchant payout webhooks)
    if (isAlreadySuccessful) {
      console.log("[tatumCryptoWebHook] Payment already successful, ignoring webhook for tx:", payload.txId);
      return res.status(200).end();
    }

    // CRASH RECOVERY: Handle payments stuck in "processing" state
    // This happens when the backend crashes/restarts DURING cryptoVerification — after settlement
    // completes on-chain but BEFORE the payment.confirmed webhook is delivered to the merchant.
    // Without this recovery, the payment is permanently stuck: txId is set (blocking retries)
    // but the merchant never receives confirmation.
    const isStaleProcessing = items.status === "processing" && 
      !!items.txId && 
      items.lastAttempt && 
      (Date.now() - new Date(items.lastAttempt as string).getTime()) > 60000; // 1+ minute stale

    if (isStaleProcessing && incomingAmount > 0) {
      console.log("[tatumCryptoWebHook] ⚠️ CRASH RECOVERY: Payment stuck in 'processing' state");
      console.log(`[tatumCryptoWebHook] Recovery: payment_id=${items.payment_id}, stale since ${items.lastAttempt}`);
      
      try {
        // Re-attempt cryptoVerification — it handles settlement + webhook + emails
        // If settlement already completed on-chain, this will fail (insufficient balance),
        // and we'll fall through to the direct webhook recovery below.
        await paymentController.cryptoVerification(address, true);
        console.log("[tatumCryptoWebHook] ✅ Recovery: cryptoVerification completed successfully");
        
        // Mark as successful
        await setRedisItem("crypto-" + address, {
          ...items,
          status: "successful",
          txId: payload.txId,
          receivedAmount: items.receivedAmount || incomingAmount,
          completedAt: new Date().toISOString(),
          recoveredAt: new Date().toISOString(),
        });
        await setRedisTTL("crypto-" + address, 1800);
        
        // Store processed txId
        await setRedisItem(`processed-tx-${payload.txId}`, {
          address: address,
          payment_id: items.payment_id || items.ref,
          amount: items.receivedAmount || incomingAmount,
          processed_at: new Date().toISOString(),
          recovered: true,
        });
        await setRedisTTL(`processed-tx-${payload.txId}`, 172800);
        
        console.log("[tatumCryptoWebHook] ✅ Recovery complete, Redis updated");

      } catch (recoveryError: unknown) {
        const err = recoveryError as { message?: string };
        console.error("[tatumCryptoWebHook] ⚠️ Recovery cryptoVerification failed (settlement likely already on-chain):", err.message);
        console.log("[tatumCryptoWebHook] Attempting direct webhook delivery as recovery fallback...");
        
        // Settlement already happened on-chain but cryptoVerification can't re-run.
        // Send the payment.confirmed webhook directly so the merchant isn't left in the dark.
        try {
          let customerData = items?.ref ? await getRedisItem(items.ref) : null;
          if (!customerData || Object.keys(customerData).length === 0) {
            customerData = items; // Use Redis payment data as fallback
          }
          
          if (customerData) {
            const linkId = customerData?.link_id || items?.link_id || null;
            const paymentType = linkId ? 'payment_link' : 'direct_api';
            
            const recoveryWebhookResult = await callMerchantWebhook(customerData, {
              event: "payment.confirmed",
              payment_type: paymentType,
              payment_id: items?.payment_id || items?.unique_tx_id,
              transaction_reference: items.txId,
              status: "processing",
              amount: parseFloat(items.receivedAmount as string) || incomingAmount,
              currency: items?.currency || payload.asset,
              base_amount: customerData?.base_amount || items?.base_amount_usd || null,
              base_currency: customerData?.base_currency || 'USD',
              customer_name: customerData?.customer_name || null,
              customer_email: customerData?.email || null,
              description: customerData?.description || null,
              link_id: linkId,
              fee_payer: customerData?.fee_payer || items?.fee_payer || 'company',
              recovered: true,
              completed_at: new Date().toISOString(),
            });
            
            if (recoveryWebhookResult.success) {
              console.log("[tatumCryptoWebHook] ✅ Recovery: Direct webhook sent successfully");
            } else {
              console.error(`[tatumCryptoWebHook] ❌ Recovery: Direct webhook failed: ${recoveryWebhookResult.error}`);
            }
          }
        } catch (webhookErr) {
          console.error("[tatumCryptoWebHook] ❌ Recovery: Direct webhook error:", webhookErr);
        }
        
        // Mark as recovered to prevent infinite recovery loops
        await setRedisItem("crypto-" + address, {
          ...items,
          status: "recovered",
          recoveredAt: new Date().toISOString(),
          recoveryNote: "Settlement completed on-chain, direct webhook sent as fallback",
        });
        await setRedisTTL("crypto-" + address, 1800);
        
        // Store processed txId to prevent future duplicate processing
        await setRedisItem(`processed-tx-${payload.txId}`, {
          address: address,
          payment_id: items.payment_id || items.ref,
          amount: items.receivedAmount || incomingAmount,
          processed_at: new Date().toISOString(),
          recovered: true,
        });
        await setRedisTTL(`processed-tx-${payload.txId}`, 172800);
        
        console.log("[tatumCryptoWebHook] ✅ Recovery: Marked as recovered, Redis updated");
      }
      
      return res.status(200).end();
    }

    if ((isFirstTransaction || isCompletionPayment) && incomingAmount > 0) {
      if (isCompletionPayment) {
        console.log("[tatumCryptoWebHook] COMPLETION payment detected for underpayment!");
        console.log(`[tatumCryptoWebHook] Previous txId: ${items.txId}, New txId: ${payload.txId}`);
      } else {
        console.log("[tatumCryptoWebHook] First transaction detected, processing...");
      }
      
      // Get customer data - try from Redis first, then fallback to temp_id lookup
      let customerData = await getRedisItem(items?.ref);
      
      // If customerData is empty, try to reconstruct from temp address
      if (!customerData || Object.keys(customerData).length === 0) {
        console.log("[tatumCryptoWebHook] CustomerData empty from Redis, fetching from DB...");
        try {
          const tempId = items?.temp_id;
          if (tempId) {
            const { Sequelize } = require('sequelize');
            const sequelize = require('../utils/dbInstance').default;
            const [tempAddr] = await sequelize.query(
              `SELECT owner_user_id, current_company_id FROM tbl_merchant_temp_address WHERE temp_address_id = :tempId`,
              { replacements: { tempId }, type: Sequelize.QueryTypes.SELECT }
            );
            if (tempAddr) {
              customerData = {
                adm_id: tempAddr.owner_user_id,
                company_id: tempAddr.current_company_id,
              };
              console.log("[tatumCryptoWebHook] Reconstructed customerData from temp address:", customerData);
            }
          }
        } catch (dbErr) {
          console.error("[tatumCryptoWebHook] Error fetching customerData from DB:", dbErr);
        }
      }
      
      // Send pending notification for first transaction
      if (customerData && customerData.adm_id) {
        try {
          await sendPendingPaymentNotification(
            address,
            payload.txId,
            incomingAmount,
            items?.currency || payload.asset,
            customerData
          );
          console.log("[tatumCryptoWebHook] Pending notification sent successfully");
          
          // Call merchant webhook if configured (for pending state)
          // ENHANCED: Include customer details and payment context
          const linkIdPending = customerData?.link_id || null;
          const paymentTypePending = linkIdPending ? 'payment_link' : 'direct_api';
          
          const pendingWebhookResult = await callMerchantWebhook(customerData, {
            event: 'payment.pending',
            payment_type: paymentTypePending,
            address: address,
            txId: payload.txId,
            amount: incomingAmount,
            currency: items?.currency || payload.asset,
            payment_id: items?.payment_id || items?.unique_tx_id,
            status: 'pending',
            // ENHANCED: Add base amount context
            base_amount: customerData?.base_amount || items?.base_amount_usd || null,
            base_currency: customerData?.base_currency || 'USD',
            // ENHANCED: Customer & payment link details
            customer_name: customerData?.customer_name || null,
            customer_email: customerData?.email || null,
            description: customerData?.description || null,
            link_id: linkIdPending,
            fee_payer: customerData?.fee_payer || items?.fee_payer || 'company',
            timestamp: new Date().toISOString(),
          });
          if (!pendingWebhookResult.success) {
            console.error(`[tatumCryptoWebHook] Pending webhook failed: ${pendingWebhookResult.error}`);
          }
        } catch (notifError) {
          console.error("[tatumCryptoWebHook] Error sending pending notification:", notifError);
        }
      } else {
        console.warn("[tatumCryptoWebHook] No customerData available, skipping pending notification");
      }

      // Check if this is an underpayment BEFORE processing
      // For completion payments, we need to check if cumulative amount is now sufficient
      let expectedAmount = parseFloat(items?.amount || '0');
      let totalReceivedAmount = incomingAmount;
      
      // For completion payments on underpayments, add to previous amount
      if (isCompletionPayment) {
        const previousAmount = parseFloat(items?.previousAmount || '0');
        totalReceivedAmount = previousAmount + incomingAmount;
        // Use original expected amount for comparison (since items.amount is now the remaining)
        expectedAmount = parseFloat(items?.originalExpectedAmount || '0') || (expectedAmount + previousAmount);
        console.log(`[tatumCryptoWebHook] Completion payment cumulative: 
          - Previous: ${previousAmount} ${items?.currency || payload.asset}
          - New: ${incomingAmount} ${items?.currency || payload.asset}
          - Total: ${totalReceivedAmount} ${items?.currency || payload.asset}
          - Original Expected: ${expectedAmount} ${items?.currency || payload.asset}`);
      }
      
      const isUnderpayment = totalReceivedAmount < expectedAmount && expectedAmount > 0;
      const isOverpayment = totalReceivedAmount > expectedAmount && expectedAmount > 0;
      
      // Calculate underpayment amount in USD for threshold comparison
      let underpaymentAmountUsd = 0;
      let underpaymentThresholdUsd = 1; // Default $1 threshold
      
      if (isUnderpayment) {
        const shortfallCrypto = expectedAmount - totalReceivedAmount;
        // Calculate USD value of shortfall using base amount ratio
        const baseAmountUsd = parseFloat(items?.base_amount || customerData?.base_amount || '0');
        if (baseAmountUsd > 0 && expectedAmount > 0) {
          underpaymentAmountUsd = (shortfallCrypto / expectedAmount) * baseAmountUsd;
        }
        
        // Fetch merchant's underpayment threshold if set
        if (customerData?.company_id) {
          try {
            const { companyModel } = await import("../models");
            const company = await companyModel.findOne({
              where: { company_id: customerData.company_id }
            });
            if (company?.dataValues?.underpayment_threshold_usd !== undefined && 
                company?.dataValues?.underpayment_threshold_usd !== null) {
              underpaymentThresholdUsd = parseFloat(company.dataValues.underpayment_threshold_usd);
            }
          } catch (e) {
            console.log("[tatumCryptoWebHook] Could not fetch underpayment threshold:", e);
          }
        }
      }
      
      // Check if underpayment is within acceptable threshold (treat as full payment)
      const isMinorUnderpayment = isUnderpayment && underpaymentAmountUsd <= underpaymentThresholdUsd;
      
      console.log(`[tatumCryptoWebHook] Payment analysis:
        - Expected: ${expectedAmount} ${items?.currency || payload.asset}
        - Received (this payment): ${incomingAmount} ${items?.currency || payload.asset}
        - Total Received: ${totalReceivedAmount} ${items?.currency || payload.asset}
        - Is Underpayment: ${isUnderpayment}
        - Is Overpayment: ${isOverpayment}
        - Underpayment USD: $${underpaymentAmountUsd.toFixed(2)}
        - Underpayment Threshold: $${underpaymentThresholdUsd}
        - Is Minor Underpayment (within threshold): ${isMinorUnderpayment}`);
      
      // UNDERPAYMENT: Set incomplete flag and DON'T process as full payment
      // UNLESS it's within the acceptable threshold
      if (isUnderpayment && !isMinorUnderpayment) {
        console.log("[tatumCryptoWebHook] UNDERPAYMENT detected (exceeds threshold) - setting incomplete flag");
        
        const remainingAmount = expectedAmount - totalReceivedAmount;
        
        // Set Redis state for underpayment - this allows verifyCryptoPayment to return underpaid status
        await setRedisItem("crypto-" + address, {
          ...items,
          status: "underpaid",
          incomplete: "true",
          txId: payload.txId,
          receivedAmount: totalReceivedAmount,  // Total cumulative amount
          previousAmount: totalReceivedAmount,  // For next completion payment
          previousTxId: payload.txId,
          amount: remainingAmount,  // Now amount is the REMAINING amount
          originalExpectedAmount: expectedAmount,  // Store original for reference
          partialPaymentTimestamp: items?.partialPaymentTimestamp || new Date().toISOString(),
          lastAttempt: new Date().toISOString(),
        });
        
        // Set TTL for underpayment grace period (30 minutes)
        await setRedisTTL("crypto-" + address, 1800);
        
        // Send underpayment webhook to merchant
        // ENHANCED: Include customer details and payment context
        if (customerData && customerData.company_id) {
          const linkIdUnderpaid = customerData?.link_id || null;
          const paymentTypeUnderpaid = linkIdUnderpaid ? 'payment_link' : 'direct_api';
          
          const underpaidWebhookResult = await callMerchantWebhook(customerData, {
            event: 'payment.underpaid',
            payment_type: paymentTypeUnderpaid,
            address: address,
            txId: payload.txId,
            amount_received: totalReceivedAmount,
            amount_expected: expectedAmount,
            amount_remaining: remainingAmount,
            currency: items?.currency || payload.asset,
            payment_id: items?.payment_id || items?.unique_tx_id,
            status: 'underpaid',
            // ENHANCED: Add base amount context
            base_amount: customerData?.base_amount || items?.base_amount_usd || null,
            base_currency: customerData?.base_currency || 'USD',
            // ENHANCED: Customer & payment link details
            customer_name: customerData?.customer_name || null,
            customer_email: customerData?.email || null,
            description: customerData?.description || null,
            link_id: linkIdUnderpaid,
            fee_payer: customerData?.fee_payer || items?.fee_payer || 'company',
            grace_period_minutes: 30,
            timestamp: new Date().toISOString(),
          });
          if (underpaidWebhookResult.success) {
            console.log("[tatumCryptoWebHook] ✅ Enhanced underpayment webhook sent to merchant");
          } else {
            console.error(`[tatumCryptoWebHook] ❌ Underpayment webhook failed: ${underpaidWebhookResult.error}`);
          }
        }
        
        console.log("[tatumCryptoWebHook] Underpayment recorded, waiting for remaining payment");
        return res.status(200).end();
      }
      
      // Log if minor underpayment was accepted
      if (isMinorUnderpayment) {
        console.log(`[tatumCryptoWebHook] Minor underpayment ($${underpaymentAmountUsd.toFixed(2)}) within threshold ($${underpaymentThresholdUsd}) - accepting as full payment`);
      }
      
      // FULL, OVERPAYMENT, or MINOR UNDERPAYMENT: Process normally
      // For completion payments, store the cumulative amount
      const finalReceivedAmount = isCompletionPayment ? totalReceivedAmount : incomingAmount;
      console.log("[tatumCryptoWebHook] Calling cryptoVerification for address:", address, "final amount:", finalReceivedAmount);
      
      // Hard failures that should NOT be retried
      const NON_RETRYABLE_ERRORS = [
        'invalid address',
        'invalid private key', 
        'insufficient balance',
        'nonce too low',
        'already known',
        'bad request',
        '400', '401', '403', '404',
      ];
      
      const isRetryable = (error: Error): boolean => {
        const message = error.message?.toLowerCase() || '';
        return !NON_RETRYABLE_ERRORS.some(pattern => message.includes(pattern.toLowerCase()));
      };
      
      try {
        // PERSISTENCE: Store complete payment state BEFORE processing
        // This ensures payment isn't lost if server crashes during processing
        // For completion payments, clear the incomplete flag
        await setRedisItem("crypto-" + address, {
          ...items,
          status: "processing",
          receivedAmount: finalReceivedAmount,  // Use cumulative amount for completion payments
          txId: payload.txId,  // MUST be set before cryptoVerification
          originalExpectedAmount: expectedAmount,  // Store for overpayment calculation
          incomplete: isCompletionPayment ? "false" : items.incomplete,  // Clear incomplete flag
          retryCount: "0",
          lastAttempt: new Date().toISOString(),
        });

        // Retry cryptoVerification with SMART retries (exponential backoff + error filtering)
        let lastError: Error | null = null;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await paymentController.cryptoVerification(address, true);
            console.log("[tatumCryptoWebHook] cryptoVerification completed successfully");
            lastError = null;
            break;
          } catch (retryError: unknown) {
            const err = retryError as { message?: string };
            lastError = new Error(err.message || 'Unknown error');
            
            // SMART RETRY: Check if error is retryable
            if (!isRetryable(lastError)) {
              console.error(`[tatumCryptoWebHook] Non-retryable error, stopping: ${err.message}`);
              break; // Don't retry hard failures
            }
            
            if (attempt < maxRetries) {
              const waitTime = 2000 * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s
              console.warn(`[tatumCryptoWebHook] cryptoVerification failed (attempt ${attempt}/${maxRetries}): ${err.message}`);
              console.warn(`[tatumCryptoWebHook] Retrying in ${waitTime}ms...`);
              
              // Update retry state in Redis (persistence)
              await setRedisItem("crypto-" + address, {
                ...items,
                status: "retrying",
                receivedAmount: incomingAmount,
                txId: payload.txId,
                retryCount: String(attempt),
                lastAttempt: new Date().toISOString(),
                lastError: err.message,
              });
              
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }
        
        if (lastError) {
          throw lastError;
        }

        // SUCCESS: Mark as processed (txId already set above)
        await setRedisItem("crypto-" + address, {
          ...items,
          status: "successful",
          txId: payload.txId,
          receivedAmount: finalReceivedAmount,  // Use cumulative amount
          originalExpectedAmount: expectedAmount,
          incomplete: "false",  // Clear incomplete flag
          completedAt: new Date().toISOString(),
        });
        
        // FIXED: Set TTL on crypto address key for checkout polling (30 minutes)
        await setRedisTTL("crypto-" + address, 1800);
        
        // Also update customer ref key with successful status if it exists
        if (items?.ref) {
          const customerData = await getRedisItem(items.ref);
          if (customerData && Object.keys(customerData).length > 0) {
            await setRedisItem(items.ref, {
              ...customerData,
              status: "successful",
              txId: payload.txId,
              receivedAmount: finalReceivedAmount,  // Use cumulative amount
              completedAt: new Date().toISOString(),
            });
            await setRedisTTL(items.ref, 1800); // 30 minutes TTL
          }
        }
        
        // Store processed txId with 48-hour TTL to prevent duplicate processing
        await setRedisItem(`processed-tx-${payload.txId}`, {
          address: address,
          payment_id: items.payment_id || items.ref,
          amount: finalReceivedAmount,  // Use cumulative amount
          processed_at: new Date().toISOString(),
        });
        await setRedisTTL(`processed-tx-${payload.txId}`, 172800); // 48 hours TTL
        
        console.log("[tatumCryptoWebHook] Redis updated with txId after successful processing");
        
        // NOTE: Merchant webhook is sent by cryptoVerification, NOT here
        // This prevents duplicate webhook delivery
        console.log("[tatumCryptoWebHook] Payment confirmed - webhook handled by cryptoVerification");

      } catch (verifyError: unknown) {
        const err = verifyError as { message?: string };
        console.error("[tatumCryptoWebHook] Error in cryptoVerification after retries:", verifyError);
        
        // PERSISTENCE: Store failed state for manual recovery or cron retry
        await setRedisItem("crypto-" + address, {
          ...items,
          status: "failed",
          receivedAmount: incomingAmount,
          txId: payload.txId,
          failedAt: new Date().toISOString(),
          lastError: err.message,
        });
        
        // Store in failed payments list for monitoring/retry
        await setRedisItem(`failed-payment-${payload.txId}`, {
          address: address,
          payment_id: items.payment_id || items.ref,
          amount: incomingAmount,
          txId: payload.txId,
          error: err.message,
          failed_at: new Date().toISOString(),
        });
        
        throw verifyError;
      }
    } else {
      console.log("[tatumCryptoWebHook] Duplicate transaction or txId already exists, ignoring");
    }
    // If txId already exists, this is a duplicate/retry - ignore it

    return res.status(200).end();
  } catch (error) {
    console.error("[tatumCryptoWebHook] Webhook error:", error);
    return res.status(200).end();
  }
};


export { flutterwaveWebHook, tatumWebHook, tatumCryptoWebHook, callMerchantWebhook };
