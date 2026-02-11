/**
 * Webhook URL Migration Service
 * 
 * Queries ALL Tatum subscriptions and bulk-updates any whose URL
 * does not match the current SERVER_URL from .env.
 * 
 * This fixes stale webhook URLs left over from previous deployments
 * (e.g. dynobackendconsolidated.up.railway.app → api.dynopay.com).
 * 
 * Runs once on server startup and can be triggered manually via admin endpoint.
 */

import axios from "axios";
import tatumApi from "../apis/tatumApi";

// ── helpers ────────────────────────────────────────────────────────

/** Return the canonical base URL from .env (no trailing slash). */
const getCanonicalBaseUrl = (): string => {
  const url = (process.env.SERVER_URL || "").replace(/\/+$/, "");
  if (!url) throw new Error("SERVER_URL is not set in .env");
  return url;
};

/** Extract query-string from a full URL (everything after '?', or empty). */
const extractQueryString = (url: string): string => {
  const idx = url.indexOf("?");
  return idx >= 0 ? url.substring(idx) : "";
};

/** Extract the path portion (between origin and '?'). */
const extractPath = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    // Fallback: strip scheme+host manually
    const noScheme = url.replace(/^https?:\/\//, "");
    const slashIdx = noScheme.indexOf("/");
    if (slashIdx < 0) return "/";
    const qIdx = noScheme.indexOf("?");
    return qIdx >= 0
      ? noScheme.substring(slashIdx, qIdx)
      : noScheme.substring(slashIdx);
  }
};

/** Extract the origin (scheme + host) from a URL. */
const extractOrigin = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    const match = url.match(/^(https?:\/\/[^/?#]+)/);
    return match ? match[1] : "";
  }
};

// ── types ──────────────────────────────────────────────────────────

interface MigrationStats {
  total: number;
  updated: number;
  alreadyCorrect: number;
  errors: number;
  details: Array<{
    id: string;
    address?: string;
    oldUrl: string;
    newUrl: string;
    status: "updated" | "skipped" | "error";
    error?: string;
  }>;
}

// ── Tatum header helper (re-use from tatumApi) ─────────────────────

/**
 * We cannot import getTatumHeaders directly (not exported), so we
 * call listAllSubscriptions which already handles auth, and for the
 * PUT calls we use the same key via env.
 */
const getTatumApiKey = (): string => {
  return process.env.TATUM_API_KEY || "";
};

const buildHeaders = (): Record<string, string> => {
  const key = getTatumApiKey();
  if (!key) throw new Error("TATUM_API_KEY is not set in .env");
  return { "x-api-key": key };
};

// ── core logic ─────────────────────────────────────────────────────

export const migrateWebhookUrls = async (): Promise<MigrationStats> => {
  const canonicalBase = getCanonicalBaseUrl();
  console.log(`[WebhookMigration] 🔍 Starting webhook URL migration...`);
  console.log(`[WebhookMigration]    Canonical base: ${canonicalBase}`);

  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    alreadyCorrect: 0,
    errors: 0,
    details: [],
  };

  // 1. Fetch all subscriptions via the existing helper
  let subscriptions: Array<Record<string, unknown>>;
  try {
    subscriptions = await tatumApi.listAllSubscriptions();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[WebhookMigration] ❌ Failed to list subscriptions: ${msg}`);
    throw err;
  }

  stats.total = subscriptions.length;
  console.log(`[WebhookMigration]    Found ${stats.total} subscriptions`);

  if (stats.total === 0) {
    console.log(`[WebhookMigration] ✅ No subscriptions to migrate`);
    return stats;
  }

  // 2. Build headers for PUT calls
  let headers: Record<string, string>;
  try {
    headers = buildHeaders();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[WebhookMigration] ❌ ${msg}`);
    throw err;
  }

  // 3. Check each subscription
  for (const sub of subscriptions) {
    const subId = sub.id as string;
    const attr = sub.attr as Record<string, unknown> | undefined;
    const existingUrl = (attr?.url as string) || "";
    const address = (attr?.address as string) || "unknown";

    if (!existingUrl) {
      stats.alreadyCorrect++;
      continue;
    }

    // Check if the origin already matches
    const existingOrigin = extractOrigin(existingUrl);
    if (existingOrigin === canonicalBase) {
      stats.alreadyCorrect++;
      continue;
    }

    // Build the corrected URL: canonical base + original path + original query string
    const path = extractPath(existingUrl);
    const qs = extractQueryString(existingUrl);
    const correctedUrl = `${canonicalBase}${path}${qs}`;

    // 4. Update via Tatum API
    try {
      await axios.put(
        `https://api.tatum.io/v4/subscription/${subId}`,
        { url: correctedUrl },
        { headers }
      );

      stats.updated++;
      stats.details.push({
        id: subId,
        address,
        oldUrl: existingUrl,
        newUrl: correctedUrl,
        status: "updated",
      });

      console.log(
        `[WebhookMigration] ✅ Updated ${subId} (${address}): ${existingOrigin} → ${canonicalBase}`
      );

      // Rate-limit: small delay to avoid Tatum API throttling
      await new Promise((r) => setTimeout(r, 100));
    } catch (err: unknown) {
      const error = err as { response?: { data?: unknown }; message?: string };
      const errMsg = JSON.stringify(error.response?.data || error.message);

      stats.errors++;
      stats.details.push({
        id: subId,
        address,
        oldUrl: existingUrl,
        newUrl: correctedUrl,
        status: "error",
        error: errMsg,
      });

      console.error(
        `[WebhookMigration] ❌ Failed to update ${subId}: ${errMsg}`
      );
    }
  }

  // 5. Summary
  console.log(`[WebhookMigration] ════════════════════════════════════`);
  console.log(`[WebhookMigration] Migration complete:`);
  console.log(`[WebhookMigration]    Total subscriptions: ${stats.total}`);
  console.log(`[WebhookMigration]    Already correct:     ${stats.alreadyCorrect}`);
  console.log(`[WebhookMigration]    Updated:             ${stats.updated}`);
  console.log(`[WebhookMigration]    Errors:              ${stats.errors}`);
  console.log(`[WebhookMigration] ════════════════════════════════════`);

  return stats;
};
