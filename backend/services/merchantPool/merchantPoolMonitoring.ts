/**
 * Merchant Pool Monitoring
 * 
 * Handles subscription health, missed payment detection, and orphan payment recovery.
 */

import { Op } from "sequelize";
import {
  merchantTempAddressModel,
  merchantPoolTransactionModel,
  customerTransactionModel,
} from "../../models";
import { getRedisItem, setRedisItem, deleteRedisItem } from "../../utils/redisInstance";
import tatumApi from "../../apis/tatumApi";
import { getErrorMessage } from "../../helper";
import { cronLogger } from "../../utils/loggers";
import { paymentController } from "../../controller";
import { callMerchantWebhook } from "../../webhooks";
import {
  POOL_CONFIG,
  TOKEN_CHAINS,
  WEBHOOK_GRACE_PERIOD_MINUTES,
} from "./merchantPoolConfig";
import { recordPoolTransaction } from "./merchantPoolTransaction";

/**
 * Subscription Health Monitor
 */
export const ensurePoolSubscriptions = async (): Promise<{
  checked: number;
  valid: number;
  resubscribed: number;
  failed: number;
  errors: string[];
}> => {
  const result = {
    checked: 0,
    valid: 0,
    resubscribed: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    console.log("[MerchantPool] 🔍 Starting subscription health check...");

    const activeSubscriptions = await tatumApi.listAllSubscriptions();
    
    const activeSubsMap = new Map<string, Record<string, unknown>>();
    for (const sub of activeSubscriptions as Array<{ attr?: { address?: string }; id?: string }>) {
      const address = sub.attr?.address?.toLowerCase();
      if (address) {
        activeSubsMap.set(address, sub as Record<string, unknown>);
      }
    }
    
    console.log(`[MerchantPool] 📋 Found ${activeSubscriptions.length} active Tatum subscriptions`);

    const poolAddresses = await merchantTempAddressModel.findAll({
      attributes: ['temp_address_id', 'wallet_address', 'wallet_type', 'status', 'subscription_id'],
    });

    console.log(`[MerchantPool] 📋 Found ${poolAddresses.length} merchant pool addresses in DB`);

    for (const addr of poolAddresses) {
      result.checked++;
      
      const walletAddressOriginal = addr.dataValues.wallet_address;
      const walletAddressLower = walletAddressOriginal.toLowerCase();
      const dbSubId = addr.dataValues.subscription_id;
      const walletType = addr.dataValues.wallet_type;
      const activeSub = activeSubsMap.get(walletAddressLower);

      if (activeSub && dbSubId === activeSub.id) {
        result.valid++;
        continue;
      }

      if (activeSub && dbSubId !== activeSub.id) {
        console.log(`[MerchantPool] 🔄 Updating subscription ID for ${walletAddressOriginal}: ${dbSubId} -> ${activeSub.id}`);
        await addr.update({ subscription_id: activeSub.id });
        result.valid++;
        continue;
      }

      if (!activeSub) {
        console.log(`[MerchantPool] ⚠️ Missing subscription for ${walletAddressOriginal} (${walletType}), creating...`);
        
        try {
          const newSub = await tatumApi.createSubscription(walletAddressOriginal, walletType, true);
          
          if (newSub?.id) {
            await addr.update({ subscription_id: newSub.id });
            console.log(`[MerchantPool] ✅ Created subscription for ${walletAddressOriginal}: ${newSub.id}`);
            result.resubscribed++;
          } else {
            throw new Error("No subscription ID returned");
          }
        } catch (subError: unknown) {
          const err = subError as { response?: { data?: { errorCode?: string; message?: string } }; message?: string };
          const errorData = err.response?.data;
          if (errorData?.errorCode === 'subscription.exists.on.address-and-currency') {
            const match = errorData.message?.match(/already exists \(([a-f0-9]+)\)/);
            if (match && match[1]) {
              const existingSubId = match[1];
              console.log(`[MerchantPool] 🔄 Subscription already exists, updating DB: ${existingSubId}`);
              await addr.update({ subscription_id: existingSubId });
              result.valid++;
              continue;
            }
          }
          
          console.error(`[MerchantPool] ❌ Failed to create subscription for ${walletAddressOriginal}: ${err.message}`);
          result.failed++;
          result.errors.push(`${walletAddressOriginal}: ${err.message}`);
        }
      }
    }

    console.log(`[MerchantPool] ✅ Subscription health check complete:`);
    console.log(`   - Checked: ${result.checked}`);
    console.log(`   - Valid: ${result.valid}`);
    console.log(`   - Re-subscribed: ${result.resubscribed}`);
    console.log(`   - Failed: ${result.failed}`);

    if (result.errors.length > 0) {
      cronLogger?.warn?.("Subscription health check had failures", { errors: result.errors });
    }

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[MerchantPool] ❌ Subscription health check failed:", err.message);
    cronLogger?.error?.("Subscription health check failed", {}, error as Error);
    result.errors.push(`Global error: ${err.message}`);
  }

  return result;
};

/**
 * Fallback mechanism to check for missed payments when webhooks fail
 */
