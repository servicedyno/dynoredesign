import express from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import { apiLogger } from "../utils/loggers";
import successResponseHelper from "../helper/successResponseHelper";
import errorResponseHelper from "../helper/errorResponseHelper";
import trialPaymentLinkModel from "../models/trialPaymentLinkModel";
import { hashPassword } from "../helper/passwordHelper";
import { sendEmail } from "../helper/sendEmail";

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
const FRONTEND_BASE_URL = (process.env.FRONTEND_URL || process.env.SERVER_URL || "").replace(/\/$/, "");

/**
 * Generate a short, URL-safe slug
 */
function generateSlug(): string {
  return crypto.randomBytes(8).toString("base64url").slice(0, 12);
}

/**
 * Generate a URL-safe management token (24 chars)
 */
function generateManagementToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * SHA-256 hash for management token (deterministic — allows lookup by hash)
 */
function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
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
 * Requires an email — sends a management link to the creator's inbox.
 * Rate-limited to TRIAL_LINK_RATE_LIMIT per IP per 24h.
 */
export const createTrialLink = async (req: express.Request, res: express.Response) => {
  try {
    const { amount, currency, description, email } = req.body;

    // Validate email (required for seamless flow)
    if (!email || typeof email !== "string") {
      return errorResponseHelper(res, 400, "Email is required to receive your management link");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return errorResponseHelper(res, 400, "Please enter a valid email address");
    }

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

    // Generate unique slug
    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await trialPaymentLinkModel.findOne({ where: { slug } });
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    apiLogger.info(`[TrialLink] Step 3: generated slug ${slug}`);

    // Generate management token (sent via email — replaces claim_token UX)
    const rawManagementToken = generateManagementToken();
    const managementTokenHash = sha256(rawManagementToken);

    // Also generate a claim_token for backward compatibility
    const rawClaimToken = crypto.randomBytes(32).toString("hex");
    const hashedClaimToken = hashPassword(rawClaimToken);

    apiLogger.info(`[TrialLink] Step 4: generated management token`);

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
      creator_email: email.trim().toLowerCase(),
      management_token_hash: managementTokenHash,
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

    // Build URLs
    const linkUrl = `${FRONTEND_BASE_URL}/try/${slug}`;
    const manageUrl = `${FRONTEND_BASE_URL}/try/manage/${rawManagementToken}`;

    // Send management email
    try {
      const currencySymbol = fiatCurrency === "EUR" ? "\u20ac" : fiatCurrency === "GBP" ? "\u00a3" : "$";
      const emailMessage = `
        <p>Your payment link has been created successfully!</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>Amount:</strong> ${currencySymbol}${parsedAmount.toFixed(2)} ${fiatCurrency}</p>
          ${description ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>Description:</strong> ${description}</p>` : ""}
          <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Expires:</strong> ${expiresAt.toLocaleString()}</p>
        </div>
        <p><strong>Payment Link</strong> (share with your customer):</p>
        <p style="word-break: break-all; background: #eef2ff; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 13px;">
          <a href="${linkUrl}" style="color: #0004FF;">${linkUrl}</a>
        </p>
        <p style="margin-top: 20px;">Use the button below to check your payment status and claim your funds once paid:</p>
      `;

      await sendEmail(
        email.trim().toLowerCase(),
        email.split("@")[0],
        `Your DynoPay Payment Link — ${currencySymbol}${parsedAmount.toFixed(2)} ${fiatCurrency}`,
        emailMessage,
        false
      );

      apiLogger.info(`[TrialLink] Management email sent to ${email}`);
    } catch (emailErr: any) {
      apiLogger.warn(`[TrialLink] Failed to send management email: ${emailErr.message}`);
      // Don't fail the request if email fails — still return the management URL
    }

    apiLogger.info(`[TrialLink] Created trial link: ${slug} for $${parsedAmount} ${fiatCurrency} from IP ${clientIp}`);

    return successResponseHelper(res, 201, "Payment link created! Check your email for the management link.", {
      id: (trialLink as any).id,
      slug,
      link_url: linkUrl,
      manage_url: manageUrl,
      amount: parsedAmount,
      currency: fiatCurrency,
      description: description || null,
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
 * GET /api/public/trial/manage/:token
 * 
 * Get trial link details via management token (sent in email).
 * This is the seamless alternative to the claim_token flow.
 */
export const getTrialLinkByManagementToken = async (req: express.Request, res: express.Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return errorResponseHelper(res, 400, "Management token is required");
    }

    const tokenHash = sha256(token);

    const trialLink = await trialPaymentLinkModel.findOne({
      where: { management_token_hash: tokenHash },
      attributes: [
        "id", "slug", "amount", "fiat_currency", "description",
        "status", "deposit_address", "accepted_currencies",
        "expires_at", "paid_at", "paid_currency", "paid_amount_crypto",
        "claimed_at", "creator_email", "claim_email",
        "qr_code_url", "createdAt",
      ],
    });

    if (!trialLink) {
      return errorResponseHelper(res, 404, "Invalid or expired management link");
    }

    const data = trialLink.get({ plain: true }) as any;

    // Check expiry for active links
    if (data.status === "active" && new Date(data.expires_at) < new Date()) {
      await trialPaymentLinkModel.update(
        { status: "expired" },
        { where: { id: data.id } }
      );
      data.status = "expired";
    }

    const frontendUrl = FRONTEND_BASE_URL;
    const linkUrl = `${frontendUrl}/try/${data.slug}`;

    const acceptedCurrencies = data.accepted_currencies
      ? data.accepted_currencies.split(",").map((c: string) => c.trim())
      : ["BTC", "ETH", "USDT-TRC20", "USDT-ERC20"];

    return successResponseHelper(res, 200, "Trial link retrieved", {
      slug: data.slug,
      amount: data.amount,
      currency: data.fiat_currency,
      description: data.description,
      status: data.status,
      link_url: linkUrl,
      creator_email: data.creator_email,
      accepted_currencies: acceptedCurrencies,
      expires_at: data.expires_at,
      paid_at: data.paid_at,
      paid_currency: data.paid_currency,
      paid_amount_crypto: data.paid_amount_crypto,
      claimed_at: data.claimed_at,
      is_expired: data.status === "expired",
      is_paid: data.status === "paid" || data.status === "claimed",
      is_claimed: data.status === "claimed",
      can_claim: data.status === "paid",
    });
  } catch (error: any) {
    apiLogger.error(`[TrialLink] Error fetching by management token: ${error.message}`);
    return errorResponseHelper(res, 500, "Failed to fetch trial link");
  }
};

/**
 * POST /api/public/claim-funds
 * 
 * Claim funds from a paid trial link.
 * Creates a user account and company, then releases funds.
 * Supports both management_token (new seamless flow) and legacy claim_token.
 */
export const claimFunds = async (req: express.Request, res: express.Response) => {
  try {
    const { slug, claim_token, management_token, email, password, company_name } = req.body;

    // Validate required fields
    if (!email || !password) {
      return errorResponseHelper(res, 400, "email and password are required");
    }
    if (!management_token && !slug) {
      return errorResponseHelper(res, 400, "management_token or slug is required");
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

    // Find trial link — by management_token (new flow) or slug+claim_token (legacy)
    let trialLink: any = null;

    if (management_token) {
      const tokenHash = sha256(management_token);
      trialLink = await trialPaymentLinkModel.findOne({
        where: { management_token_hash: tokenHash },
      });
      if (!trialLink) {
        return errorResponseHelper(res, 404, "Invalid management link");
      }
    } else if (slug && claim_token) {
      trialLink = await trialPaymentLinkModel.findOne({
        where: { slug },
      });
      if (!trialLink) {
        return errorResponseHelper(res, 404, "Trial link not found");
      }
      // Verify legacy claim token
      const linkData = trialLink.get({ plain: true }) as any;
      if (linkData.claim_token) {
        const { verifyPassword } = require("../helper/passwordHelper");
        const isValidToken = await verifyPassword(claim_token, linkData.claim_token);
        if (!isValidToken) {
          return errorResponseHelper(res, 401, "Invalid claim token");
        }
      }
    } else {
      return errorResponseHelper(res, 400, "management_token or (slug + claim_token) is required");
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

    apiLogger.info(`[TrialLink] Funds claimed for slug=${linkData.slug} by ${email}, user_id=${userId}, company_id=${companyId}`);

    return successResponseHelper(res, 200, "Funds claimed successfully! Your account has been created.", {
      user_id: userId,
      company_id: companyId,
      email: email.toLowerCase(),
      amount: linkData.amount,
      currency: linkData.fiat_currency,
      message: "Welcome to DynoPay! Your first $500 in transactions are fee-free.",
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

    const data = links.map((link: any) => {
      const plain = link.get({ plain: true });
      return {
        ...plain,
        link_url: `${FRONTEND_BASE_URL}/try/${plain.slug}`,
      };
    });

    return successResponseHelper(res, 200, "Trial links retrieved", data);
  } catch (error: any) {
    apiLogger.error(`[TrialLink] Error listing trial links: ${error.message}`);
    return errorResponseHelper(res, 500, "Failed to list trial links");
  }
};
