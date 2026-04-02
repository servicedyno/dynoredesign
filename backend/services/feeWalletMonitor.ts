/**
 * Fee Wallet Monitor Service
 * 
 * Monitors TRX fee wallet balance and alerts when low
 * Prevents SmartGas failures due to insufficient fee wallet balance
 * 
 * FIX (2026-04-02): Now reads the TRX fee wallet address from the DATABASE
 * (tbl_admin_fee_wallet where wallet_type='TRX') — the same source SmartGas uses.
 * Previously checked process.env.TRX_FEE_WALLET which was a DIFFERENT wallet,
 * causing the monitor to report "HEALTHY" while the actual gas wallet was nearly empty.
 */

import tatumApi from "../apis/tatumApi";
import { cronLogger } from "../utils/loggers";
import { dynoPayGreetingTemplate } from "./emailService";
import mailTransporter from "../utils/mailTransporter";

// Fallback only — DB address takes priority (see getActualFeeWalletAddress below)
const ENV_FEE_WALLET_ADDRESS = process.env.TRX_FEE_WALLET || "";
const ALERT_EMAIL = process.env.ADMIN_EMAIL || process.env.BREVO_SENDER_EMAIL || "admin@dynopay.com";

/**
 * Get the ACTUAL TRX fee wallet address from the database (same as SmartGas uses).
 * Falls back to process.env.TRX_FEE_WALLET if DB lookup fails.
 */
async function getActualFeeWalletAddress(): Promise<string> {
  try {
    const { adminFeeModel } = await import("../models");
    const feeWallet = await adminFeeModel.findOne({
      where: { wallet_type: "TRX" },
      attributes: ["wallet_address"],
    });
    if (feeWallet?.dataValues?.wallet_address) {
      const dbAddress = feeWallet.dataValues.wallet_address;
      // Log if DB address differs from env var — this was the root cause of the monitoring gap
      if (ENV_FEE_WALLET_ADDRESS && dbAddress !== ENV_FEE_WALLET_ADDRESS) {
        cronLogger.warn(`[FeeWalletMonitor] ⚠️ DB fee wallet (${dbAddress.substring(0, 10)}...) differs from env TRX_FEE_WALLET (${ENV_FEE_WALLET_ADDRESS.substring(0, 10)}...). Using DB address (same as SmartGas).`);
      }
      return dbAddress;
    }
  } catch (err: any) {
    cronLogger.warn(`[FeeWalletMonitor] DB lookup failed, falling back to env var: ${err.message}`);
  }
  return ENV_FEE_WALLET_ADDRESS;
}

// Alert thresholds
const CRITICAL_THRESHOLD = 50; // TRX
const WARNING_THRESHOLD = 100; // TRX
const HEALTHY_THRESHOLD = 200; // TRX

interface WalletStatus {
  balance: number;
  status: 'healthy' | 'warning' | 'critical' | 'empty';
  lastChecked: Date;
  lastAlertSent?: Date;
}

let lastStatus: WalletStatus | null = null;
const ALERT_COOLDOWN_MS = 3600000; // 1 hour - don't spam alerts

/**
 * Check fee wallet balance and send alerts if needed
 */
