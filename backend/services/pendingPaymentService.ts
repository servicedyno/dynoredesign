/**
 * Pending Payment Notification Service
 * Handles notifications for unconfirmed/pending crypto payments
 */

import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { createNotification, NOTIFICATION_TYPES } from "../controller/notificationController";
import { 
  sendPaymentPendingEmail, 
  sendPaymentConfirmingEmail,
  sendPaymentPartialEmail,
  sendPaymentPartialExpiredEmail
} from "../helper";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";

// Confirmation requirements by blockchain
export const CONFIRMATION_REQUIREMENTS: Record<string, number> = {
  BTC: 1,      // 1 confirmation for BTC (can be increased for larger amounts)
  ETH: 12,     // 12 confirmations for ETH
  LTC: 6,      // 6 confirmations for LTC
  DOGE: 6,     // 6 confirmations for DOGE
  BCH: 6,      // 6 confirmations for BCH
  TRX: 19,     // 19 confirmations for TRON
  "USDT-TRC20": 19,
  "USDT-ERC20": 12,
};

// Estimated confirmation times (in minutes)
export const ESTIMATED_CONFIRMATION_TIMES: Record<string, string> = {
  BTC: "10-60 minutes",
  ETH: "1-5 minutes",
  LTC: "2-30 minutes",
  DOGE: "1-10 minutes",
  BCH: "10-60 minutes",
  TRX: "1-3 minutes",
  "USDT-TRC20": "1-3 minutes",
  "USDT-ERC20": "1-5 minutes",
};

interface PendingPaymentData {
  address: string;
  txId: string;
  amount: number;
  currency: string;
  customerRef: string;
  userId: number;
  companyId: number;
  notificationSent?: boolean;
  confirmations?: number;
}

/**
 * Send pending payment notification when transaction is first detected
 */
