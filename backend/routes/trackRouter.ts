/**
 * Visitor Tracking Router
 *
 * Lightweight endpoint for tracking new website visitors.
 * Uses IP-based deduplication (24h Redis TTL) to avoid spam.
 * Rate-limited to prevent abuse.
 */

import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { apiLogger } from "../utils/loggers";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { sendNewVisitorAdminEmail } from "../services/emailService";
import { authMiddleware } from "../middleware";

const trackRouter = express.Router();

const ONBOARDING_EVENT_TYPES = [
  "checklist_shown",
  "step_clicked",
  "step_completed",
  "dismissed",
  "collapsed",
  "expanded",
];

/**
 * POST /api/track/onboarding
 * Auth required. Body: { event_type, step_key?, completed_count?, metadata? }
 *
 * Records onboarding-checklist engagement so admins can see where new
 * merchants drop off. High-frequency events (checklist_shown, step_completed)
 * are de-duplicated via Redis so a row is written at most once per window.
 */
trackRouter.post("/onboarding", authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const decoded = jwt.decode(res.locals.token) as { user_id?: number } | null;
    const user_id = decoded?.user_id;
    const { event_type, step_key, completed_count, metadata } = req.body || {};

    if (!user_id || !ONBOARDING_EVENT_TYPES.includes(event_type)) {
      return res.status(200).json({ ok: false });
    }

    // De-duplicate noisy events so the table stays meaningful
    if (event_type === "checklist_shown" || event_type === "step_completed") {
      const dedupKey = `onb:${event_type}:${user_id}:${step_key || "_"}`;
      const seen = await getRedisItem(dedupKey);
      if (seen && Object.keys(seen).length > 0) {
        return res.status(200).json({ ok: true, deduped: true });
      }
      // checklist_shown: 6h window; step_completed: 30d (effectively once)
      const ttl = event_type === "checklist_shown" ? 21600 : 2592000;
      await setRedisItemWithTTL(dedupKey, { t: Date.now() }, ttl);
    }

    const { onboardingEventModel } = await import("../models");
    await onboardingEventModel.create({
      user_id,
      event_type,
      step_key: typeof step_key === "string" ? step_key : null,
      completed_count: typeof completed_count === "number" ? completed_count : null,
      metadata: metadata && typeof metadata === "object" ? metadata : null,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    apiLogger.error("[Track] Onboarding event error:", err);
    // Tracking must never surface an error to the client
    return res.status(200).json({ ok: false });
  }
});

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
