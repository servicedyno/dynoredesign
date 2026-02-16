/**
 * Slack/Discord Alert Service
 * 
 * Sends instant alerts to Slack or Discord webhooks for critical events.
 * Falls back gracefully if webhook URL not configured.
 */
import axios from "axios";
import { apiLogger } from "../utils/loggers";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const ALERT_CHANNEL = process.env.ALERT_CHANNEL || "#dynopay-alerts";
const APP_ENV = process.env.NODE_ENV || "development";

interface AlertPayload {
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  fields?: Record<string, string>;
  error?: Error;
}

const SEVERITY_EMOJI: Record<string, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "#2196F3",
  warning: "#FF9800",
  critical: "#F44336",
};

/**
 * Send alert to Slack
 */
const sendSlackAlert = async (payload: AlertPayload): Promise<boolean> => {
  if (!SLACK_WEBHOOK_URL) return false;

  try {
    const fields = payload.fields
      ? Object.entries(payload.fields).map(([k, v]) => ({ title: k, value: v, short: true }))
      : [];

    if (payload.error) {
      fields.push({ title: "Error", value: `\`${payload.error.message}\``, short: false });
    }

    await axios.post(SLACK_WEBHOOK_URL, {
      channel: ALERT_CHANNEL,
      username: "DynoPay Alert",
      icon_emoji: SEVERITY_EMOJI[payload.severity] || "ℹ️",
      attachments: [
        {
          color: SEVERITY_COLOR[payload.severity],
          title: `${SEVERITY_EMOJI[payload.severity]} ${payload.title}`,
          text: payload.message,
          fields,
          footer: `DynoPay | ${APP_ENV}`,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }, { timeout: 5000 });

    return true;
  } catch (err) {
    apiLogger.error("[SlackAlert] Failed to send:", (err as Error).message);
    return false;
  }
};

/**
 * Send alert to Discord
 */
const sendDiscordAlert = async (payload: AlertPayload): Promise<boolean> => {
  if (!DISCORD_WEBHOOK_URL) return false;

  try {
    const fields = payload.fields
      ? Object.entries(payload.fields).map(([k, v]) => ({ name: k, value: v, inline: true }))
      : [];

    if (payload.error) {
      fields.push({ name: "Error", value: `\`${payload.error.message}\``, inline: false });
    }

    await axios.post(DISCORD_WEBHOOK_URL, {
      username: "DynoPay Alert",
      embeds: [
        {
          title: `${SEVERITY_EMOJI[payload.severity]} ${payload.title}`,
          description: payload.message,
          color: parseInt(SEVERITY_COLOR[payload.severity].replace("#", ""), 16),
          fields,
          footer: { text: `DynoPay | ${APP_ENV}` },
          timestamp: new Date().toISOString(),
        },
      ],
    }, { timeout: 5000 });

    return true;
  } catch (err) {
    apiLogger.error("[DiscordAlert] Failed to send:", (err as Error).message);
    return false;
  }
};

/**
 * Send alert to all configured channels
 */
export const sendAlert = async (payload: AlertPayload): Promise<{ slack: boolean; discord: boolean }> => {
  const [slack, discord] = await Promise.all([
    sendSlackAlert(payload),
    sendDiscordAlert(payload),
  ]);
  return { slack, discord };
};

// ── Convenience Methods ──────────────────────────────────────────────────────

export const alertPaymentFailure = async (txId: string, reason: string, amount?: number): Promise<void> => {
  await sendAlert({
    title: "Payment Failure",
    message: `Payment processing failed`,
    severity: "critical",
    fields: {
      "Transaction ID": txId,
      "Reason": reason,
      ...(amount ? { "Amount": `$${amount}` } : {}),
    },
  });
};

export const alertServiceDown = async (serviceName: string, error?: Error): Promise<void> => {
  await sendAlert({
    title: `Service Down: ${serviceName}`,
    message: `${serviceName} is not responding`,
    severity: "critical",
    fields: { Service: serviceName },
    error,
  });
};

export const alertHighErrorRate = async (errorCount: number, timeWindow: string): Promise<void> => {
  await sendAlert({
    title: "High Error Rate",
    message: `${errorCount} errors detected in the last ${timeWindow}`,
    severity: "warning",
    fields: {
      "Error Count": String(errorCount),
      "Time Window": timeWindow,
    },
  });
};

export const alertSecurityEvent = async (event: string, details: Record<string, string>): Promise<void> => {
  await sendAlert({
    title: `Security: ${event}`,
    message: `Security event detected: ${event}`,
    severity: "critical",
    fields: details,
  });
};

export const isConfigured = (): { slack: boolean; discord: boolean } => ({
  slack: !!SLACK_WEBHOOK_URL,
  discord: !!DISCORD_WEBHOOK_URL,
});

export default {
  sendAlert,
  alertPaymentFailure,
  alertServiceDown,
  alertHighErrorRate,
  alertSecurityEvent,
  isConfigured,
};