export async function checkFeeWalletBalance(): Promise<WalletStatus> {
  try {
    // FIX: Read the fee wallet address from the DATABASE (same source as SmartGas)
    const FEE_WALLET_ADDRESS = await getActualFeeWalletAddress();
    
    if (!FEE_WALLET_ADDRESS) {
      cronLogger.warn('[FeeWalletMonitor] No TRX fee wallet found in DB or env — skipping check');
      return {
        balance: 0,
        status: 'empty',
        lastChecked: new Date(),
      };
    }

    // Get current balance from the SAME wallet SmartGas actually funds from
    const balanceResult = await tatumApi.getAddressBalance(FEE_WALLET_ADDRESS, 'TRX').catch(() => null);
    const balance = Number(balanceResult?.balance || 0);

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' | 'empty';
    if (balance === 0) {
      status = 'empty';
    } else if (balance < CRITICAL_THRESHOLD) {
      status = 'critical';
    } else if (balance < WARNING_THRESHOLD) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    const currentStatus: WalletStatus = {
      balance,
      status,
      lastChecked: new Date(),
    };

    // Log status
    const emoji = {
      healthy: '✅',
      warning: '⚠️',
      critical: '🚨',
      empty: '❌',
    }[status];

    cronLogger.info(`[FeeWalletMonitor] ${emoji} TRX Fee Wallet: ${balance.toFixed(2)} TRX (${status.toUpperCase()})`);

    // Send alert if needed
    const shouldAlert = shouldSendAlert(currentStatus);
    if (shouldAlert) {
      await sendAlert(currentStatus);
      currentStatus.lastAlertSent = new Date();
    }

    lastStatus = currentStatus;
    return currentStatus;

  } catch (error) {
    cronLogger.error(`[FeeWalletMonitor] Error checking fee wallet: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Determine if we should send an alert
 */
function shouldSendAlert(currentStatus: WalletStatus): boolean {
  // Don't alert if healthy
  if (currentStatus.status === 'healthy') {
    return false;
  }

  // Always alert if empty
  if (currentStatus.status === 'empty') {
    return true;
  }

  // Check cooldown
  if (lastStatus?.lastAlertSent) {
    const timeSinceLastAlert = Date.now() - lastStatus.lastAlertSent.getTime();
    if (timeSinceLastAlert < ALERT_COOLDOWN_MS) {
      cronLogger.info(`[FeeWalletMonitor] Alert cooldown active (${Math.round(timeSinceLastAlert / 60000)}min since last alert)`);
      return false;
    }
  }

  // Alert if status worsened
  if (lastStatus) {
    const statusPriority = { empty: 4, critical: 3, warning: 2, healthy: 1 };
    if (statusPriority[currentStatus.status] > statusPriority[lastStatus.status]) {
      return true; // Status worsened
    }
  }

  // First time seeing this status
  if (!lastStatus) {
    return true;
  }

  return false;
}

/**
 * Send alert email to admin
 */
async function sendAlert(status: WalletStatus): Promise<void> {
  const { balance, status: statusLevel } = status;
  
  // FIX: Get the actual fee wallet address from DB for the alert email
  const FEE_WALLET_ADDRESS = await getActualFeeWalletAddress();

  const subject = {
    empty: '🚨 URGENT: TRX Fee Wallet Empty!',
    critical: '🚨 CRITICAL: TRX Fee Wallet Very Low',
    warning: '⚠️ WARNING: TRX Fee Wallet Low',
    healthy: '✅ TRX Fee Wallet Healthy',
  }[statusLevel];

  const message = {
    empty: `
      <h2 style="color: #dc2626;">🚨 TRX Fee Wallet is EMPTY!</h2>
      <p><strong>Current Balance:</strong> ${balance.toFixed(2)} TRX</p>
      <p><strong>Impact:</strong> ALL USDT-TRC20 payments will FAIL until topped up!</p>
      <p><strong>Action Required:</strong> Send at least ${HEALTHY_THRESHOLD} TRX to:<br/>
      <code>${FEE_WALLET_ADDRESS}</code></p>
    `,
    critical: `
      <h2 style="color: #ea580c;">🚨 TRX Fee Wallet Critically Low</h2>
      <p><strong>Current Balance:</strong> ${balance.toFixed(2)} TRX</p>
      <p><strong>Threshold:</strong> < ${CRITICAL_THRESHOLD} TRX</p>
      <p><strong>Impact:</strong> SmartGas may fail, causing payment delays.</p>
      <p><strong>Action Required:</strong> Top up soon to at least ${HEALTHY_THRESHOLD} TRX:<br/>
      <code>${FEE_WALLET_ADDRESS}</code></p>
    `,
    warning: `
      <h2 style="color: #f59e0b;">⚠️ TRX Fee Wallet Low</h2>
      <p><strong>Current Balance:</strong> ${balance.toFixed(2)} TRX</p>
      <p><strong>Threshold:</strong> < ${WARNING_THRESHOLD} TRX</p>
      <p><strong>Recommendation:</strong> Top up to ${HEALTHY_THRESHOLD}+ TRX soon:<br/>
      <code>${FEE_WALLET_ADDRESS}</code></p>
      <p>System is still operational but running low on gas funds.</p>
    `,
    healthy: '',
  }[statusLevel];

  try {
    await mailTransporter({
      to: ALERT_EMAIL,
      subject,
      body: dynoPayGreetingTemplate('Admin', message, subject),
      name: 'Admin',
    });

    cronLogger.info(`[FeeWalletMonitor] ${statusLevel.toUpperCase()} alert sent to ${ALERT_EMAIL}`);
  } catch (emailError) {
    cronLogger.error(`[FeeWalletMonitor] Failed to send alert email: ${(emailError as Error).message}`);
  }
}

/**
 * Start monitoring (call this from cron or startup)
 */
export async function startFeeWalletMonitoring(intervalMinutes: number = 30): Promise<void> {
  cronLogger.info(`[FeeWalletMonitor] Starting fee wallet monitoring (every ${intervalMinutes} min)`);
  
  // Initial check
  await checkFeeWalletBalance();

  // Schedule periodic checks
  setInterval(async () => {
    await checkFeeWalletBalance();
  }, intervalMinutes * 60 * 1000);
}

export default {
  checkFeeWalletBalance,
  startFeeWalletMonitoring,
  CRITICAL_THRESHOLD,
  WARNING_THRESHOLD,
  HEALTHY_THRESHOLD,
};
