/**
 * Visitor Tracking Router
 *
 * Lightweight endpoint for tracking new website visitors.
 * Uses IP-based deduplication (24h Redis TTL) to avoid spam.
 * Rate-limited to prevent abuse.
 */

import express from "express";
import axios from "axios";
import { apiLogger } from "../utils/loggers";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { sendNewVisitorAdminEmail } from "../services/emailService";

const trackRouter = express.Router();

// In-memory rate limiter: max 30 unique visitor emails per hour
let emailsSentThisHour = 0;
let lastHourReset = Date.now();
const MAX_EMAILS_PER_HOUR = 30;

const checkHourlyLimit = (): boolean => {
  const now = Date.now();
  if (now - lastHourReset > 3600000) {
    emailsSentThisHour = 0;
    lastHourReset = now;
  }
  return emailsSentThisHour < MAX_EMAILS_PER_HOUR;
};

/**
 * POST /api/track/visitor
 * Body: { page, referrer }
 *
 * Tracks a new unique visitor (IP-deduplicated for 24h).
 * Sends admin email notification for genuinely new visitors.
 */
trackRouter.post("/visitor", async (req: express.Request, res: express.Response) => {
  try {
    // Always return 200 quickly — tracking should never block the user
    res.status(200).json({ ok: true });

    // Extract visitor info
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "";
    const page = req.body?.page || "/";
    const referrer = req.body?.referrer || null;

    // Skip bots/crawlers
    const botPatterns = /bot|crawl|spider|slurp|feed|fetch|monitor|check|ping|curl|wget|python|go-http|java|ruby|perl/i;
    if (botPatterns.test(userAgent)) {
      apiLogger.info(`[Track] Skipping bot/crawler: ${userAgent.substring(0, 60)}`);
      return;
    }

    // Redis dedup: 1 notification per IP per 24 hours
    const dedupKey = `visitor:seen:${ip}`;
    const alreadySeen = await getRedisItem(dedupKey);
    if (alreadySeen && Object.keys(alreadySeen).length > 0) {
      apiLogger.info(`[Track] Visitor ${ip} already seen in last 24h — skipping email`);
      return;
    }

    // Mark as seen for 24 hours
    await setRedisItemWithTTL(dedupKey, { first_seen: new Date().toISOString(), page }, 86400);

    // Check hourly email rate limit
    if (!checkHourlyLimit()) {
      apiLogger.warn(`[Track] Visitor email rate limit reached (${MAX_EMAILS_PER_HOUR}/hr) — skipping email for ${ip}`);
      return;
    }

    // Geo-locate the visitor (best-effort, non-blocking)
    let country: string | null = null;
    let city: string | null = null;
    try {
      const cleanIp = ip === "::1" || ip === "127.0.0.1" ? "" : ip;
      const geoUrl = !cleanIp
        ? "http://ip-api.com/json/?fields=status,country,countryCode,city"
        : `http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,city`;
      const geoRes = await axios.get(geoUrl, { timeout: 3000 });
      if (geoRes.data?.status === "success") {
        country = geoRes.data.country;
        city = geoRes.data.city;
      }
    } catch (_geoErr) {
      // Non-critical — continue without geo data
    }

    // Send admin notification
    emailsSentThisHour++;
    await sendNewVisitorAdminEmail({
      ip,
      country,
      city,
      referrer,
      page,
      user_agent: userAgent,
      timestamp: new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }) + " UTC",
    });

  } catch (err) {
    apiLogger.error("[Track] Visitor tracking error:", err);
    // Don't return error — endpoint already responded 200
  }
});

export default trackRouter;
