import express from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import { apiLogger } from "../utils/loggers";
import successResponseHelper from "../helper/successResponseHelper";
import errorResponseHelper from "../helper/errorResponseHelper";
import trialPaymentLinkModel from "../models/trialPaymentLinkModel";
import { hashPassword } from "../helper/passwordHelper";
import { verifyPassword } from "../helper/passwordHelper";

// Redis: use the low-level client for simple key-value rate limiting
let redisRateClient: any = null;
async function getRedisRateClient() {
  if (!redisRateClient) {
    const { createClient } = require("redis");
    const redisUrl = process.env.REDIS_PUBLIC_URL || "redis://localhost:6379";
    redisRateClient = createClient({ url: redisUrl });
    redisRateClient.on("error", () => {});
    try { await redisRateClient.connect(); } catch {}
  }
  return redisRateClient;
}

// Config from env
const TRIAL_LINK_EXPIRY_HOURS = parseInt(process.env.TRIAL_LINK_EXPIRY_HOURS || "24");
const TRIAL_CLAIM_EXPIRY_HOURS = parseInt(process.env.TRIAL_CLAIM_EXPIRY_HOURS || "72");
const TRIAL_LINK_RATE_LIMIT = parseInt(process.env.TRIAL_LINK_RATE_LIMIT || "5");
const TRIAL_MIN_AMOUNT = parseFloat(process.env.TRIAL_MIN_AMOUNT_USD || "5");
const TRIAL_MAX_AMOUNT = parseFloat(process.env.TRIAL_MAX_AMOUNT_USD || "500");

/**
 * Generate a short, URL-safe slug
 */
function generateSlug(): string {
  return crypto.randomBytes(8).toString("base64url").slice(0, 12);
}

/**
 * Get client IP from request (handles proxies)
 */
function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || "unknown";
}

/**
 * POST /api/public/create-trial-link
 * 
 * Creates a trial payment link without authentication.
 * Rate-limited to TRIAL_LINK_RATE_LIMIT per IP per 24h.
 */
export const createTrialLink = async (req: express.Request, res: express.Response) => {
  try {
    const { amount, currency, description } = req.body;

    // Validate required fields
    if (!amount || isNaN(parseFloat(amount))) {
      return errorResponseHelper(res, 400, "Amount is required and must be a number");
    }

    const parsedAmount = parseFloat(amount);
    const fiatCurrency = (currency || "USD").toUpperCase();

    // Validate amount range
    if (parsedAmount < TRIAL_MIN_AMOUNT) {
      return errorResponseHelper(res, 400, `Minimum amount is $${TRIAL_MIN_AMOUNT}`);
    }
    if (parsedAmount > TRIAL_MAX_AMOUNT) {
      return errorResponseHelper(res, 400, `Maximum amount is $${TRIAL_MAX_AMOUNT} (KYC required for higher amounts)`);
    }

    // Rate limiting by IP
    const clientIp = getClientIp(req);
    apiLogger.info(`[TrialLink] Step 1: validated input for IP ${clientIp}`);

    const rateLimitKey = `trial-ratelimit:${clientIp}`;
    
    let count = 0;
    try {
      const redis = await getRedisRateClient();
      const val = await redis.get(rateLimitKey);
      count = val ? parseInt(val) : 0;
    } catch (e) {
      apiLogger.warn("[TrialLink] Redis unavailable for rate limiting");
    }

    if (count >= TRIAL_LINK_RATE_LIMIT) {
      return errorResponseHelper(res, 429, `Rate limit exceeded. Maximum ${TRIAL_LINK_RATE_LIMIT} trial links per 24 hours.`);
    }

    apiLogger.info(`[TrialLink] Step 2: rate limit OK (${count}/${TRIAL_LINK_RATE_LIMIT})`);

    // Generate unique slug and claim token
    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await trialPaymentLinkModel.findOne({ where: { slug } });
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    apiLogger.info(`[TrialLink] Step 3: generated slug ${slug}`);

    // Generate claim token (merchant will need this to claim funds)
    const rawClaimToken = crypto.randomBytes(32).toString("hex");
    const hashedClaimToken = hashPassword(rawClaimToken);

    apiLogger.info(`[TrialLink] Step 4: generated claim token, hash length: ${hashedClaimToken.length}`);

    // Calculate expiry
    const expiresAt = new Date(Date.now() + TRIAL_LINK_EXPIRY_HOURS * 60 * 60 * 1000);

    apiLogger.info(`[TrialLink] Step 5: creating DB record...`);

    // Create trial link
    const trialLink = await trialPaymentLinkModel.create({
      slug,
      amount: parsedAmount,
      fiat_currency: fiatCurrency,
      description: description || null,
      claim_token: hashedClaimToken,
      status: "active",
      ip_address: clientIp,
      expires_at: expiresAt,
      accepted_currencies: "BTC,ETH,USDT-TRC20,USDT-ERC20",
    });

    apiLogger.info(`[TrialLink] Step 6: DB record created`);

    // Increment rate limit counter
    try {
      const redis = await getRedisRateClient();
      await redis.set(rateLimitKey, String(count + 1), { EX: 86400 });
    } catch (e) {
      apiLogger.warn("[TrialLink] Redis unavailable for rate limit increment");
    }

    // Build response
    const frontendUrl = process.env.FRONTEND_URL || process.env.SERVER_URL || "";
    const linkUrl = `${frontendUrl}/try/${slug}`;

    apiLogger.info(`[TrialLink] Created trial link: ${slug} for $${parsedAmount} ${fiatCurrency} from IP ${clientIp}`);

    return successResponseHelper(res, 201, "Trial payment link created successfully", {
      id: (trialLink as any).id,
      slug,
      link_url: linkUrl,
      amount: parsedAmount,
      currency: fiatCurrency,
      description: description || null,
      claim_token: rawClaimToken, // Return raw token ONCE — merchant must save this
      expires_at: expiresAt.toISOString(),
      accepted_currencies: ["BTC", "ETH", "USDT-TRC20", "USDT-ERC20"],
      status: "active",
    });
  } catch (error: any) {
    apiLogger.error(`[TrialLink] Error creating trial link: ${error.message}`);
    return errorResponseHelper(res, 500, "Failed to create trial link");
  }
};