export const sendPendingPaymentNotification = async (
  address: string,
  txId: string,
  amount: number,
  currency: string,
  customerData: { name?: string; email?: string; phone?: string; metadata?: Record<string, unknown> }
): Promise<boolean> => {
  try {
    // Check if we already sent a pending notification for this transaction
    const pendingKey = `pending-notif-${txId}`;
    const existingNotification = await getRedisItem(pendingKey);
    
    if (existingNotification && existingNotification.sent) {
      console.log(`Pending notification already sent for tx: ${txId}`);
      return false;
    }
    
    // RACE CONDITION FIX: Set flag immediately before doing any work
    // to prevent duplicate notifications from concurrent webhook calls
    await setRedisItem(pendingKey, {
      sent: true,
      sentAt: new Date().toISOString(),
      txId,
      address,
      status: 'sending', // Will be updated to 'completed' after success
    });

    // Get user and company details
    const userResult = await sequelize.query(
      `SELECT u.user_id, u.name, u.email, c.company_name, c.company_id
       FROM tbl_user u
       JOIN tbl_company c ON c.user_id = u.user_id
       WHERE u.user_id = :userId`,
      {
        replacements: { userId: customerData.adm_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (!userResult || userResult.length === 0) {
      console.log("User not found for pending notification");
      return false;
    }

    const user = userResult[0];
    const confirmationsRequired = CONFIRMATION_REQUIREMENTS[currency] || 1;

    // Create in-app notification
    await createNotification(
      user.user_id,
      NOTIFICATION_TYPES.PAYMENT_PENDING,
      "Payment Pending Confirmation",
      `A payment of ${amount} ${currency} has been detected and is awaiting blockchain confirmation. Transaction ID: ${txId.substring(0, 16)}...`,
      {
        tx_id: txId,
        amount: amount,
        currency: currency,
        address: address,
        confirmations_required: confirmationsRequired,
        estimated_time: ESTIMATED_CONFIRMATION_TIMES[currency] || "1-10 minutes",
        status: "pending",
      },
      customerData.company_id
    );

    // Send email notification
    await sendPaymentPendingEmail(
      user.email,
      user.name,
      user.company_name,
      amount.toString(),
      currency,
      txId,
      confirmationsRequired
    );

    // Mark notification as completed in Redis (expires in 24 hours)
    await setRedisItem(pendingKey, {
      sent: true,
      sentAt: new Date().toISOString(),
      txId,
      address,
      userId: user.user_id,
      status: 'completed',
    });

    console.log(`Pending payment notification sent for tx: ${txId}`);
    return true;

  } catch (error) {
    console.error("Error sending pending payment notification:", error);
    return false;
  }
};

/**
 * Send confirmation progress notification
 * Called when we receive updates about confirmation count
 */
export const sendConfirmationProgressNotification = async (
  txId: string,
  currentConfirmations: number,
  currency: string,
  customerData: { name?: string; email?: string; phone?: string; metadata?: Record<string, unknown> }
): Promise<boolean> => {
  try {
    const requiredConfirmations = CONFIRMATION_REQUIREMENTS[currency] || 1;
    
    // Only send progress updates at certain milestones (25%, 50%, 75%, 100%)
    const progressPercent = (currentConfirmations / requiredConfirmations) * 100;
    const milestones = [25, 50, 75, 100];
    const nearestMilestone = milestones.find(m => progressPercent >= m && progressPercent < m + 25);
    
    if (!nearestMilestone) return false;

    // Check if we already sent this milestone notification
    const milestoneKey = `confirm-milestone-${txId}-${nearestMilestone}`;
    const existingMilestone = await getRedisItem(milestoneKey);
    
    if (existingMilestone && existingMilestone.sent) {
      return false;
    }

    // Get user details
    const userResult = await sequelize.query(
      `SELECT u.user_id, u.name, u.email, c.company_name
       FROM tbl_user u
       JOIN tbl_company c ON c.user_id = u.user_id
       WHERE u.user_id = :userId`,
      {
        replacements: { userId: customerData.adm_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (!userResult || userResult.length === 0) {
      return false;
    }

    const user = userResult[0];

    // Create in-app notification for progress
    await createNotification(
      user.user_id,
      NOTIFICATION_TYPES.PAYMENT_CONFIRMING,
      `Payment Confirming (${currentConfirmations}/${requiredConfirmations})`,
      `Your payment is being confirmed on the ${currency} network. ${currentConfirmations} of ${requiredConfirmations} confirmations received.`,
      {
        tx_id: txId,
        currency: currency,
        current_confirmations: currentConfirmations,
        required_confirmations: requiredConfirmations,
        progress_percent: progressPercent,
        status: currentConfirmations >= requiredConfirmations ? "confirmed" : "confirming",
      },
      customerData.company_id
    );

    // Send email for significant milestones (50% and 100%)
    if (nearestMilestone >= 50) {
      await sendPaymentConfirmingEmail(
        user.email,
        user.name,
        user.company_name,
        customerData.amount?.toString() || "0",
        currency,
        txId,
        currentConfirmations,
        requiredConfirmations
      );
    }

    // Mark milestone as sent
    await setRedisItem(milestoneKey, {
      sent: true,
      sentAt: new Date().toISOString(),
      milestone: nearestMilestone,
    });

    return true;

  } catch (error) {
    console.error("Error sending confirmation progress notification:", error);
    return false;
  }
};

/**
 * Get confirmation count for a transaction
 * Uses Tatum API to check current confirmations
 */
export const getTransactionConfirmations = async (
  txId: string,
  currency: string
): Promise<number> => {
  try {
    // This would typically call Tatum API to get confirmation count
    // For now, we'll implement a placeholder that can be enhanced
    const tatumKey = process.env.TATUM_KEY;
    
    if (!tatumKey) {
      console.log("Tatum key not configured");
      return 0;
    }

    // Map currency to Tatum chain
    const chainMap: Record<string, string> = {
      BTC: "bitcoin",
      ETH: "ethereum",
      LTC: "litecoin",
      DOGE: "dogecoin",
      BCH: "bitcoin-cash",
      TRX: "tron",
      "USDT-TRC20": "tron",
      "USDT-ERC20": "ethereum",
    };

    const chain = chainMap[currency];
    if (!chain) {
      console.log(`Unknown chain for currency: ${currency}`);
      return 0;
    }

    // Placeholder - in production, call Tatum API:
    // const response = await axios.get(
    //   `https://api.tatum.io/v3/${chain}/transaction/${txId}`,
    //   { headers: { "x-api-key": tatumKey } }
    // );
    // return response.data.confirmations || 0;

    return 0;

  } catch (error) {
    console.error("Error getting transaction confirmations:", error);
    return 0;
  }
};

/**
 * Send partial payment notification
 * Called when a payment is detected but amount is less than expected
 */
export const sendPartialPaymentNotification = async (
  address: string,
  txId: string,
  receivedAmount: number,
  expectedAmount: number,
  currency: string,
  customerData: { name?: string; email?: string; phone?: string; metadata?: Record<string, unknown> },
  gracePeriodMinutes: number = 30
): Promise<boolean> => {
  try {
    // Check if we already sent a partial notification for this address
    const partialKey = `partial-notif-${address}`;
    const existingNotification = await getRedisItem(partialKey);
    
    if (existingNotification && existingNotification.sent) {
      console.log(`Partial notification already sent for address: ${address}`);
      return false;
    }

    // Get user and company details
    const userResult = await sequelize.query(
      `SELECT u.user_id, u.name, u.email, c.company_name, c.company_id
       FROM tbl_user u
       JOIN tbl_company c ON c.user_id = u.user_id
       WHERE u.user_id = :userId`,
      {
        replacements: { userId: customerData.adm_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (!userResult || userResult.length === 0) {
      console.log("User not found for partial payment notification");
      return false;
    }

    const user = userResult[0];
    const remainingAmount = (expectedAmount - receivedAmount).toFixed(8);

    // Create in-app notification
    await createNotification(
      user.user_id,
      NOTIFICATION_TYPES.PAYMENT_PARTIAL,
      "Partial Payment Received",
      `A partial payment of ${receivedAmount} ${currency} has been received. Expected: ${expectedAmount} ${currency}. Please send the remaining ${remainingAmount} ${currency} within ${gracePeriodMinutes} minutes to complete this payment.`,
      {
        tx_id: txId,
        received_amount: receivedAmount,
        expected_amount: expectedAmount,
        remaining_amount: remainingAmount,
        currency: currency,
        address: address,
        grace_period_minutes: gracePeriodMinutes,
        expires_at: new Date(Date.now() + gracePeriodMinutes * 60 * 1000).toISOString(),
        status: "partial",
      },
      customerData.company_id
    );

    // Send email notification
    await sendPaymentPartialEmail(
      user.email,
      user.name,
      user.company_name,
      receivedAmount.toString(),
      expectedAmount.toString(),
      remainingAmount,
      currency,
      txId,
      address,
      gracePeriodMinutes
    );

    // Mark notification as sent in Redis (expires in 2 hours)
    await setRedisItem(partialKey, {
      sent: true,
      sentAt: new Date().toISOString(),
      txId,
      address,
      userId: user.user_id,
      receivedAmount,
      expectedAmount,
    });

    console.log(`Partial payment notification sent for address: ${address}`);
    return true;

  } catch (error) {
    console.error("Error sending partial payment notification:", error);
    return false;
  }
};

/**
 * Send partial payment expired notification
 * Called when the grace period expires for a partial payment
 */
export const sendPartialPaymentExpiredNotification = async (
  address: string,
  txId: string,
  receivedAmount: number,
  expectedAmount: number,
  currency: string,
  userId: number,
  companyId: number,
  status: "completed_partial" | "incomplete_expired"
): Promise<boolean> => {
  try {
    // Get user and company details
    const userResult = await sequelize.query(
      `SELECT u.user_id, u.name, u.email, c.company_name
       FROM tbl_user u
       JOIN tbl_company c ON c.user_id = u.user_id
       WHERE u.user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (!userResult || userResult.length === 0) {
      console.log("User not found for partial expired notification");
      return false;
    }

    const user = userResult[0];
    const isCompleted = status === "completed_partial";

    // Create in-app notification
    await createNotification(
      user.user_id,
      NOTIFICATION_TYPES.PAYMENT_PARTIAL_EXPIRED,
      isCompleted ? "Partial Payment Processed" : "Partial Payment Expired",
      isCompleted
        ? `Your partial payment of ${receivedAmount} ${currency} has been processed. The funds have been forwarded with adjusted fees.`
        : `The grace period for your partial payment has expired. Received ${receivedAmount} of ${expectedAmount} ${currency}. The partial amount has been processed.`,
      {
        tx_id: txId,
        received_amount: receivedAmount,
        expected_amount: expectedAmount,
        currency: currency,
        address: address,
        status: status,
        processed_at: new Date().toISOString(),
      },
      companyId
    );

    // Send email notification
    await sendPaymentPartialExpiredEmail(
      user.email,
      user.name,
      user.company_name,
      receivedAmount.toString(),
      expectedAmount.toString(),
      currency,
      txId,
      status
    );

    console.log(`Partial payment expired notification sent for address: ${address}, status: ${status}`);
    return true;

  } catch (error) {
    console.error("Error sending partial payment expired notification:", error);
    return false;
  }
};

export default {
  sendPendingPaymentNotification,
  sendConfirmationProgressNotification,
  sendPartialPaymentNotification,
  sendPartialPaymentExpiredNotification,
  getTransactionConfirmations,
  CONFIRMATION_REQUIREMENTS,
  ESTIMATED_CONFIRMATION_TIMES,
};