export const checkMissedPayments = async (): Promise<{
  checked: number;
  found: number;
  processed: number;
  alreadyProcessed: number;
  skippedTooRecent: number;
  errors: string[];
}> => {
  const result = {
    checked: 0,
    found: 0,
    processed: 0,
    alreadyProcessed: 0,
    skippedTooRecent: 0,
    errors: [] as string[],
  };

  try {
    console.log("[MerchantPool] 🔍 Checking for missed payments (webhook fallback)...");
    console.log(`[MerchantPool] ⏱️ Webhook grace period: ${WEBHOOK_GRACE_PERIOD_MINUTES} minutes`);

    const reservedAddresses = await merchantTempAddressModel.findAll({
      where: { status: 'RESERVED' },
      attributes: [
        'temp_address_id', 'wallet_address', 'wallet_type', 'owner_user_id',
        'current_company_id', 'current_payment_id', 'reserved_until',
        'expected_amount', 'received_amount'
      ],
    });

    console.log(`[MerchantPool] 📋 Found ${reservedAddresses.length} reserved addresses to check`);

    for (const addr of reservedAddresses) {
      result.checked++;
      
      const walletAddress = addr.dataValues.wallet_address;
      const walletType = addr.dataValues.wallet_type;
      const currentPaymentId = addr.dataValues.current_payment_id;
      const expectedAmount = parseFloat(addr.dataValues.expected_amount || '0');
      const ownerId = addr.dataValues.owner_user_id;
      const companyId = addr.dataValues.current_company_id;
      const reservedUntil = addr.dataValues.reserved_until ? new Date(addr.dataValues.reserved_until) : null;
      const now = new Date();
      
      if (!reservedUntil) {
        console.log(`[MerchantPool] ⏭️ Skipping ${walletAddress} - no reserved_until timestamp`);
        continue;
      }
      
      const minutesUntilExpiry = (reservedUntil.getTime() - now.getTime()) / 60000;
      const minutesSinceReserved = POOL_CONFIG.RESERVATION_TIMEOUT_MINUTES - minutesUntilExpiry;
      
      if (minutesSinceReserved < WEBHOOK_GRACE_PERIOD_MINUTES) {
        result.skippedTooRecent++;
        if (minutesSinceReserved > 5) {
          console.log(`[MerchantPool] ⏭️ ${walletAddress} - reserved ${minutesSinceReserved.toFixed(1)} min ago (waiting for ${WEBHOOK_GRACE_PERIOD_MINUTES} min grace period)`);
        }
        continue;
      }

      try {
        let balanceResult;
        try {
          balanceResult = await tatumApi.getAddressBalance(walletAddress, walletType);
        } catch (balanceError: unknown) {
          const balErr = balanceError as { message?: string };
          const errMsg = balErr.message || '';
          if (errMsg.includes('account.not.found') || errMsg.includes('not.found')) {
            console.log(`[MerchantPool] ⏭️ ${walletAddress} - account not yet activated on-chain (${walletType}), skipping`);
            continue;
          }
          throw balanceError;
        }
        const balance = parseFloat(balanceResult?.balance || '0');

        if (balance <= 0) {
          console.log(`[MerchantPool] ⏭️ ${walletAddress} - no balance (customer hasn't paid)`);
          continue;
        }

        // Skip dust balances — leftover gas residue is not a real payment
        const DUST_THRESHOLDS: Record<string, number> = {
          ETH: 0.0005,      // ~$1
          BTC: 0.00002,     // ~$1
          LTC: 0.01,        // ~$1
          DOGE: 5,           // ~$1
          TRX: 5,            // ~$1
          'USDT-ERC20': 0.5,
          'USDT-TRC20': 0.5,
          'USDC-ERC20': 0.5,
        };
        const dustThreshold = DUST_THRESHOLDS[walletType] || 0.001;
        
        if (balance < dustThreshold) {
          console.log(`[MerchantPool] ⏭️ ${walletAddress} - dust balance ${balance} ${walletType} (below ${dustThreshold} threshold), skipping`);
          continue;
        }

        // Skip if expected_amount is 0 — no payment was actually requested for this address
        if (expectedAmount <= 0) {
          console.log(`[MerchantPool] ⏭️ ${walletAddress} - expected_amount is ${expectedAmount}, likely stale reservation with dust. Skipping.`);
          continue;
        }

        console.log(`[MerchantPool] 💰 ${walletAddress} has balance: ${balance} ${walletType} (reserved ${minutesSinceReserved.toFixed(1)} min ago)`);

        let redisData = await getRedisItem("crypto-" + walletAddress);
        
        if (redisData?.txId) {
          console.log(`[MerchantPool] ⏭️ ${walletAddress} - Redis has txId (webhook already fired): ${redisData.txId}`);
          result.alreadyProcessed++;
          continue;
        }
        
        if (redisData?.status === 'processing' || redisData?.status === 'retrying') {
          console.log(`[MerchantPool] ⏭️ ${walletAddress} - Webhook currently processing (status: ${redisData.status})`);
          result.alreadyProcessed++;
          continue;
        }

        if (redisData?.incomplete === 'true' || redisData?.incomplete === true) {
          const receivedSoFar = parseFloat(redisData?.receivedAmount || '0');
          const originalExpected = parseFloat(redisData?.originalExpectedAmount || redisData?.amount || '0');
          const remaining = originalExpected - receivedSoFar;
          
          console.log(`[MerchantPool] ⏸️ ${walletAddress} - PARTIAL PAYMENT in progress`);
          console.log(`[MerchantPool]    - Received so far: ${receivedSoFar} ${walletType}`);
          console.log(`[MerchantPool]    - Expected: ${originalExpected} ${walletType}`);
          console.log(`[MerchantPool]    - Remaining: ${remaining} ${walletType}`);
          
          const partialTimestamp = redisData?.partialPaymentTimestamp;
          if (partialTimestamp) {
            const partialTime = new Date(partialTimestamp);
            const minutesSincePartial = (now.getTime() - partialTime.getTime()) / 60000;
            
            if (minutesSincePartial < 20) {
              console.log(`[MerchantPool] ⏭️ Waiting for completion - partial received ${minutesSincePartial.toFixed(1)} min ago`);
              result.skippedTooRecent++;
              continue;
            } else {
              console.log(`[MerchantPool] ⚠️ Partial payment expired (${minutesSincePartial.toFixed(1)} min) - will process as-is`);
            }
          }
        }

        const poolAddressRecord = await merchantTempAddressModel.findOne({
          where: { wallet_address: walletAddress }
        });
        
        if (poolAddressRecord?.dataValues?.is_partial_payment === true) {
          const dbReceivedAmount = parseFloat(poolAddressRecord.dataValues.received_amount || '0');
          const dbExpectedAmount = parseFloat(poolAddressRecord.dataValues.expected_amount || '0');
          const partialTimestamp = poolAddressRecord.dataValues.partial_payment_timestamp;
          
          console.log(`[MerchantPool] ⏸️ ${walletAddress} - DB shows partial payment`);
          console.log(`[MerchantPool]    - DB Received: ${dbReceivedAmount}, Expected: ${dbExpectedAmount}`);
          
          if (partialTimestamp) {
            const partialTime = new Date(partialTimestamp);
            const minutesSincePartial = (now.getTime() - partialTime.getTime()) / 60000;
            
            if (minutesSincePartial < 20) {
              console.log(`[MerchantPool] ⏭️ Waiting for completion - DB partial ${minutesSincePartial.toFixed(1)} min ago`);
              result.skippedTooRecent++;
              continue;
            }
          }
        }

        if (currentPaymentId) {
          const existingTx = await customerTransactionModel.findOne({
            where: {
              [Op.or]: [
                { transaction_reference: currentPaymentId },
                { transaction_reference: { [Op.like]: `%${walletAddress}%` } }
              ],
              status: { [Op.in]: ['successful', 'completed', 'confirmed'] }
            }
          });

          if (existingTx) {
            console.log(`[MerchantPool] ⏭️ ${walletAddress} - Already processed in DB (tx: ${existingTx.dataValues.transaction_reference})`);
            result.alreadyProcessed++;
            continue;
          }
        }

        const poolTx = await merchantPoolTransactionModel.findOne({
          where: {
            temp_address_id: addr.dataValues.temp_address_id,
            status: { [Op.in]: ['completed', 'swept'] }
          },
          order: [['created_at', 'DESC']]
        });

        if (poolTx) {
          const txCreatedAt = new Date(poolTx.dataValues.created_at);
          const hoursSinceTx = (now.getTime() - txCreatedAt.getTime()) / 3600000;
          
          if (hoursSinceTx < 1) {
            console.log(`[MerchantPool] ⏭️ ${walletAddress} - Recent pool transaction exists (${hoursSinceTx.toFixed(1)}h ago)`);
            result.alreadyProcessed++;
            continue;
          }
        }

        result.found++;
        console.log(`[MerchantPool] ⚠️ MISSED PAYMENT DETECTED: ${walletAddress}`);
        console.log(`[MerchantPool]   - Balance: ${balance} ${walletType}`);
        console.log(`[MerchantPool]   - Expected: ${expectedAmount} ${walletType}`);
        console.log(`[MerchantPool]   - Payment ID: ${currentPaymentId || 'N/A'}`);
        console.log(`[MerchantPool]   - Reserved ${minutesSinceReserved.toFixed(1)} min ago`);
        
        const tolerance = expectedAmount * 0.01;
        const isUnderpayment = balance < (expectedAmount - tolerance);
        
        if (isUnderpayment && minutesSinceReserved < 25) {
          console.log(`[MerchantPool] ⏸️ UNDERPAYMENT detected - waiting for customer to send remaining`);
          console.log(`[MerchantPool]    - Received: ${balance} ${walletType}`);
          console.log(`[MerchantPool]    - Expected: ${expectedAmount} ${walletType}`);
          console.log(`[MerchantPool]    - Shortfall: ${(expectedAmount - balance).toFixed(8)} ${walletType}`);
          console.log(`[MerchantPool]    - Reserved ${minutesSinceReserved.toFixed(1)} min ago (waiting until 25 min)`);
          result.skippedTooRecent++;
          continue;
        }
        
        if (isUnderpayment) {
          console.log(`[MerchantPool] ⚠️ UNDERPAYMENT - processing as partial (reservation expired)`);
          console.log(`[MerchantPool]    - Received: ${balance} ${walletType} (${((balance/expectedAmount)*100).toFixed(1)}% of expected)`);
        }
        
        console.log(`[MerchantPool] 🔄 Fetching transaction details from blockchain...`);
        const incomingTxs = await tatumApi.getIncomingTransactions(walletAddress, walletType, 5);
        
        if (!incomingTxs || incomingTxs.length === 0) {
          // Track repeated failures to avoid infinite retry loops
          const failKey = `missed-check-fail:${walletAddress}`;
          const failData = await getRedisItem(failKey);
          const failCount = parseInt(failData?.count || '0', 10) + 1;
          
          await setRedisItem(failKey, { count: String(failCount), lastCheck: new Date().toISOString() });
          
          if (failCount >= 3) {
            // Before giving up, check if this is a REAL payment with significant balance
            // If address has current_payment_id and balance is above dust, try to process using last_payment_context
            const hasPaymentContext = !!currentPaymentId && balance > (dustThreshold * 5); // Well above dust
            
            if (hasPaymentContext) {
              console.log(`[MerchantPool] ⚠️ ${walletAddress} - Tatum tx lookup failed ${failCount} times BUT address has payment context and significant balance ${balance} ${walletType}`);
              console.log(`[MerchantPool] 🔄 Attempting to process using payment context (bypassing tx lookup)...`);
              
              // Try to get last_payment_context from DB
              const addrRecord = await merchantTempAddressModel.findOne({ where: { wallet_address: walletAddress } });
              const lastContextRaw = addrRecord?.dataValues?.last_payment_context;
              let paymentContext = null;
              
              if (lastContextRaw) {
                try {
                  paymentContext = typeof lastContextRaw === 'string' ? JSON.parse(lastContextRaw) : lastContextRaw;
                  console.log(`[MerchantPool] 📝 Found last_payment_context for ${walletAddress} (payment: ${paymentContext.payment_id})`);
                } catch (e) {
                  console.warn(`[MerchantPool] ⚠️ Failed to parse last_payment_context for ${walletAddress}`);
                }
              }
              
              // Reconstruct Redis data from payment context or DB fields
              const reconstructedRedis = {
                mode: 'CRYPTO',
                amount: String(expectedAmount),
                status: 'processing',
                currency: walletType,
                payment_id: currentPaymentId,
                unique_tx_id: currentPaymentId,
                is_merchant_pool: 'true',
                temp_id: String(addr.dataValues.temp_address_id),
                adm_id: String(paymentContext?.adm_id || ownerId),
                company_id: String(paymentContext?.company_id || companyId),
                receivedAmount: String(balance),
                originalExpectedAmount: String(expectedAmount),
                fee_payer: paymentContext?.fee_payer || 'company',
                merchant_amount: paymentContext?.merchant_amount || null,
                base_currency: paymentContext?.base_currency || 'USD',
                base_amount: paymentContext?.base_amount || null,
                webhook_url: paymentContext?.webhook_url || null,
                callback_url: paymentContext?.callback_url || null,
                link_id: paymentContext?.link_id || null,
                ref: paymentContext?.ref || `customer-${currentPaymentId}`,
                processedByFallback: 'true',
                txLookupFailed: 'true',
                lastAttempt: new Date().toISOString(),
              };
              
              // Also reconstruct customer ref
              const custRef = reconstructedRedis.ref;
              const existingCustData = await getRedisItem(custRef);
              if (!existingCustData || Object.keys(existingCustData).length === 0) {
                const custData = {
                  adm_id: reconstructedRedis.adm_id,
                  company_id: reconstructedRedis.company_id,
                  base_currency: reconstructedRedis.base_currency,
                  base_amount: reconstructedRedis.base_amount,
                  fee_payer: reconstructedRedis.fee_payer,
                  merchant_amount: reconstructedRedis.merchant_amount,
                  webhook_url: reconstructedRedis.webhook_url,
                  callback_url: reconstructedRedis.callback_url,
                  link_id: reconstructedRedis.link_id,
                  customer_name: paymentContext?.customer_name || null,
                  customer_email: paymentContext?.customer_email || null,
                };
                await setRedisItem(custRef, custData);
                console.log(`[MerchantPool] 📝 Reconstructed customer data: ${custRef}`);
              }
              
              await setRedisItem("crypto-" + walletAddress, reconstructedRedis);
              console.log(`[MerchantPool] 📝 Reconstructed Redis data for ${walletAddress} — processing via cryptoVerification`);
              
              try {
                const verificationResult = await paymentController.cryptoVerification(walletAddress, true) as { duplicate?: boolean; status?: number; paymentStatus?: string };
                
                if (verificationResult?.duplicate) {
                  console.log(`[MerchantPool] ⏭️ Payment already processed (duplicate)`);
                  result.alreadyProcessed++;
                } else if (verificationResult?.status === 200 || verificationResult?.paymentStatus === 'completed' || verificationResult?.paymentStatus === 'complete') {
                  console.log(`[MerchantPool] ✅ MISSED PAYMENT RECOVERED (via context fallback)!`);
                  console.log(`[MerchantPool]   - Address: ${walletAddress}, Amount: ${balance} ${walletType}`);
                  result.processed++;
                  
                  cronLogger?.info?.("MISSED PAYMENT RECOVERED VIA CONTEXT", {
                    address: walletAddress,
                    currency: walletType,
                    amount: balance,
                    expectedAmount,
                    paymentId: currentPaymentId,
                    txLookupFailed: true,
                  });
                } else {
                  console.log(`[MerchantPool] ⚠️ cryptoVerification returned:`, verificationResult);
                  result.errors.push(`Context fallback verification returned unexpected result for ${walletAddress}`);
                }
              } catch (verifyError: unknown) {
                const err = verifyError as { paymentStatus?: string; amount?: number; message?: string };
                if (err?.paymentStatus === 'incomplete') {
                  console.log(`[MerchantPool] 📋 Partial payment via context fallback - ${err.amount} ${walletType} remaining`);
                  result.processed++;
                } else {
                  console.error(`[MerchantPool] ❌ Context fallback cryptoVerification failed:`, err.message || verifyError);
                  result.errors.push(`Context fallback verification failed for ${walletAddress}: ${err.message}`);
                }
              }
              
              await deleteRedisItem(failKey);
              continue;
            }
            
            // No payment context or balance too low — truly dust, release
            console.log(`[MerchantPool] ⚠️ ${walletAddress} - No incoming txs found after ${failCount} checks. Balance ${balance} ${walletType} is likely pre-existing dust. Releasing address.`);
            await merchantTempAddressModel.update(
              { status: 'AVAILABLE', current_payment_id: null, expected_amount: null, reserved_until: null, current_company_id: null },
              { where: { wallet_address: walletAddress } }
            );
            await deleteRedisItem(failKey);
            result.errors.push(`Released ${walletAddress} after ${failCount} failed tx lookups (dust: ${balance} ${walletType})`);
          } else {
            console.log(`[MerchantPool] ❌ No incoming transactions found for ${walletAddress} (attempt ${failCount}/3). Will retry.`);
            result.errors.push(`No transactions found for ${walletAddress} (attempt ${failCount}/3)`);
          }
          continue;
        }

        const latestTx = incomingTxs[0];
        
        const totalFromTxs = incomingTxs.reduce((sum, tx) => sum + tx.amount, 0);
        console.log(`[MerchantPool] 📝 Found ${incomingTxs.length} transaction(s): latest txId=${latestTx.txId}`);
        console.log(`[MerchantPool]    - Latest tx amount: ${latestTx.amount} ${walletType}`);
        console.log(`[MerchantPool]    - Total from all txs: ${totalFromTxs} ${walletType}`);

        const confirmationCheck = await tatumApi.getTransactionConfirmations(latestTx.txId, walletType);
        
        if (!confirmationCheck.confirmed) {
          console.log(`[MerchantPool] ⏳ Transaction not yet confirmed - waiting for confirmations`);
          console.log(`[MerchantPool]    - Current: ${confirmationCheck.confirmations}/${confirmationCheck.required} confirmations`);
          console.log(`[MerchantPool]    - ${walletType} requires ${confirmationCheck.required} confirmation(s) before processing`);
          result.skippedTooRecent++;
          continue;
        }
        
        console.log(`[MerchantPool] ✅ Transaction confirmed: ${confirmationCheck.confirmations}/${confirmationCheck.required} confirmations`);

        const processedTxKey = `processed-tx-${latestTx.txId}`;
        const alreadyProcessedTx = await getRedisItem(processedTxKey);
        if (alreadyProcessedTx && Object.keys(alreadyProcessedTx).length > 0) {
          console.log(`[MerchantPool] ⏭️ Transaction ${latestTx.txId} already processed previously. Skipping.`);
          result.alreadyProcessed++;
          continue;
        }

        if (!redisData || Object.keys(redisData).length === 0) {
          console.log(`[MerchantPool] ⚠️ No Redis data for ${walletAddress}, attempting to reconstruct...`);
          
          redisData = {
            mode: 'CRYPTO',
            amount: expectedAmount,
            status: 'pending',
            currency: walletType,
            payment_id: currentPaymentId,
            is_merchant_pool: 'true',
            adm_id: ownerId,
            company_id: companyId,
          };
          
          const customerRef = `customer-${currentPaymentId}`;
          let customerData = await getRedisItem(customerRef);
          
          if (!customerData || Object.keys(customerData).length === 0) {
            customerData = {
              adm_id: ownerId,
              company_id: companyId,
              base_currency: 'USD',
            };
            await setRedisItem(customerRef, customerData);
            console.log(`[MerchantPool] 📝 Reconstructed customer data: ${customerRef}`);
          }
          
          redisData.ref = customerRef;
        }

        const receivedAmount = balance;
        const isPartialPayment = receivedAmount < (expectedAmount - tolerance);
        
        const updatedRedisData = {
          ...redisData,
          status: 'processing',
          receivedAmount: receivedAmount,
          txId: latestTx.txId,
          originalExpectedAmount: expectedAmount,
          retryCount: '0',
          lastAttempt: new Date().toISOString(),
          processedByFallback: 'true',
          incomplete: isPartialPayment ? 'true' : 'false',
          ...(isPartialPayment && {
            partialPaymentTimestamp: new Date().toISOString(),
            remaining: (expectedAmount - receivedAmount).toFixed(8),
          }),
        };
        
        await setRedisItem("crypto-" + walletAddress, updatedRedisData);
        console.log(`[MerchantPool] 📝 Updated Redis with txId: ${latestTx.txId}`);
        if (isPartialPayment) {
          console.log(`[MerchantPool] 📝 Marked as partial payment - received ${receivedAmount}, expected ${expectedAmount}`);
        }

        await setRedisItem(processedTxKey, {
          address: walletAddress,
          amount: receivedAmount,
          expectedAmount,
          isPartialPayment,
          processedAt: new Date().toISOString(),
          processedBy: 'checkMissedPayments',
        });

        console.log(`[MerchantPool] 🚀 Processing missed payment via cryptoVerification...`);
        
        try {
          const verificationResult = await paymentController.cryptoVerification(walletAddress, true) as { duplicate?: boolean; status?: number; paymentStatus?: string };
          
          if (verificationResult?.duplicate) {
            console.log(`[MerchantPool] ⏭️ Payment was already processed (duplicate detected)`);
            result.alreadyProcessed++;
          } else if (verificationResult?.status === 200 || verificationResult?.paymentStatus === 'completed' || verificationResult?.paymentStatus === 'complete') {
            console.log(`[MerchantPool] ✅ MISSED PAYMENT SUCCESSFULLY PROCESSED!`);
            console.log(`[MerchantPool]   - Address: ${walletAddress}`);
            console.log(`[MerchantPool]   - Amount: ${receivedAmount} ${walletType}`);
            console.log(`[MerchantPool]   - TxId: ${latestTx.txId}`);
            console.log(`[MerchantPool]   - Type: ${isPartialPayment ? 'PARTIAL' : 'FULL'} payment`);
            result.processed++;
            
            cronLogger?.info?.("MISSED PAYMENT RECOVERED", {
              address: walletAddress,
              currency: walletType,
              amount: receivedAmount,
              txId: latestTx.txId,
              expectedAmount,
              isPartialPayment,
              ownerId,
              companyId,
            });
          } else {
            console.log(`[MerchantPool] ⚠️ cryptoVerification returned:`, verificationResult);
            result.errors.push(`Verification returned unexpected result for ${walletAddress}`);
          }
        } catch (verifyError: unknown) {
          const err = verifyError as { paymentStatus?: string; amount?: number; message?: string };
          if (err?.paymentStatus === 'incomplete') {
            console.log(`[MerchantPool] 📋 Partial payment detected - ${err.amount} ${walletType} remaining`);
            result.processed++;
          } else {
            console.error(`[MerchantPool] ❌ cryptoVerification failed:`, err.message || verifyError);
            result.errors.push(`Verification failed for ${walletAddress}: ${err.message || 'Unknown error'}`);
          }
        }
        
      } catch (error: unknown) {
        const err = error as { message?: string };
        console.error(`[MerchantPool] ❌ Error processing ${walletAddress}:`, err.message);
        result.errors.push(`Processing failed for ${walletAddress}: ${err.message}`);
      }
    }

    console.log(`[MerchantPool] ✅ Missed payment check complete:`);
    console.log(`[MerchantPool]   - Checked: ${result.checked}`);
    console.log(`[MerchantPool]   - Skipped (too recent): ${result.skippedTooRecent}`);
    console.log(`[MerchantPool]   - Already processed: ${result.alreadyProcessed}`);
    console.log(`[MerchantPool]   - Missed found: ${result.found}`);
    console.log(`[MerchantPool]   - Successfully processed: ${result.processed}`);
    if (result.errors.length > 0) {
      console.log(`[MerchantPool]   - Errors: ${result.errors.length}`);
    }
    
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[MerchantPool] ❌ Missed payment check failed:", err.message);
    result.errors.push(`Global error: ${err.message}`);
  }

  return result;
};