/**
 * GET /api/public/trial/:slug
 * 
 * Get trial link details for the payment page.
 * Public endpoint — no auth required.
 */
export const getTrialLink = async (req: express.Request, res: express.Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return errorResponseHelper(res, 400, "Slug is required");
    }

    const trialLink = await trialPaymentLinkModel.findOne({
      where: { slug },
      attributes: [
        "id", "slug", "amount", "fiat_currency", "description",
        "status", "deposit_address", "accepted_currencies",
        "expires_at", "paid_at", "paid_currency", "paid_amount_crypto",
        "qr_code_url", "createdAt",
      ],
    });

    if (!trialLink) {
      return errorResponseHelper(res, 404, "Trial link not found");
    }

    const data = trialLink.get({ plain: true }) as any;

    // Check expiry
    if (data.status === "active" && new Date(data.expires_at) < new Date()) {
      await trialPaymentLinkModel.update(
        { status: "expired" },
        { where: { id: data.id } }
      );
      data.status = "expired";
    }

    // Parse accepted currencies
    const acceptedCurrencies = data.accepted_currencies
      ? data.accepted_currencies.split(",").map((c: string) => c.trim())
      : ["BTC", "ETH", "USDT-TRC20", "USDT-ERC20"];

    return successResponseHelper(res, 200, "Trial link retrieved", {
      ...data,
      accepted_currencies: acceptedCurrencies,
      is_expired: data.status === "expired",
      is_paid: data.status === "paid" || data.status === "claimed",
      is_claimed: data.status === "claimed",
    });
  } catch (error: any) {
    apiLogger.error(`[TrialLink] Error fetching trial link: ${error.message}`);
    return errorResponseHelper(res, 500, "Failed to fetch trial link");
  }
};

/**
 * POST /api/public/claim-funds
 * 
 * Claim funds from a paid trial link.
 * Creates a user account and company, then releases funds.
 */
