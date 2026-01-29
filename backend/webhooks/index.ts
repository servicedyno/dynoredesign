import express from "express";
import { apiLogger } from "../utils/loggers";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { ITatumWebHook, IWebHook } from "../utils/types";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";
import axios from "axios";
import { paymentController } from "../controller";
import { sendPendingPaymentNotification } from "../services/pendingPaymentService";
import { QueryTypes } from "sequelize";

/**
 * Call merchant's webhook URL with payment event
 * Merchants can configure webhook_url when creating payment links
 */
const callMerchantWebhook = async (customerData: any, eventData: any): Promise<void> => {
  try {
    // Get webhook URL from payment link or company settings
    const sequelize = require('../utils/dbInstance').default;
    
    // First try to get from payment link
    let webhookUrl = null;
    
    if (customerData?.payment_link_id) {
      const [linkResult] = await sequelize.query(
        `SELECT webhook_url FROM tbl_payment_link WHERE payment_link_id = :linkId`,
        { replacements: { linkId: customerData.payment_link_id }, type: QueryTypes.SELECT }
      );
      webhookUrl = linkResult?.webhook_url;
    }
    
    // If no webhook on link, try company settings
    if (!webhookUrl && customerData?.company_id) {
      const [companyResult] = await sequelize.query(
        `SELECT webhook_url FROM tbl_company WHERE company_id = :companyId`,
        { replacements: { companyId: customerData.company_id }, type: QueryTypes.SELECT }
      );
      webhookUrl = companyResult?.webhook_url;
    }
    
    if (!webhookUrl) {
      console.log("[callMerchantWebhook] No webhook URL configured, skipping");
      return;
    }
    
    console.log(`[callMerchantWebhook] Sending ${eventData.event} to ${webhookUrl}`);
    
    // Send webhook with timeout
    const response = await axios.post(webhookUrl, eventData, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-DynoPay-Event': eventData.event,
        'X-DynoPay-Signature': 'webhook-signature-placeholder', // TODO: Add proper HMAC signature
      },
    });
    
    console.log(`[callMerchantWebhook] Webhook sent successfully, status: ${response.status}`);
    
  } catch (error: any) {
    // Log but don't throw - webhook failure shouldn't block payment processing
    console.error(`[callMerchantWebhook] Failed to send webhook: ${error.message}`);
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
      // First time transaction detected - send pending notification
      const customerData = await getRedisItem(items?.ref);
      if (customerData) {
        await sendPendingPaymentNotification(
          address,
          payload.txId,
          Number(payload.amount),
          items?.currency || payload.asset,
          customerData
        );
      }

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

    console.log("[tatumCryptoWebHook] Received webhook:", {
      address: payload.address,
      amount: payload.amount,
      currency: payload.currency || payload.asset,
      txId: payload.txId
    });

    // Check for duplicate txId (prevent processing same blockchain tx twice)
    const processedTxKey = `processed-tx-${payload.txId}`;
    const alreadyProcessed = await getRedisItem(processedTxKey);
    if (alreadyProcessed && Object.keys(alreadyProcessed).length > 0) {
      console.log("[tatumCryptoWebHook] Transaction already processed, ignoring duplicate:", payload.txId);
      return res.status(200).end();
    }

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

    console.log("[tatumCryptoWebHook] Redis data found:", {
      currency: items.currency,
      expectedAmount: items.amount,
      payment_id: items.payment_id,
      hasTxId: !!items.txId
    });

    const incomingAmount = Number(payload.amount);
    if (!Number.isFinite(incomingAmount) || incomingAmount <= 0) {
      console.log("[tatumCryptoWebHook] Invalid amount, ignoring");
      return res.status(200).end();
    }

    // FIXED: Only process on FIRST transaction (when txId is not set)
    // This matches the working DynoBackend behavior
    const isFirstTransaction = !items.txId;

    if (isFirstTransaction && incomingAmount > 0) {
      console.log("[tatumCryptoWebHook] First transaction detected, processing...");
      
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
          await callMerchantWebhook(customerData, {
            event: 'payment.pending',
            address: address,
            txId: payload.txId,
            amount: incomingAmount,
            currency: items?.currency || payload.asset,
            payment_id: items?.payment_id || items?.unique_tx_id,
            status: 'pending',
            timestamp: new Date().toISOString(),
          });
        } catch (notifError) {
          console.error("[tatumCryptoWebHook] Error sending pending notification:", notifError);
        }
      } else {
        console.warn("[tatumCryptoWebHook] No customerData available, skipping pending notification");
      }

      // RACE CONDITION FIX: Process payment FIRST, then mark as processed in Redis
      // If cryptoVerification fails, webhook can be safely retried
      console.log("[tatumCryptoWebHook] Calling cryptoVerification for address:", address);
      
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
        await setRedisItem("crypto-" + address, {
          ...items,
          status: "processing",
          receivedAmount: incomingAmount,
          txId: payload.txId,  // MUST be set before cryptoVerification
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
          } catch (retryError: any) {
            lastError = retryError;
            
            // SMART RETRY: Check if error is retryable
            if (!isRetryable(retryError)) {
              console.error(`[tatumCryptoWebHook] Non-retryable error, stopping: ${retryError.message}`);
              break; // Don't retry hard failures
            }
            
            if (attempt < maxRetries) {
              const waitTime = 2000 * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s
              console.warn(`[tatumCryptoWebHook] cryptoVerification failed (attempt ${attempt}/${maxRetries}): ${retryError.message}`);
              console.warn(`[tatumCryptoWebHook] Retrying in ${waitTime}ms...`);
              
              // Update retry state in Redis (persistence)
              await setRedisItem("crypto-" + address, {
                ...items,
                status: "retrying",
                receivedAmount: incomingAmount,
                txId: payload.txId,
                retryCount: String(attempt),
                lastAttempt: new Date().toISOString(),
                lastError: retryError.message,
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
          receivedAmount: incomingAmount,
          completedAt: new Date().toISOString(),
        });
        
        // Store processed txId with 48-hour TTL to prevent duplicate processing
        await setRedisItem(`processed-tx-${payload.txId}`, {
          address: address,
          payment_id: items.payment_id || items.ref,
          amount: incomingAmount,
          processed_at: new Date().toISOString(),
        });
        // Note: Redis TTL should be set separately if needed (48 hours = 172800 seconds)
        
        console.log("[tatumCryptoWebHook] Redis updated with txId after successful processing");
        
        // Send payment confirmed webhook to merchant
        if (customerData && customerData.company_id) {
          await callMerchantWebhook(customerData, {
            event: 'payment.confirmed',
            address: address,
            txId: payload.txId,
            amount: incomingAmount,
            currency: items?.currency || payload.asset,
            payment_id: items?.payment_id || items?.unique_tx_id,
            merchant_amount: items?.merchant_amount,
            fees: items?.total_fees,
            fee_payer: items?.fee_payer || 'company',
            status: 'confirmed',
            timestamp: new Date().toISOString(),
          });
          console.log("[tatumCryptoWebHook] Payment confirmed webhook sent");
        }

      } catch (verifyError: any) {
        console.error("[tatumCryptoWebHook] Error in cryptoVerification after retries:", verifyError);
        
        // PERSISTENCE: Store failed state for manual recovery or cron retry
        await setRedisItem("crypto-" + address, {
          ...items,
          status: "failed",
          receivedAmount: incomingAmount,
          txId: payload.txId,
          failedAt: new Date().toISOString(),
          lastError: verifyError.message,
        });
        
        // Store in failed payments list for monitoring/retry
        await setRedisItem(`failed-payment-${payload.txId}`, {
          address: address,
          payment_id: items.payment_id || items.ref,
          amount: incomingAmount,
          txId: payload.txId,
          error: verifyError.message,
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


export { flutterwaveWebHook, tatumWebHook, tatumCryptoWebHook };
