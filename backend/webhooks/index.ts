import express from "express";
import { apiLogger } from "../utils/loggers";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { ITatumWebHook, IWebHook } from "../utils/types";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";
import axios from "axios";
import { paymentController } from "../controller";
import { sendPendingPaymentNotification } from "../services/pendingPaymentService";

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
      
      // Send pending notification for first transaction
      const customerData = await getRedisItem(items?.ref);
      if (customerData) {
        await sendPendingPaymentNotification(
          address,
          payload.txId,
          incomingAmount,
          items?.currency || payload.asset,
          customerData
        );
      }

      // RACE CONDITION FIX: Process payment FIRST, then mark as processed in Redis
      // If cryptoVerification fails, webhook can be safely retried
      console.log("[tatumCryptoWebHook] Calling cryptoVerification for address:", address);
      try {
        // CRITICAL: Store txId BEFORE calling cryptoVerification so it can use it
        // cryptoVerification reads txId from Redis to process the payment
        await setRedisItem("crypto-" + address, {
          ...items,
          status: "processing",
          receivedAmount: incomingAmount,
          txId: payload.txId,  // MUST be set before cryptoVerification
        });

        // Retry cryptoVerification up to 3 times with exponential backoff
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
            if (attempt < maxRetries) {
              const waitTime = 2000 * Math.pow(2, attempt - 1);
              console.warn(`[tatumCryptoWebHook] cryptoVerification failed (attempt ${attempt}/${maxRetries}): ${retryError.message}`);
              console.warn(`[tatumCryptoWebHook] Retrying in ${waitTime}ms...`);
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

      } catch (verifyError) {
        console.error("[tatumCryptoWebHook] Error in cryptoVerification after retries:", verifyError);
        // IMPORTANT: Don't set txId on failure - allow webhook retry
        // Reset status to pending so it can be retried
        await setRedisItem("crypto-" + address, {
          ...items,
          status: "pending",
          receivedAmount: incomingAmount,
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
