import express from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import { apiLogger } from "../utils/loggers";
import successResponseHelper from "../helper/successResponseHelper";
import errorResponseHelper from "../helper/errorResponseHelper";
import trialPaymentLinkModel from "../models/trialPaymentLinkModel";
import { hashPassword } from "../helper/passwordHelper";
import { sendEmail } from "../helper/sendEmail";
import { encrypt } from "../helper/encryption";
import {
  userModel,
  companyModel,
  paymentLinkModel,
} from "../models";
import { apiModel } from "../models/apiModels";
import { setRedisItem } from "../utils/redisInstance";
import * as merchantPoolService from "../services/merchantPoolService";
import { getCryptoRedisKey } from "../services/merchantPool/merchantPoolConfig";
import { generateQRCodeWithLogo } from "../utils/qrCodeWithLogo";

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
 * Now creates a PROVISIONAL user/company/API-key + real payment link
 * so the payment flows through the standard DynoPay pipeline.
 */
export const createTrialLink = async (req: express.Request, res: express.Response) => {
  try {
    const { amount, currency, description, email } = req.body;

    // ── Validate email ──
    if (!email || typeof email !== "string") {
      return errorResponseHelper(res, 400, "Email is required to receive your management link");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      return errorResponseHelper(res, 400, "Please enter a valid email address");
    }

    // ── Validate amount ──
    if (!amount || isNaN(parseFloat(amount))) {
      return errorResponseHelper(res, 400, "Amount is required and must be a number");
    }
    const parsedAmount = parseFloat(amount);
    const fiatCurrency = (currency || "USD").toUpperCase();

    if (parsedAmount < TRIAL_MIN_AMOUNT) {
      return errorResponseHelper(res, 400, `Minimum amount is $${TRIAL_MIN_AMOUNT}`);
    }
    if (parsedAmount > TRIAL_MAX_AMOUNT) {
      return errorResponseHelper(res, 400, `Maximum amount is $${TRIAL_MAX_AMOUNT} (KYC required for higher amounts)`);
    }

    // ── Rate limit by IP ──
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

    // ── Check if email belongs to a FULL (non-trial) account ──
    const existingUser = await userModel.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      const existingStatus = (existingUser as any).status || (existingUser as any).dataValues?.status;
      if (existingStatus !== "trial") {
        return errorResponseHelper(
          res,
          409,
          "An account with this email already exists. Please log in to create payment links from your dashboard."
        );
      }
    }

    apiLogger.info(`[TrialLink] Step 2: email check passed`);

    // ── Reuse or create provisional user + company ──
    let userId: number;
    let companyId: number;

    if (existingUser) {
      // Reuse existing trial user
      userId = (existingUser as any).user_id ?? (existingUser as any).dataValues?.user_id;
      const existingCompany = await companyModel.findOne({ where: { user_id: userId } });
      if (!existingCompany) {
        const newCompany = await companyModel.create({
          user_id: userId,
          company_name: `${normalizedEmail.split("@")[0]}'s Business`,
          email: normalizedEmail,
        });
        companyId = (newCompany as any).company_id ?? (newCompany as any).dataValues?.company_id;
      } else {
        companyId = (existingCompany as any).company_id ?? (existingCompany as any).dataValues?.company_id;
      }
      apiLogger.info(`[TrialLink] Reusing provisional user ${userId}, company ${companyId}`);
    } else {
      // Create new provisional user (status: "trial", random password)
      const randomPwd = crypto.randomBytes(32).toString("hex");
      const newUser = await userModel.create({
        name: normalizedEmail.split("@")[0],
        email: normalizedEmail,
        password: hashPassword(randomPwd),
        login_type: "EMAIL",
        status: "trial",
      });
      userId = (newUser as any).user_id ?? (newUser as any).dataValues?.user_id;

      const newCompany = await companyModel.create({
        user_id: userId,
        company_name: `${normalizedEmail.split("@")[0]}'s Business`,
        email: normalizedEmail,
      });
      companyId = (newCompany as any).company_id ?? (newCompany as any).dataValues?.company_id;
      apiLogger.info(`[TrialLink] Created provisional user ${userId}, company ${companyId}`);
    }

    // ── Ensure an API key exists for the company ──
    let activeApi = await apiModel.findOne({
      where: { company_id: companyId, status: "active" },
    });

    if (!activeApi) {
      const keyData = { company_id: companyId, user_id: userId, ts: Date.now() };
      const keyString = "dpk_live_DYNOPAY_USER_API-" + JSON.stringify(keyData);
      const apiKey = encrypt(keyString, process.env.API_SECRET);

      // Create admin token for the API key
      const adminTokenSecret = process.env.SECRET_KEY || "dynopay-secret";
      const adminTokenPayload = { user_id: userId, company_id: companyId, environment: "production" };
      const jwt = require("jsonwebtoken");
      const adminToken = jwt.sign(adminTokenPayload, adminTokenSecret, { expiresIn: "365d" });

      // Generate a customer-facing token
      const tokenPayload = { user_id: userId, company_id: companyId };
      const customerToken = jwt.sign(tokenPayload, adminTokenSecret, { expiresIn: "365d" });

      activeApi = await apiModel.create({
        company_id: companyId,
        base_currency: fiatCurrency,
        apiKey,
        user_id: userId,
        adminToken: customerToken,
        admin_token: adminToken,
        api_name: `Trial API - ${normalizedEmail.split("@")[0]}`,
        permissions: JSON.stringify(["createPaymentLink", "getPaymentLinks"]),
        environment: "production",
        status: "active",
        request_count: 0,
        rate_limit_per_minute: 60,
        rate_limit_per_hour: 3600,
        rate_limit_per_day: 100000,
      });
      apiLogger.info(`[TrialLink] Created API key for company ${companyId}`);
    }

    // ── Create internal payment link (BTC only, skip KYC/wallet checks) ──
    const CHECKOUT_BASE = (process.env.CHECKOUT_URL || process.env.SERVER_URL || "").replace(/\/$/, "");
    const uniqueRef = crypto.randomBytes(24).toString("hex");
    const transactionId = crypto.randomUUID();
    const checkoutUrl = `${CHECKOUT_BASE}/pay?d=${uniqueRef}`;
    const trialAcceptedCurrencies = "BTC";

    const linkPayload = {
      transaction_id: transactionId,
      email: null,
      allowedModes: "crypto",
      base_amount: parsedAmount,
      base_currency: fiatCurrency,
      user_id: userId,
      adm_id: userId,
      company_id: companyId,
      payment_link: checkoutUrl,
      description: description || "Trial payment — try DynoPay",
      expires_at: new Date(Date.now() + TRIAL_LINK_EXPIRY_HOURS * 60 * 60 * 1000),
      callback_url: null,
      redirect_url: null,
      webhook_url: null,
      fee_payer: "company",
      apply_tax: false,
      accepted_currencies: trialAcceptedCurrencies,
      customer_name: null,
    };

    const linkRecord = await paymentLinkModel.create(linkPayload);
    const linkId = (linkRecord as any).dataValues?.link_id ?? (linkRecord as any).link_id;

    // Store in Redis so checkout page can resolve this ref
    const redisPayload = {
      ...linkPayload,
      pathType: "createLink",
      link_id: linkId,
      available_currencies: ["BTC"],
      all_configured_currencies: ["BTC"],
      createdAt: new Date().toISOString(),
    };
    await setRedisItem("customer-" + uniqueRef, redisPayload);

    apiLogger.info(`[TrialLink] Created payment link ${linkId}, ref=${uniqueRef}`);

    // ── Reserve merchant pool address for BTC Direct Pay ──
    let directPayAddress: string | null = null;
    let directPayQrCode: string | null = null;
    let directPayTempId: number | null = null;

    try {
      const poolAddress = await merchantPoolService.reserveAddress(
        "BTC",
        transactionId,
        userId,
        companyId,
        parsedAmount,
      ) as any;

      if (poolAddress) {
        directPayAddress = poolAddress.dataValues?.wallet_address || poolAddress.wallet_address;
        directPayTempId = poolAddress.dataValues?.temp_address_id || poolAddress.temp_address_id;

        // Generate QR code
        directPayQrCode = await generateQRCodeWithLogo(directPayAddress!, "BTC", 400);

        // Update Redis so checkout can use the same address
        const updatedRedisPayload = {
          ...redisPayload,
          direct_pay_temp_id: directPayTempId,
          direct_pay_address: directPayAddress,
        };
        await setRedisItem("customer-" + uniqueRef, updatedRedisPayload);

        // Set crypto-{address} Redis key for webhook processor
        const directPayCryptoRedisKey = getCryptoRedisKey(directPayAddress!, undefined);
        await setRedisItem(directPayCryptoRedisKey, {
          mode: "crypto",
          base_amount_usd: parsedAmount,
          total_amount_usd: parsedAmount,
          status: "pending",
          ref: uniqueRef,
          currency: "BTC",
          payment_id: transactionId,
          unique_tx_id: transactionId,
          walletType: "customer",
          temp_id: directPayTempId,
          is_merchant_pool: "true",
          fee_payer: "company",
          company_id: companyId,
          link_id: linkId,
          direct_pay_origin: "createTrialLink",
        });

        apiLogger.info(`[TrialLink] Reserved BTC pool address: ${directPayAddress} (temp_id: ${directPayTempId})`);
      }
    } catch (poolErr: any) {
      apiLogger.warn(`[TrialLink] Pool address reservation failed (non-blocking): ${poolErr.message}`);
    }

    // ── Generate slug + management token ──
    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await trialPaymentLinkModel.findOne({ where: { slug } });
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    const rawManagementToken = generateManagementToken();
    const managementTokenHash = sha256(rawManagementToken);
    const rawClaimToken = crypto.randomBytes(32).toString("hex");
    const hashedClaimToken = hashPassword(rawClaimToken);

    const expiresAt = new Date(Date.now() + TRIAL_LINK_EXPIRY_HOURS * 60 * 60 * 1000);

    // ── Create trial link (with provisional account + payment link refs) ──
    const trialLink = await trialPaymentLinkModel.create({
      slug,
      amount: parsedAmount,
      fiat_currency: fiatCurrency,
      description: description || null,
      claim_token: hashedClaimToken,
      creator_email: normalizedEmail,
      management_token_hash: managementTokenHash,
      status: "active",
      ip_address: clientIp,
      expires_at: expiresAt,
      accepted_currencies: trialAcceptedCurrencies,
      // New fields — link to real payment infra
      checkout_ref: uniqueRef,
      payment_link_id: linkId,
      checkout_url: checkoutUrl,
      provisional_user_id: userId,
      provisional_company_id: companyId,
    });

    // ── Increment rate limit ──
    try {
      const redis = await getRedisRateClient();
      await redis.set(rateLimitKey, String(count + 1), { EX: 86400 });
    } catch (e) {
      apiLogger.warn("[TrialLink] Redis unavailable for rate limit increment");
    }

    // ── Send management email ──
    const linkUrl = `${FRONTEND_BASE_URL}/try/${slug}`;
    const manageUrl = `${FRONTEND_BASE_URL}/try/manage/${rawManagementToken}`;

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
          <a href="${checkoutUrl}" style="color: #0004FF;">${checkoutUrl}</a>
        </p>
        <p style="margin-top: 20px;">Use the button below to check your payment status and claim your funds once paid:</p>
      `;

      await sendEmail(
        normalizedEmail,
        normalizedEmail.split("@")[0],
        `Your DynoPay Payment Link \u2014 ${currencySymbol}${parsedAmount.toFixed(2)} ${fiatCurrency}`,
        emailMessage,
        false
      );
      apiLogger.info(`[TrialLink] Management email sent to ${normalizedEmail}`);
    } catch (emailErr: any) {
      apiLogger.warn(`[TrialLink] Failed to send management email: ${emailErr.message}`);
    }

    apiLogger.info(`[TrialLink] Created trial link: ${slug}, checkout=${checkoutUrl}, user=${userId}, company=${companyId}`);

    return successResponseHelper(res, 201, "Payment link created! Check your email for the management link.", {
      id: (trialLink as any).id,
      slug,
      link_url: linkUrl,
      manage_url: manageUrl,
      checkout_url: checkoutUrl,
      amount: parsedAmount,
      currency: fiatCurrency,
      description: description || null,
      expires_at: expiresAt.toISOString(),
      accepted_currencies: ["BTC"],
      status: "active",
      direct_pay_address: directPayAddress,
      direct_pay_qr_code: directPayQrCode,
    });
  } catch (error: any) {
    apiLogger.error(`[TrialLink] Error creating trial link: ${error.message}`, error.stack);
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
        "qr_code_url", "createdAt", "checkout_url",
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
      checkout_url: data.checkout_url || null,
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
        "qr_code_url", "createdAt", "checkout_url",
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
      checkout_url: data.checkout_url || null,
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
 * ACTIVATES the provisional user/company created at link-creation time
 * instead of creating a new account.  Sets the real password, creates wallet records.
 */
export const claimFunds = async (req: express.Request, res: express.Response) => {
  try {
    const { slug, claim_token, management_token, email, password, company_name, wallet_address } = req.body;

    // Validate required fields
    if (!email || !password) {
      return errorResponseHelper(res, 400, "Email and password are required");
    }
    if (!management_token && !slug) {
      return errorResponseHelper(res, 400, "management_token or slug is required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponseHelper(res, 400, "Invalid email format");
    }
    if (password.length < 8) {
      return errorResponseHelper(res, 400, "Password must be at least 8 characters");
    }

    // Find trial link
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
      trialLink = await trialPaymentLinkModel.findOne({ where: { slug } });
      if (!trialLink) {
        return errorResponseHelper(res, 404, "Trial link not found");
      }
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

    if (linkData.status === "claimed") {
      return errorResponseHelper(res, 400, "Funds have already been claimed");
    }
    if (linkData.status === "active") {
      return errorResponseHelper(res, 400, "Payment has not been received yet");
    }
    if (linkData.status === "expired" || linkData.status === "refunded") {
      return errorResponseHelper(res, 400, "This trial link has expired or been refunded");
    }

    if (linkData.claim_expires_at && new Date(linkData.claim_expires_at) < new Date()) {
      return errorResponseHelper(res, 400, "Claim period has expired. Funds will be refunded.");
    }

    // Validate wallet address
    const paidCurrency = linkData.paid_currency;
    if (!wallet_address || typeof wallet_address !== "string" || !wallet_address.trim()) {
      return errorResponseHelper(
        res,
        400,
        `A ${paidCurrency || "crypto"} wallet address is required to receive your funds`
      );
    }

    const { validateCryptoAddress } = require("../utils/addressValidation");
    const addressValidation = validateCryptoAddress(wallet_address.trim(), paidCurrency);
    if (!addressValidation.isValid) {
      return errorResponseHelper(res, 400, addressValidation.error || `Invalid ${paidCurrency} wallet address format`);
    }

    apiLogger.info(`[TrialClaim] Wallet validated: ${paidCurrency} ${wallet_address.slice(0, 10)}...`);

    // ── Activate provisional account (or create new if none exists) ──
    const userWalletModel = require("../models/userModels/userWalletModel").default;
    const userWalletAddressModel = require("../models/userModels/userWalletAddressModel").default;
    const normalizedEmail = email.toLowerCase();

    let userId: number;
    let companyId: number;

    if (linkData.provisional_user_id && linkData.provisional_company_id) {
      // ── Activate the provisional account ──
      userId = linkData.provisional_user_id;
      companyId = linkData.provisional_company_id;

      // Check if someone else already took this email (edge case)
      const conflictUser = await userModel.findOne({
        where: { email: normalizedEmail, user_id: { [Op.ne]: userId } },
      });
      if (conflictUser) {
        return errorResponseHelper(res, 409, "An account with this email already exists. Please log in.");
      }

      // Activate user: set real password, status → active, update email/name
      const hashedPassword = hashPassword(password);
      await userModel.update(
        {
          password: hashedPassword,
          status: "active",
          email: normalizedEmail,
          name: company_name || normalizedEmail.split("@")[0],
        },
        { where: { user_id: userId } }
      );

      // Update company name if provided
      if (company_name) {
        await companyModel.update(
          { company_name, email: normalizedEmail },
          { where: { company_id: companyId } }
        );
      }

      apiLogger.info(`[TrialClaim] Activated provisional user ${userId}, company ${companyId}`);
    } else {
      // ── Legacy path: no provisional account, create new ──
      const existingUser = await userModel.findOne({ where: { email: normalizedEmail } });
      if (existingUser) {
        return errorResponseHelper(res, 409, "An account with this email already exists. Please log in to claim your funds.");
      }

      const hashedPassword = hashPassword(password);
      const newUser = await userModel.create({
        name: company_name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        password: hashedPassword,
        login_type: "EMAIL",
        status: "active",
      });
      userId = (newUser as any).user_id;

      const newCompany = await companyModel.create({
        user_id: userId,
        company_name: company_name || `${normalizedEmail.split("@")[0]}'s Business`,
        email: normalizedEmail,
      });
      companyId = (newCompany as any).company_id;

      apiLogger.info(`[TrialClaim] Created new user ${userId}, company ${companyId} (legacy path)`);
    }

    // ── Create wallet records ──
    const walletLabel = `${paidCurrency} Wallet`;
    await userWalletAddressModel.create({
      user_id: userId,
      company_id: companyId,
      wallet_name: walletLabel,
      label: walletLabel,
      currency: paidCurrency,
      wallet_address: wallet_address.trim(),
    });

    await userWalletModel.create({
      user_id: userId,
      company_id: companyId,
      wallet_name: walletLabel,
      amount: 0,
      wallet_type: paidCurrency,
      wallet_address: wallet_address.trim(),
      currency_type: "CRYPTO",
    });

    apiLogger.info(`[TrialClaim] Created wallet records: ${paidCurrency} for company ${companyId}`);

    // ── Mark trial link as claimed ──
    await trialPaymentLinkModel.update(
      {
        status: "claimed",
        claim_email: normalizedEmail,
        claimed_at: new Date(),
        user_id: userId,
        company_id: companyId,
        settlement_wallet_address: wallet_address.trim(),
      },
      { where: { id: linkData.id } }
    );

    apiLogger.info(`[TrialClaim] Claimed: slug=${linkData.slug}, user=${userId}, company=${companyId}`);

    return successResponseHelper(res, 200, "Funds claimed successfully! Your account has been created.", {
      user_id: userId,
      company_id: companyId,
      email: normalizedEmail,
      amount: linkData.amount,
      currency: linkData.fiat_currency,
      paid_currency: paidCurrency,
      wallet_address: wallet_address.trim(),
      message: `Welcome to DynoPay! Your ${paidCurrency} will be settled to your wallet. Your first $500 in transactions are fee-free.`,
    });
  } catch (error: any) {
    apiLogger.error(`[TrialClaim] Error claiming funds: ${error.message}`, error.stack);
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