/**
 * Detect orphan payments on AVAILABLE addresses
 */
export const detectOrphanPayments = async (): Promise<{
  checked: number;
  found: number;
  processed: number;
  alreadyProcessed: number;
  sweptToAdmin: number;
  errors: string[];
}> => {
  const result = {
    checked: 0,
    found: 0,
    processed: 0,
    alreadyProcessed: 0,
    sweptToAdmin: 0,
    errors: [] as string[],
  };

  try {
    console.log("[OrphanDetect] 🔍 Scanning AVAILABLE addresses for orphan payments...");

    const availableAddresses = await merchantTempAddressModel.findAll({
      where: { status: "AVAILABLE" },
      attributes: [
        'temp_address_id', 'wallet_address', 'wallet_type',
        'owner_user_id', 'admin_fee_balance', 'last_payment_context',
        'subscription_id',
      ],
    });

    console.log(`[OrphanDetect] 📋 Found ${availableAddresses.length} AVAILABLE addresses to scan`);

    for (const addr of availableAddresses) {
      result.checked++;

      const walletAddress = addr.dataValues.wallet_address;
      const walletType = addr.dataValues.wallet_type;
      const ownerId = addr.dataValues.owner_user_id;
      const tempAddressId = addr.dataValues.temp_address_id;
      const existingAdminBalance = parseFloat(addr.dataValues.admin_fee_balance || '0');
      const lastContextRaw = addr.dataValues.last_payment_context;

      try {
        let balanceResult;
        try {
          balanceResult = await tatumApi.getAddressBalance(walletAddress, walletType);
        } catch (balanceError: unknown) {
          const balErr = balanceError as { message?: string };
          const errMsg = balErr.message || '';
          if (errMsg.includes('account.not.found') || errMsg.includes('not.found')) {
            continue;
          }
          throw balanceError;
        }
        const balance = parseFloat(balanceResult?.balance || '0');

        if (balance <= 0) {
          continue;
        }

        const DUST_THRESHOLDS: Record<string, number> = {
          BTC: 0.00005, ETH: 0.002, TRX: 20, LTC: 0.05,
          DOGE: 25, BCH: 0.01, BSC: 0.008,
        };
        const dustThreshold = DUST_THRESHOLDS[walletType] || 0;
        if (!TOKEN_CHAINS.includes(walletType) && balance < dustThreshold) {
          continue;
        }

        if (existingAdminBalance > 0 && Math.abs(balance - existingAdminBalance) / existingAdminBalance < 0.01) {
          continue;
        }

        if (TOKEN_CHAINS.includes(walletType) && balance <= existingAdminBalance * 1.01) {
          continue;
        }

        const existingRedis = await getRedisItem("crypto-" + walletAddress);
        if (existingRedis?.txId || existingRedis?.status === 'processing') {
          result.alreadyProcessed++;
          continue;
        }

        const recentPoolTx = await merchantPoolTransactionModel.findOne({
          where: {
            temp_address_id: tempAddressId,
            status: { [Op.in]: ['completed', 'swept'] },
          },
          order: [['created_at', 'DESC']],
        });
        if (recentPoolTx) {
          const hoursSince = (Date.now() - new Date(recentPoolTx.dataValues.created_at).getTime()) / 3600000;
          if (hoursSince < 4) {
            result.alreadyProcessed++;
            continue;
          }
        }

        result.found++;
        console.log(`[OrphanDetect] ⚠️ ORPHAN PAYMENT DETECTED on AVAILABLE address: ${walletAddress}`);
        console.log(`[OrphanDetect]   - Balance: ${balance} ${walletType}`);
        console.log(`[OrphanDetect]   - Known admin fees: ${existingAdminBalance}`);
        console.log(`[OrphanDetect]   - Excess (orphan amount): ${(balance - existingAdminBalance).toFixed(8)} ${walletType}`);
        console.log(`[OrphanDetect]   - Owner merchant: ${ownerId}`);
        console.log(`[OrphanDetect]   - Has saved context: ${!!lastContextRaw}`);

        const incomingTxs = await tatumApi.getIncomingTransactions(walletAddress, walletType, 10);
        if (!incomingTxs || incomingTxs.length === 0) {
          console.log(`[OrphanDetect] ❌ No incoming transactions found for ${walletAddress} despite balance. Skipping.`);
          result.errors.push(`No transactions found for ${walletAddress} despite balance ${balance}`);
          continue;
        }

        const latestTx = incomingTxs[0];

        const processedTxKey = `processed-tx-${latestTx.txId}`;
        const alreadyProcessedTx = await getRedisItem(processedTxKey);
        if (alreadyProcessedTx && Object.keys(alreadyProcessedTx).length > 0) {
          console.log(`[OrphanDetect] ⏭️ Transaction ${latestTx.txId} already processed. Skipping.`);
          result.alreadyProcessed++;
          continue;
        }

        const confirmationCheck = await tatumApi.getTransactionConfirmations(latestTx.txId, walletType);
        if (!confirmationCheck.confirmed) {
          console.log(`[OrphanDetect] ⏳ Tx not yet confirmed (${confirmationCheck.confirmations}/${confirmationCheck.required}). Will retry next cycle.`);
          continue;
        }

        let paymentContext: Record<string, unknown> | null = null;
        if (lastContextRaw) {
          try {
            paymentContext = JSON.parse(lastContextRaw as string);
            console.log(`[OrphanDetect] 📋 Loaded payment context: payment_id=${paymentContext?.payment_id}, company=${paymentContext?.company_id}`);
          } catch {
            console.warn(`[OrphanDetect] ⚠️ Failed to parse last_payment_context for ${walletAddress}`);
          }
        }

        const companyId = paymentContext?.company_id || null;
        const paymentId = paymentContext?.payment_id || `orphan-${walletAddress}-${Date.now()}`;
        const feePayer = (paymentContext?.fee_payer as string) || 'company';
        const expectedAmount = parseFloat((paymentContext?.expected_amount as string) || '0');
        const baseCurrency = (paymentContext?.base_currency as string) || 'USD';
        const baseAmount = paymentContext?.base_amount || paymentContext?.expected_amount || null;

        const customerRef = paymentContext?.ref || `orphan-customer-${paymentId}`;

        const reconstructedRedis = {
          mode: 'CRYPTO',
          amount: expectedAmount || balance,
          status: 'processing',
          currency: walletType,
          payment_id: paymentId,
          is_merchant_pool: 'true',
          adm_id: ownerId,
          company_id: companyId,
          fee_payer: feePayer,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          txId: latestTx.txId,
          receivedAmount: balance,
          originalExpectedAmount: expectedAmount || balance,
          processedByOrphanDetect: 'true',
          recoveredAt: new Date().toISOString(),
          ref: customerRef as string,
          ...(paymentContext?.webhook_url && { webhook_url: paymentContext.webhook_url }),
          ...(paymentContext?.callback_url && { callback_url: paymentContext.callback_url }),
          ...(paymentContext?.link_id && { link_id: paymentContext.link_id }),
        };
        const customerData = {
          adm_id: paymentContext?.adm_id || ownerId,
          company_id: companyId,
          base_currency: baseCurrency,
          customer_name: paymentContext?.customer_name || null,
          customer_email: paymentContext?.customer_email || null,
          webhook_url: paymentContext?.webhook_url || null,
          callback_url: paymentContext?.callback_url || null,
          link_id: paymentContext?.link_id || null,
        };

        await setRedisItem("crypto-" + walletAddress, reconstructedRedis);
        await setRedisItem(customerRef as string, customerData);

        await setRedisItem(processedTxKey, {
          address: walletAddress,
          amount: balance,
          processedAt: new Date().toISOString(),
          processedBy: 'detectOrphanPayments',
          hadContext: !!lastContextRaw,
        });

        console.log(`[OrphanDetect] 📝 Redis reconstructed. Calling cryptoVerification...`);

        try {
          const verificationResult = await paymentController.cryptoVerification(walletAddress, true) as { 
            duplicate?: boolean; 
            status?: number; 
            paymentStatus?: string 
          };

          if (verificationResult?.duplicate) {
            console.log(`[OrphanDetect] ⏭️ Payment was already processed (duplicate)`);
            result.alreadyProcessed++;
          } else if (
            verificationResult?.status === 200 || 
            verificationResult?.paymentStatus === 'completed' || 
            verificationResult?.paymentStatus === 'complete'
          ) {
            console.log(`[OrphanDetect] ✅ ORPHAN PAYMENT SUCCESSFULLY RECOVERED!`);
            console.log(`[OrphanDetect]   - Address: ${walletAddress}`);
            console.log(`[OrphanDetect]   - Amount: ${balance} ${walletType}`);
            console.log(`[OrphanDetect]   - TxId: ${latestTx.txId}`);
            console.log(`[OrphanDetect]   - Original payment: ${paymentContext?.payment_id || 'unknown'}`);
            console.log(`[OrphanDetect]   - Merchant: ${ownerId}, Company: ${companyId || 'unknown'}`);
            result.processed++;

            await recordPoolTransaction({
              tempAddressId: tempAddressId,
              ownerUserId: ownerId,
              companyId: companyId as number,
              paymentReference: `orphan-recovery:${paymentId as string}`,
              walletType: walletType,
              paymentAmount: balance,
              merchantAmount: 0,
              adminFeeAmount: 0,
              incomingTxId: latestTx.txId,
              status: 'completed',
            });

            if (paymentContext?.webhook_url || paymentContext?.callback_url || companyId) {
              try {
                await callMerchantWebhook(customerData, {
                  event: 'payment.confirmed',
                  payment_id: paymentId,
                  transaction_reference: latestTx.txId,
                  status: 'completed',
                  amount: balance,
                  currency: walletType,
                  recovered: true,
                  recovery_type: 'orphan_detection',
                  original_payment_id: paymentContext?.payment_id || null,
                  customer_name: paymentContext?.customer_name || null,
                  customer_email: paymentContext?.customer_email || null,
                });
                console.log(`[OrphanDetect] 📤 Recovery webhook sent to merchant`);
              } catch (webhookError) {
                console.warn(`[OrphanDetect] ⚠️ Recovery webhook failed (non-blocking):`, webhookError);
              }
            }

            await addr.update({ last_payment_context: null });

            cronLogger?.info?.("ORPHAN PAYMENT RECOVERED", {
              address: walletAddress,
              currency: walletType,
              amount: balance,
              txId: latestTx.txId,
              originalPaymentId: paymentContext?.payment_id,
              ownerId,
              companyId,
              hadContext: !!lastContextRaw,
            });
          } else {
            console.log(`[OrphanDetect] ⚠️ cryptoVerification returned:`, verificationResult);
            result.errors.push(`Verification returned unexpected result for ${walletAddress}`);
          }
        } catch (verifyError: unknown) {
          const err = verifyError as { paymentStatus?: string; amount?: number; message?: string };
          if (err?.paymentStatus === 'incomplete') {
            console.log(`[OrphanDetect] 📋 Partial orphan payment - ${err.amount} remaining`);
            result.processed++;
            await addr.update({ last_payment_context: null });
          } else {
            console.error(`[OrphanDetect] ❌ cryptoVerification failed:`, err.message || verifyError);
            result.errors.push(`Verification failed for ${walletAddress}: ${err.message || 'Unknown error'}`);
          }
        }

      } catch (error: unknown) {
        const err = error as { message?: string };
        console.error(`[OrphanDetect] ❌ Error processing ${walletAddress}:`, err.message);
        result.errors.push(`Processing failed for ${walletAddress}: ${err.message}`);
      }
    }

    console.log(`[OrphanDetect] ✅ Orphan payment scan complete:`);
    console.log(`[OrphanDetect]   - Scanned: ${result.checked}`);
    console.log(`[OrphanDetect]   - Already processed: ${result.alreadyProcessed}`);
    console.log(`[OrphanDetect]   - Orphans found: ${result.found}`);
    console.log(`[OrphanDetect]   - Successfully recovered: ${result.processed}`);
    console.log(`[OrphanDetect]   - Swept to admin: ${result.sweptToAdmin}`);
    if (result.errors.length > 0) {
      console.log(`[OrphanDetect]   - Errors: ${result.errors.length}`);
    }

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[OrphanDetect] ❌ Orphan detection scan failed:", err.message);
    result.errors.push(`Global error: ${err.message}`);
  }

  return result;
};