export const claimFunds = async (req: express.Request, res: express.Response) => {
  try {
    const { slug, claim_token, email, password, company_name } = req.body;

    // Validate required fields
    if (!slug || !claim_token || !email || !password) {
      return errorResponseHelper(res, 400, "slug, claim_token, email, and password are required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponseHelper(res, 400, "Invalid email format");
    }

    // Validate password strength
    if (password.length < 8) {
      return errorResponseHelper(res, 400, "Password must be at least 8 characters");
    }

    // Find trial link
    const trialLink = await trialPaymentLinkModel.findOne({
      where: { slug },
    });

    if (!trialLink) {
      return errorResponseHelper(res, 404, "Trial link not found");
    }

    const linkData = trialLink.get({ plain: true }) as any;

    // Check status — must be "paid" to claim
    if (linkData.status === "claimed") {
      return errorResponseHelper(res, 400, "Funds have already been claimed");
    }
    if (linkData.status === "active") {
      return errorResponseHelper(res, 400, "Payment has not been received yet");
    }
    if (linkData.status === "expired" || linkData.status === "refunded") {
      return errorResponseHelper(res, 400, "This trial link has expired or been refunded");
    }

    // Verify claim token
    const isValidToken = await verifyPassword(claim_token, linkData.claim_token);
    if (!isValidToken) {
      return errorResponseHelper(res, 401, "Invalid claim token");
    }

    // Check claim expiry
    if (linkData.claim_expires_at && new Date(linkData.claim_expires_at) < new Date()) {
      return errorResponseHelper(res, 400, "Claim period has expired. Funds will be refunded.");
    }

    // Import models for account creation
    const { userModel, companyModel } = require("../models");

    // Check if email already exists
    const existingUser = await userModel.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return errorResponseHelper(res, 409, "An account with this email already exists. Please log in to claim your funds.");
    }

    // Create user account
    const hashedPassword = hashPassword(password);
    const newUser = await userModel.create({
      name: company_name || email.split("@")[0],
      email: email.toLowerCase(),
      password: hashedPassword,
      login_type: "EMAIL",
      status: "active",
    });

    const userId = (newUser as any).user_id;

    // Create company
    const newCompany = await companyModel.create({
      user_id: userId,
      company_name: company_name || `${email.split("@")[0]}'s Business`,
      email: email.toLowerCase(),
    });

    const companyId = (newCompany as any).company_id;

    // Update trial link as claimed
    await trialPaymentLinkModel.update(
      {
        status: "claimed",
        claim_email: email.toLowerCase(),
        claimed_at: new Date(),
        user_id: userId,
        company_id: companyId,
      },
      { where: { id: linkData.id } }
    );

    apiLogger.info(`[TrialLink] Funds claimed for slug=${slug} by ${email}, user_id=${userId}, company_id=${companyId}`);

    return successResponseHelper(res, 200, "Funds claimed successfully! Your account has been created.", {
      user_id: userId,
      company_id: companyId,
      email: email.toLowerCase(),
      amount: linkData.amount,
      currency: linkData.fiat_currency,
      message: "Welcome to DynoPay! Your first €1,000 in transactions are fee-free.",
    });
  } catch (error: any) {
    apiLogger.error(`[TrialLink] Error claiming funds: ${error.message}`);
    return errorResponseHelper(res, 500, "Failed to claim funds");
  }
};

/**
 * GET /api/public/trial-links
 * 
 * List trial links by IP (for the creator to see their links).
 * Rate-limited, returns only links created from the requester's IP.
 */
export const listTrialLinks = async (req: express.Request, res: express.Response) => {
  try {
    const clientIp = getClientIp(req);

    const links = await trialPaymentLinkModel.findAll({
      where: {
        ip_address: clientIp,
        status: { [Op.ne]: "expired" },
      },
      attributes: [
        "id", "slug", "amount", "fiat_currency", "description",
        "status", "expires_at", "createdAt",
      ],
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    const frontendUrl = process.env.FRONTEND_URL || process.env.SERVER_URL || "";
    const data = links.map((link: any) => {
      const plain = link.get({ plain: true });
      return {
        ...plain,
        link_url: `${frontendUrl}/try/${plain.slug}`,
      };
    });

    return successResponseHelper(res, 200, "Trial links retrieved", data);
  } catch (error: any) {
    apiLogger.error(`[TrialLink] Error listing trial links: ${error.message}`);
    return errorResponseHelper(res, 500, "Failed to list trial links");
  }
};
