/**
 * Fee Wallet Monitor Service
 * 
 * Monitors TRX fee wallet balance and alerts when low
 * Prevents SmartGas failures due to insufficient fee wallet balance
 */

import tatumApi from "../apis/tatumApi";
import { cronLogger } from "../utils/loggers";
import { dynoPayGreetingTemplate } from "./emailService";
import mailTransporter from "../utils/mailTransporter";

const FEE_WALLET_ADDRESS = process.env.TRX_FEE_WALLET || "";
const ALERT_EMAIL = process.env.ADMIN_EMAIL || process.env.BREVO_SENDER_EMAIL || "admin@dynopay.com";

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
    if (!FEE_WALLET_ADDRESS) {
      cronLogger.warn('[FeeWalletMonitor] TRX_FEE_WALLET not configured - skipping check');
      return {
        balance: 0,
        status: 'empty',
        lastChecked: new Date(),
      };
    }

    // Get current balance
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
