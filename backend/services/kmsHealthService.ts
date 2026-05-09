/**
 * KMS Health Probe
 *
 * Verifies that GCP KMS is reachable AND that billing is enabled by performing
 * a tiny encrypt+decrypt round-trip against the configured cryptoKey.
 *
 * Why this exists: on 2026-05-09 a $150 BTC merchant payout was stuck because
 * GCP billing on the `newdyno` project was disabled. KMS calls returned
 * `9 FAILED_PRECONDITION: Billing is disabled for project 163670787265.`
 * The system kept silently failing settlement and emitting `payment.settlement_failed`
 * webhooks, with no operator alert. This probe fails loudly at startup AND
 * runs on a schedule so the next outage is caught within minutes.
 *
 * Run on:
 *   - Server startup (logs error + emails admin if KMS is broken; does NOT crash
 *     the process so other endpoints stay reachable)
 *   - Every 15 minutes via cron
 */
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { apiLogger, cronLogger } from "../utils/loggers";

let lastResult: { ok: boolean; checkedAt: number; error?: string } = {
  ok: false,
  checkedAt: 0,
};

export function getKmsHealthStatus() {
  return { ...lastResult };
}

function buildClient(): KeyManagementServiceClient {
  const projectId = process.env.PROJECT_ID;
  const privateKey = (process.env.GOOGLE_CLIENT_KEY || "").replace(/\\n/g, "\n");
  return new KeyManagementServiceClient({
    credentials: {
      type: "service_account",
      project_id: projectId,
      private_key_id: process.env.PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
    } as Record<string, unknown>,
  });
}

/**
 * Run a real encrypt + decrypt round-trip against the wallet-keys KMS key.
 * Cheap (a few ms, fractions of a cent) and proves billing + IAM both work.
 */
export async function probeKms(): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
  const t0 = Date.now();
  try {
    const projectId = process.env.PROJECT_ID;
    const locationId = process.env.LOCATION_ID;
    const keyRingId = process.env.KEY_RING_ID;
    const keyId = process.env.PRIVATE_KEY_ID;
    if (!projectId || !locationId || !keyRingId || !keyId) {
      const err = `KMS env missing (PROJECT_ID/LOCATION_ID/KEY_RING_ID/PRIVATE_KEY_ID)`;
      lastResult = { ok: false, checkedAt: Date.now(), error: err };
      return { ok: false, error: err };
    }

    const client = buildClient();
    const keyName = client.cryptoKeyPath(projectId, locationId, keyRingId, keyId);
    const plaintext = Buffer.from(`kms-probe-${Date.now()}`);

    const [enc] = await client.encrypt({ name: keyName, plaintext });
    const [dec] = await client.decrypt({ name: keyName, ciphertext: enc.ciphertext as Uint8Array });

    const matched = Buffer.from(dec.plaintext as Uint8Array).toString() === plaintext.toString();
    if (!matched) {
      const err = "KMS round-trip plaintext mismatch";
      lastResult = { ok: false, checkedAt: Date.now(), error: err };
      return { ok: false, error: err };
    }

    const latencyMs = Date.now() - t0;
    lastResult = { ok: true, checkedAt: Date.now() };
    return { ok: true, latencyMs };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    const code = (e as { code?: number }).code;
    const err = `KMS probe failed (code=${code ?? "?"}): ${msg}`;
    lastResult = { ok: false, checkedAt: Date.now(), error: err };
    return { ok: false, error: err };
  }
}

/**
 * Startup probe — log + email admin on failure, but never crash the process.
 * Settlement payouts are unaffected; this is a fail-fast SIGNAL, not a hard stop.
 */
export async function runKmsStartupProbe(): Promise<void> {
  const result = await probeKms();
  if (result.ok) {
    apiLogger.info(`[KMSHealth] ✅ KMS encrypt/decrypt round-trip OK (${result.latencyMs}ms)`);
    return;
  }

  apiLogger.error(`[KMSHealth] ❌ KMS UNHEALTHY at startup: ${result.error}`);

  // Best-effort admin email (don't block startup if email infra is down too).
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    const { sendEmail } = require("./emailService");
    await sendEmail(
      adminEmail,
      "DynoPay Admin",
      "🔴 CRITICAL: GCP KMS unreachable — merchant payouts will fail",
      `<p><strong>The DynoPay backend started but cannot reach Google Cloud KMS.</strong></p>
       <p>Until KMS works again, every merchant payout that needs key decryption will fail and emit <code>payment.settlement_failed</code>. Most likely causes:</p>
       <ul>
         <li>GCP project billing has been suspended (check <a href="https://console.cloud.google.com/billing/projects">billing console</a>).</li>
         <li>The service account <code>${process.env.GOOGLE_CLIENT_EMAIL || "(unset)"}</code> lost <code>cloudkms.cryptoKeyEncrypterDecrypter</code> on <code>${process.env.PROJECT_ID}/${process.env.LOCATION_ID}/${process.env.KEY_RING_ID}/${process.env.PRIVATE_KEY_ID}</code>.</li>
         <li>Network egress is blocked (firewall / proxy).</li>
       </ul>
       <p><strong>Probe error:</strong></p>
       <pre style="background:#f4f4f4;padding:8px;border-radius:4px;font-size:12px;">${escapeHtml(result.error || "unknown")}</pre>
       <p>This alert will repeat every 15 minutes until the probe succeeds.</p>`
    );
  } catch (e) {
    apiLogger.warn(`[KMSHealth] Could not send admin email: ${(e as Error).message}`);
  }
}

/**
 * Periodic probe — fires every 15 min. Only emails admin on the FIRST failure
 * (and on recovery), to avoid spamming.
 */
let lastSentState: "ok" | "fail" | "unknown" = "unknown";
export async function runKmsScheduledProbe(): Promise<void> {
  const result = await probeKms();
  if (result.ok) {
    cronLogger.info(`[KMSHealth] periodic probe OK (${result.latencyMs}ms)`);
    if (lastSentState === "fail") {
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          const { sendEmail } = require("./emailService");
          await sendEmail(
            adminEmail,
            "DynoPay Admin",
            "✅ GCP KMS recovered — payouts unblocked",
            `<p>KMS is healthy again at ${new Date().toISOString()} (${result.latencyMs}ms round-trip). Merchant payouts can resume.</p>`
          );
        }
      } catch { /* best-effort */ }
    }
    lastSentState = "ok";
    return;
  }

  cronLogger.error(`[KMSHealth] ❌ periodic probe FAIL: ${result.error}`);
  if (lastSentState !== "fail") {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const { sendEmail } = require("./emailService");
        await sendEmail(
          adminEmail,
          "DynoPay Admin",
          "🔴 CRITICAL: GCP KMS unhealthy — merchant payouts blocked",
          `<p>KMS round-trip is failing. Until KMS recovers, every merchant payout requiring key decryption will fail.</p>
           <p><strong>Error:</strong></p>
           <pre style="background:#f4f4f4;padding:8px;border-radius:4px;font-size:12px;">${escapeHtml(result.error || "unknown")}</pre>
           <p>You will receive one more email when KMS recovers.</p>`
        );
      }
    } catch { /* best-effort */ }
    lastSentState = "fail";
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
