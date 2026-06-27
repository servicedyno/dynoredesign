/**
 * Payment-link CRUD handlers.
 * Extracted verbatim from paymentController.ts (no behavior change).
 */
import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger, cronLogger } from "../../utils/loggers";
import {
  errorResponseHelper,
  successResponseHelper,
  sendEmail,
} from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { getRedisItem, setRedisItem, deleteRedisItem } from "../../utils/redisInstance";
import { formatAmountForDisplay, getCurrencyInfo } from "../../utils/currencyUtils";
import { companyModel, paymentLinkModel, userModel, userWalletModel } from "../../models";
import { PaymentUserJwtPayload } from "../../utils/types";
import { checkKycEnforcement, KYC_THRESHOLD_USD } from "../../helper/kycEnforcement";
import { generateQRCodeWithLogo } from "../../utils/qrCodeWithLogo";
import * as merchantPoolService from "../../services/merchantPoolService";
import { getCryptoRedisKey } from "../../services/merchantPool/merchantPoolConfig";
import { PaymentState, parseState } from "../../services/paymentStateMachine";

export const createPaymentLink = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  
  // Extract both old and new field names for backward compatibility
  // IMPORTANT: Client should send EITHER new format OR legacy format, not both
  // If both provided, new format (base_*) takes priority
  const { 
    email, 
    base_currency,    // NEW format (recommended)
    currency,         // LEGACY format (backward compatibility)
    modes, 
    amount,           // LEGACY format (backward compatibility)
    base_amount,      // NEW format (recommended)
    description,
    expire,
    callback_url,
    redirect_url,
    webhook_url,
    fee_payer,        // Who pays blockchain fees: 'customer' or 'company'
    company_id,       // Phase 10 Fix: Accept company_id for multi-tenant isolation
    apply_tax,        // Tax toggle: calculate tax based on customer location (default: false)
    accepted_currencies, // Array of crypto types to accept (e.g., ['BTC', 'ETH', 'USDT-TRC20'])
    // Fixed tax parameters (alternative to apply_tax location-based)
    // tax_percentage and tax_name removed - not used in this function
    name              // Customer name
  } = req.body;
  
  // Normalize field names - use new format first, fall back to legacy, then default
  // Priority: base_currency > currency > 'USD'
  const normalizedCurrency = base_currency || currency || 'USD';
  // Priority: base_amount > amount
  const normalizedAmount = base_amount || amount;
  
  try {
    // Validate required fields with clear error messages
    if (!normalizedAmount) {
      return errorResponseHelper(
        res, 
        400, 
        "Amount is required. Please provide either 'amount' or 'base_amount' field."
      );
    }
    
    // Validate amount is positive
    if (normalizedAmount <= 0) {
      return errorResponseHelper(
        res,
        400,
        "Amount must be greater than zero."
      );
    }
    
    // Validate email format if provided
    if (email && email.trim() !== "" && !email.includes('@')) {
      return errorResponseHelper(
        res,
        400,
        "Invalid email format. Please provide a valid email address."
      );
    }
    
    // Validate modes if provided
    if (modes) {
      const validModes = ['CRYPTO', 'CARD', 'BANK_TRANSFER', 'GOOGLE_PAY', 'APPLE_PAY', 'USSD', 'MOBILE_MONEY', 'QR_CODE'];
      const invalidModes = modes.filter((mode: string) => !validModes.includes(mode.toUpperCase()));
      
      if (invalidModes.length > 0) {
        return errorResponseHelper(
          res,
          400,
          `Invalid payment modes: ${invalidModes.join(', ')}. Valid modes are: ${validModes.join(', ')}`
        );
      }
      
      // Convert to uppercase if lowercase provided
      const normalizedModes = modes.map((mode: string) => mode.toUpperCase());
      req.body.modes = normalizedModes;
    }
    
    // Validate expire format if provided
    if (expire && expire !== 'No' && !['24h', '7d', '30d'].includes(expire)) {
      return errorResponseHelper(
        res,
        400,
        "Invalid expire value. Valid options are: '24h', '7d', '30d', or 'No'."
      );
    }
    
    // Phase 10 Fix: Validate company_id if provided
    if (company_id) {
      const companyExists = await companyModel.findOne({
        where: {
          company_id,
          user_id: userData.user_id,
        },
      });
      
      if (!companyExists) {
        return errorResponseHelper(
          res,
          400,
          "Invalid company_id or company does not belong to this user"
        );
      }
    }
    
    // ========================================
    // KYC ENFORCEMENT: Block payment creation if KYC required but not approved
    // ========================================
    let kycWarning: {
      type: string;
      message: string;
      days_remaining: number;
      threshold_date: string;
      grace_period_end: string;
      kyc_status: string;
      verification_url: string | null;
      api_endpoint: string;
      has_active_session: boolean;
    } | null = null;

    const kycResult = await checkKycEnforcement(userData.user_id, company_id, '[KYC - PaymentCreate]');

    if (kycResult.blocked) {
      return errorResponseHelper(
        res,
        403,
        `KYC verification required. Your transaction volume ($${kycResult.totalVolume.toFixed(2)}) exceeded the $${KYC_THRESHOLD_USD.toLocaleString()} threshold on ${kycResult.thresholdDate?.toLocaleDateString()}. Your 90-day grace period has expired. Please complete KYC verification to continue creating payment links. Current KYC status: ${kycResult.kycStatus}. [KYC_REQUIRED]`
      );
    } else if (kycResult.needsEnforcement && kycResult.kycStatus !== 'approved' && kycResult.daysRemaining !== undefined) {
      // Within grace period - set in-app warning
      const daysRemaining = kycResult.daysRemaining;
      const urgencyType = daysRemaining <= 14 ? "critical" : daysRemaining <= 30 ? "warning" : "info";
      kycWarning = {
        type: urgencyType,
        message: daysRemaining <= 14 
          ? `URGENT: Only ${daysRemaining} days left to complete KYC verification! Your account will be restricted after ${kycResult.gracePeriodEnd?.toLocaleDateString()}.`
          : daysRemaining <= 30
          ? `Warning: ${daysRemaining} days remaining to complete KYC verification before your account is restricted.`
          : `KYC verification required within ${daysRemaining} days. Your transaction volume ($${kycResult.totalVolume.toLocaleString()}) has exceeded the $${KYC_THRESHOLD_USD.toLocaleString()} threshold.`,
        days_remaining: daysRemaining,
        threshold_date: kycResult.thresholdDate?.toISOString() || '',
        grace_period_end: kycResult.gracePeriodEnd?.toISOString() || '',
        kyc_status: kycResult.kycStatus,
        verification_url: kycResult.hasActiveSession ? (kycResult.veriffSessionUrl || null) : null,
        api_endpoint: "/api/kyc/submit",
        has_active_session: !!kycResult.hasActiveSession,
      };
    }
    // ========================================
    // END KYC ENFORCEMENT
    // ========================================
    
    // Phase 11: Validate at least one crypto wallet is configured for this company
    const cryptoTypes = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    
    const walletWhereClause: Record<string, unknown> = {
      user_id: userData.user_id,
      wallet_type: { [Op.in]: cryptoTypes },
      wallet_address: { [Op.not]: null },
    };
    
    // If company_id is provided, filter by company_id
    if (company_id) {
      walletWhereClause.company_id = company_id;
    }
    
    const configuredWallets = await userWalletModel.findAll({
      where: walletWhereClause,
      attributes: ['wallet_type'],
    });
    
    if (configuredWallets.length === 0) {
      return errorResponseHelper(
        res,
        400,
        "No crypto wallet configured. Please add at least one crypto wallet address before creating a payment link."
      );
    }
    
    // Get unique list of ALL configured currencies for this company
    const allConfiguredCurrencies = [...new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];
    cronLogger.info(`[Phase 11] All configured currencies for company_id ${company_id}:`, allConfiguredCurrencies);
    
    // Validate and process accepted_currencies if provided
    let finalAcceptedCurrencies: string[] = allConfiguredCurrencies; // Default: all configured
    let acceptedCurrenciesString: string | null = null;
    
    if (accepted_currencies && Array.isArray(accepted_currencies) && accepted_currencies.length > 0) {
      // Normalize to uppercase
      const requestedCurrencies = accepted_currencies.map((c: string) => c.toUpperCase().trim());
      
      // Validate all requested currencies are valid crypto types
      const invalidCryptos = requestedCurrencies.filter((c: string) => !cryptoTypes.includes(c));
      if (invalidCryptos.length > 0) {
        return errorResponseHelper(
          res,
          400,
          `Invalid cryptocurrency types: ${invalidCryptos.join(', ')}. Valid options: ${cryptoTypes.join(', ')}`
        );
      }
      
      // Validate all requested currencies have configured wallets
      const unconfiguredCurrencies = requestedCurrencies.filter((c: string) => !allConfiguredCurrencies.includes(c));
      if (unconfiguredCurrencies.length > 0) {
        return errorResponseHelper(
          res,
          400,
          `No wallet configured for: ${unconfiguredCurrencies.join(', ')}. Please configure wallets first or select from available currencies: ${allConfiguredCurrencies.join(', ')}`
        );
      }
      
      // Use the merchant's selected currencies
      finalAcceptedCurrencies = requestedCurrencies;
      acceptedCurrenciesString = requestedCurrencies.join(',');
      cronLogger.info(`[createPaymentLink] Merchant selected currencies: ${acceptedCurrenciesString}`);
    } else {
      cronLogger.info(`[createPaymentLink] No currencies specified, using all configured: ${allConfiguredCurrencies.join(',')}`);
    }
    
    const uniqueRef = crypto.randomBytes(24).toString("hex");
    cronLogger.info(`[createPaymentLink] user_id=${userData.user_id}, company_id=${company_id}`);
    
    // Calculate expires_at based on expire option
    // DEFAULT: 7 days if not specified (for security and cleanup)
    let expires_at = null;
    const now = new Date();
    
    if (expire === "No") {
      // Explicitly set to never expire
      expires_at = null;
    } else if (expire === "24h") {
      expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (expire === "30d") {
      expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      // Default to 7 days if not specified or explicitly set to "7d"
      expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    // company_id is REQUIRED - validate it exists
    if (!company_id) {
      return errorResponseHelper(
        res,
        400,
        "company_id is required. Please specify which company this payment link belongs to."
      );
    }
    
    // Verify the company belongs to this user
    const userCompany = await companyModel.findOne({
      where: { 
        company_id: company_id,
        user_id: userData.user_id 
      }
    });
    
    if (!userCompany) {
      return errorResponseHelper(
        res,
        400,
        "Invalid company_id. The specified company does not exist or does not belong to you."
      );
    }
    
    cronLogger.info(`[createPaymentLink] Using company_id: ${company_id} for user: ${userData.user_id}`);
    
    // ========================================
    // ACTIVE API KEY CHECK: Block if no active API key exists
    // ========================================
    const activeApiKey = await sequelize.query<{ api_id: number }>(
      `SELECT api_id FROM tbl_api WHERE company_id = :companyId AND status = 'active' LIMIT 1`,
      {
        replacements: { companyId: company_id },
        type: QueryTypes.SELECT,
      }
    );
    
    if (!activeApiKey || activeApiKey.length === 0) {
      return errorResponseHelper(
        res,
        400,
        "An active API key is required to create a payment link. Please create one in your developer settings."
      );
    }
    // ========================================
    // END ACTIVE API KEY CHECK
    // ========================================
    
    // Default modes if not provided
    const allowedModes = modes ? modes.join(",") : "crypto,card";
    
    const payload = {
      transaction_id: crypto.randomUUID(),
      email: email || null,
      allowedModes: allowedModes,
      base_amount: normalizedAmount,
      base_currency: normalizedCurrency,
      user_id: userData.user_id,
      adm_id: userData.user_id,  // Add adm_id for crypto payment compatibility
      company_id: company_id,  // REQUIRED field
      payment_link: (process.env.CHECKOUT_URL || '').trim().replace(/\/$/, '') + "/pay?d=" + uniqueRef,
      description: description || null,
      expires_at: expires_at,
      callback_url: callback_url || null,
      redirect_url: redirect_url || null,
      webhook_url: webhook_url || null,
      fee_payer: fee_payer || 'company',  // Default: company pays fees (existing behavior)
      apply_tax: apply_tax || false,  // Tax toggle: OFF by default, merchant must enable
      accepted_currencies: acceptedCurrenciesString,  // Store merchant's selected currencies (null = all)
      customer_name: name || null,  // Optional customer name for payment link
    };

    const links = await paymentLinkModel.create(payload);
    const redisPayload = {
      ...payload,
      pathType: "createLink",
      link_id: links.dataValues.link_id,
      available_currencies: finalAcceptedCurrencies,  // Use merchant's selection or all configured
      all_configured_currencies: allConfiguredCurrencies,  // Store all for reference
      createdAt: new Date().toISOString(),  // Include creation timestamp for checkout
    };

    cronLogger.info(redisPayload);

    await setRedisItem("customer-" + uniqueRef, redisPayload);

    // Send payment link email with referee code (if email provided)
    if (email && email.trim() !== "") {
      try {
        // Import referee code service
        const { createRefereeCode } = await import("../../services/referralService");
        
        // Try to create referee code (will return null if email has account or already received code)
        const refereeCodeData = await createRefereeCode({
          customerEmail: email,
          referrerCompanyId: company_id || userData.company_id,
          referrerUserId: userData.user_id,
          paymentLinkId: links.dataValues.link_id,
        });

        // Build email content
        let refereeCodeSection = "";
        if (refereeCodeData) {
          refereeCodeSection = `
            <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #f0fff4 0%, #e6ffed 100%); border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0;">
              <h3 style="margin: 0 0 10px 0; color: #166534; font-size: 16px;">🎁 Special Offer for You!</h3>
              <p style="margin: 0 0 10px 0; color: #14532d; font-size: 14px;">
                Want to accept crypto payments for your own business? Join Dynopay and get <strong>${refereeCodeData.discount}% off</strong> all fees for <strong>${refereeCodeData.duration} days</strong>!
              </p>
              <p style="margin: 0; font-size: 14px;">
                Use code: <strong style="background: #dcfce7; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${refereeCodeData.code}</strong>
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #166534;">
                This code is exclusive to you and expires in 30 days.
              </p>
            </div>
          `;
        }

        // Get company name if available
        let companyName = "Dynopay Merchant";
        if (company_id) {
          const company = await companyModel.findByPk(company_id);
          if (company) {
            companyName = (company as { company_name?: string }).company_name || companyName;
          }
        }

        const paymentMessage = `
You have received a payment request from <strong>${companyName}</strong>.

<div style="margin: 20px 0; padding: 20px; background: #f8f9ff; border-radius: 8px;">
  <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> ${normalizedAmount} ${normalizedCurrency}</p>
  ${description ? `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${description}</p>` : ''}
  ${expires_at ? `<p style="margin: 0;"><strong>Expires:</strong> ${new Date(expires_at).toLocaleDateString()}</p>` : ''}
</div>

<div style="text-align: center; margin: 24px 0;">
  <a href="${payload.payment_link}" style="display: inline-block; background: linear-gradient(135deg, #f47323 0%, #e05a00 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">Pay Now</a>
</div>

${refereeCodeSection}
        `.trim();

        await sendEmail(
          email,                                                                          // recipientEmail
          email.split('@')[0] || "Customer",                                              // name (extract from email)
          `Payment Request from ${companyName} - ${normalizedAmount} ${normalizedCurrency}`, // subject
          paymentMessage,                                                                 // message body
          false                                                                           // showImage
        );

        cronLogger.info(`[PaymentLink] Email sent to ${email}${refereeCodeData ? ` with referee code ${refereeCodeData.code}` : ''}`);
      } catch (emailError) {
        cronLogger.error("[PaymentLink] Failed to send email:", emailError);
        // Don't fail the request if email fails
      }
    }
    
    // Send payment link created notification to merchant
    try {
      const user = await userModel.findByPk(userData.user_id);
      if (user && user.dataValues.email) {
        const { sendPaymentLinkCreatedEmail } = await import("../../services/emailService");
        await sendPaymentLinkCreatedEmail(
          user.dataValues.email,
          user.dataValues.name || 'Merchant',
          normalizedAmount.toString(),
          normalizedCurrency,
          payload.payment_link,
          description || 'No description provided',
          expires_at ? new Date(expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : null
        );
        cronLogger.info(`[PaymentLink] Merchant notification sent to ${user.dataValues.email}`);
      }
    } catch (merchantEmailError) {
      cronLogger.error("[PaymentLink] Failed to send merchant notification:", merchantEmailError);
      // Don't fail the request if email fails
    }

    // ========================================
    // DIRECT PAY: Reserve merchant pool address when single crypto is selected
    // ========================================
    const MERCHANT_POOL_CRYPTO_TYPES_FOR_LINK = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    let directPayAddress: string | null = null;
    let directPayQrCode: string | null = null;
    let directPayTempId: number | null = null;

    if (
      finalAcceptedCurrencies.length === 1 &&
      MERCHANT_POOL_CRYPTO_TYPES_FOR_LINK.includes(finalAcceptedCurrencies[0])
    ) {
      const singleCrypto = finalAcceptedCurrencies[0];
      try {
        cronLogger.info(`[createPaymentLink] Single crypto ${singleCrypto} selected — reserving merchant pool address for Direct Pay`);
        const poolAddress = await merchantPoolService.reserveAddress(
          singleCrypto,
          payload.transaction_id,
          userData.user_id,
          company_id || 0,
          normalizedAmount || 0
        ) as any;

        if (poolAddress) {
          directPayAddress = poolAddress.dataValues?.wallet_address || poolAddress.wallet_address;
          directPayTempId = poolAddress.dataValues?.temp_address_id || poolAddress.temp_address_id;

          // Generate QR code for the pool address
          const destTag = poolAddress.dataValues?.destination_tag || poolAddress.destination_tag;
          const qrPayload = destTag
            ? `${directPayAddress}?dt=${destTag}`
            : directPayAddress;
          directPayQrCode = await generateQRCodeWithLogo(qrPayload, singleCrypto, 400);

          // Store the reserved pool address info in Redis so checkout can use the SAME address
          const updatedRedisPayload = {
            ...redisPayload,
            direct_pay_temp_id: directPayTempId,
            direct_pay_address: directPayAddress,
          };
          await setRedisItem("customer-" + uniqueRef, updatedRedisPayload);

          // ═══════════════════════════════════════════════════════════════════════
          // CRITICAL FIX: Set crypto-{address} Redis key at link creation time
          // This ensures the webhook processor can find payment data even if the
          // customer sends BTC directly to the address without opening the checkout page.
          // Previously, this key was only set during addPayment (checkout flow), causing
          // webhooks to be silently ignored with "No Redis data found" if the customer
          // paid before visiting checkout.
          // ═══════════════════════════════════════════════════════════════════════
          const dpDestTag = poolAddress.dataValues?.destination_tag || poolAddress.destination_tag;
          const directPayCryptoRedisKey = getCryptoRedisKey(directPayAddress!, dpDestTag);

          // Calculate fee structure for the Direct Pay crypto Redis entry
          const fallbackFeePercent = parseFloat(process.env.TRANSACTION_FEE_PERCENT || '2.0') / 100;
          // We don't have crypto_amount yet (customer hasn't selected), but store base info
          // The webhook processor + cryptoVerification will handle the actual conversion
          await setRedisItem(directPayCryptoRedisKey, {
            mode: "crypto",
            base_amount_usd: normalizedAmount,
            total_amount_usd: normalizedAmount,
            status: "pending",
            ref: uniqueRef,
            currency: singleCrypto,
            payment_id: payload.transaction_id,
            unique_tx_id: payload.transaction_id,
            walletType: "customer",
            temp_id: directPayTempId,
            is_merchant_pool: "true",
            fee_payer: fee_payer || 'company',
            company_id: company_id || null,
            link_id: links.dataValues.link_id,
            webhook_url: webhook_url || null,
            callback_url: callback_url || null,
            ...(dpDestTag && { destination_tag: dpDestTag }),
            // Mark as direct-pay-created so addPayment can enrich with exact crypto amounts
            direct_pay_origin: "createPaymentLink",
          });
          cronLogger.info(`[createPaymentLink] ✅ Set ${directPayCryptoRedisKey} Redis key for Direct Pay webhook processing`);

          cronLogger.info(`[createPaymentLink] Direct Pay address reserved: ${directPayAddress} (temp_id: ${directPayTempId})`);
        }
      } catch (poolError) {
        cronLogger.warn(`[createPaymentLink] Failed to reserve pool address for Direct Pay: ${(poolError as Error).message}`);
        // Don't fail the link creation — Direct Pay is optional
      }
    }
    // ========================================
    // END DIRECT PAY
    // ========================================

    // Format response to be consistent with getPaymentLinkById
    const amountDisplay = formatAmountForDisplay(normalizedAmount, normalizedCurrency);
    const currencyInfo = getCurrencyInfo(normalizedCurrency);
    
    const responseData = {
      ...links.dataValues,
      // Formatted amount display
      amount_display: amountDisplay,
      currency_info: currencyInfo,
      display_value: amountDisplay.display_value, // e.g., "$123.00 USD"
      accepted_currencies: links.dataValues.accepted_currencies 
        ? links.dataValues.accepted_currencies.split(',').map((c: string) => c.trim())
        : null,  // null means all configured currencies are accepted
      // Include KYC warning if within grace period (for in-app display)
      ...(kycWarning && { kyc_warning: kycWarning }),
      // Direct Pay pool address (when single crypto selected)
      ...(directPayAddress && {
        direct_pay_address: directPayAddress,
        direct_pay_qr_code: directPayQrCode,
        direct_pay_temp_id: directPayTempId,
      }),
    };

    successResponseHelper(res, 200, "Payment link created successfully", responseData);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { id: userData.id, email: userData.email });
  }
};

export const getPaymentLinks = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  try {
    const { company_id, page, limit, paginated } = req.query;  // Added pagination params
    
    cronLogger.info(`[getPaymentLinks] user_id=${userData.user_id}, company_id=${company_id || 'all'}`);
    
    // Build where clause with optional company_id filter
    const whereClause: Record<string, unknown> = {
      user_id: userData.user_id,
    };
    
    if (company_id) {
      whereClause.company_id = parseInt(company_id as string);
    }
    
    // Check if pagination is requested (backward compatibility)
    const usePagination = paginated === 'true' || page !== undefined || limit !== undefined;
    
    // Get total count for pagination
    const totalCount = await paymentLinkModel.count({ where: whereClause });
    
    // Calculate pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;
    
    const links = await paymentLinkModel.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      ...(usePagination && { limit: limitNum, offset: offset }),
    });

    // Define interface for payment link data
    interface PaymentLinkData {
      link_id: number;
      transaction_id: string;
      description?: string;
      base_amount: number;
      base_currency: string;
      createdAt: Date | string;
      expires_at?: Date | string;
      status?: string;
      times_used?: number;
      payment_link: string;
      email?: string;
      allowedModes?: string;
      company_id?: number;
      callback_url?: string;
      redirect_url?: string;
      webhook_url?: string;
      fee_payer?: string;
    }

    // Format for UI with computed status
    const formattedLinks = (links as Array<{ dataValues: PaymentLinkData }>).map((link) => {
      const linkData = link.dataValues;
      const now = new Date();
      
      // Calculate status (normalized to lowercase for frontend consistency)
      let status = "active";
      
      // Check if link is still in draft/pending state (no payment_link URL yet or amount is 0)
      const rawDbStatus = (linkData.status || "pending").toLowerCase().trim();
      if (rawDbStatus === "pending" && (!linkData.base_amount || Number(linkData.base_amount) === 0)) {
        status = "pending";
      }
      
      // Expired overrides pending/active
      if (linkData.expires_at && new Date(linkData.expires_at as string) <= now) {
        status = "expired";
      }
      
      // Completed overrides everything except expired
      if (parseState(linkData.status) === PaymentState.PAYOUT_COMPLETE) {
        status = "completed";
      }

      // Format dates
      const formatDate = (date: Date | string | undefined | null): string => {
        if (!date) return "Never";
        const d = new Date(date);
        return d.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(',', '');
      };

      // Use centralized currency formatting
      const currency = linkData.base_currency || 'USD';
      const amountDisplay = formatAmountForDisplay(Number(linkData.base_amount), currency);
      const currencyInfo = getCurrencyInfo(currency);

      return {
        link_id: linkData.link_id,
        transaction_id: linkData.transaction_id,
        description: linkData.description || "No description",
        display_value: amountDisplay.display_value, // e.g., "$123.00 USD"
        amount_display: amountDisplay,
        currency_info: currencyInfo,
        base_amount: linkData.base_amount,
        base_currency: linkData.base_currency,
        created: formatDate(linkData.createdAt),
        expires: formatDate(linkData.expires_at),
        status: status,
        times_used: linkData.times_used || 0,
        payment_link: linkData.payment_link,
        email: linkData.email,
        allowedModes: linkData.allowedModes,
        callback_url: linkData.callback_url,
        redirect_url: linkData.redirect_url,
        webhook_url: linkData.webhook_url,
        fee_payer: linkData.fee_payer || 'company',  // Who pays blockchain fees
        company_id: linkData.company_id,  // Phase 10 Fix: Include company_id in response
      };
    });

    // Return with pagination info only if pagination was requested
    // Otherwise return array directly for backward compatibility
    if (usePagination) {
      successResponseHelper(res, 200, "Payment links retrieved successfully", {
        links: formattedLinks,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
        }
      });
    } else {
      // Backward compatible: return array directly
      successResponseHelper(res, 200, "Links Fetched Successfully!", formattedLinks);
    }
  } catch (e) {

      handleControllerError(res, e, apiLogger, { id: userData.id, email: userData.email });
  }
};

/**
 * Get single payment link by ID
 * GET /api/pay/links/:id
 */
export const getPaymentLinkById = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  const link_id = req.params.id;
  
  try {
    const link = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    if (!link) {
      return errorResponseHelper(res, 404, "Payment link not found!");
    }

    const linkData = link.dataValues;
    const now = new Date();
    
    // Calculate status (normalized to lowercase for frontend consistency)
    let status = "active";
    
    // Check if link is still in draft/pending state
    const rawDbStatus = (linkData.status || "pending").toLowerCase().trim();
    if (rawDbStatus === "pending" && (!linkData.base_amount || Number(linkData.base_amount) === 0)) {
      status = "pending";
    }
    
    // Expired overrides pending/active
    if (linkData.expires_at && new Date(linkData.expires_at) <= now) {
      status = "expired";
    }
    // Completed overrides everything except expired
    if (parseState(linkData.status) === PaymentState.PAYOUT_COMPLETE) {
      status = "completed";
    }

    // Format dates
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(',', '');
    };

    const response = {
      link_id: linkData.link_id,
      transaction_id: linkData.transaction_id,
      description: linkData.description,
      base_amount: linkData.base_amount,
      base_currency: linkData.base_currency,
      paid_amount: linkData.paid_amount,
      paid_currency: linkData.paid_currency,
      created: formatDate(linkData.createdAt),
      updated: formatDate(linkData.updatedAt),
      expires_at: linkData.expires_at,
      expires: formatDate(linkData.expires_at) || "Never",
      status: status,
      times_used: linkData.times_used || 0,
      payment_link: linkData.payment_link,
      email: linkData.email,
      allowedModes: linkData.allowedModes,
      payment_mode: linkData.payment_mode,
      transaction_reference: linkData.transaction_reference,
      callback_url: linkData.callback_url,
      redirect_url: linkData.redirect_url,
      webhook_url: linkData.webhook_url,
      company_id: linkData.company_id,  // Phase 10 Fix: Include company_id in response
      fee_payer: linkData.fee_payer || 'company',
      apply_tax: linkData.apply_tax || false,
      accepted_currencies: linkData.accepted_currencies 
        ? linkData.accepted_currencies.split(',').map((c: string) => c.trim())
        : null,  // null means all configured currencies are accepted
    };

    successResponseHelper(res, 200, "Payment link retrieved successfully", response);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { id: userData.id, email: userData.email });
  }
};

/**
 * Update payment link
 * PUT /api/pay/links/:id
 */
export const updatePaymentLink = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  const link_id = req.params.id;
  const { 
    description, 
    expire,
    email,
    base_amount,
    base_currency,
    allowedModes,
    fee_payer,
    apply_tax,
    accepted_currencies,  // Array of crypto types to accept
    callback_url, 
    redirect_url, 
    webhook_url,
    name,                 // Customer name
  } = req.body;
  
  try {
    // First check if link exists and belongs to user
    const existingLink = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    if (!existingLink) {
      return errorResponseHelper(res, 404, "Payment link not found!");
    }

    // Check if link is already completed - don't allow updates
    if (existingLink.dataValues.status === 'completed') {
      return errorResponseHelper(res, 400, "Cannot update a completed payment link");
    }

    // Prepare update object
    const updateData: Record<string, unknown> = {};
    
    // For accepted_currencies validation, we need to fetch configured wallets
    const cryptoTypes = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    let allConfiguredCurrencies: string[] = [];
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    if (email !== undefined) {
      updateData.email = email;
    }
    
    if (base_amount !== undefined) {
      const amount = Number(base_amount);
      if (isNaN(amount) || amount <= 0) {
        return errorResponseHelper(res, 400, "Invalid amount. Must be a positive number.");
      }
      updateData.base_amount = amount;
    }
    
    if (base_currency !== undefined) {
      const validCurrencies = [
        // Major International
        'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'HKD', 'NZD', 'SGD',
        // Latin America (high crypto adoption)
        'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES', 'UYU',
        // African (high crypto adoption)
        'NGN', 'ZAR', 'KES', 'GHS', 'TZS', 'XAF', 'XOF', 'EGP', 'MAD',
        'UGX', 'RWF', 'ETB', 'ZMW', 'BWP', 'MUR', 'AOA', 'MZN', 'CDF'
      ];
      if (!validCurrencies.includes(base_currency.toUpperCase())) {
        return errorResponseHelper(res, 400, `Invalid currency. Valid options: ${validCurrencies.join(', ')}`);
      }
      updateData.base_currency = base_currency.toUpperCase();
    }
    
    if (allowedModes !== undefined) {
      // Can be array or comma-separated string
      let modes = allowedModes;
      if (Array.isArray(allowedModes)) {
        modes = allowedModes.join(',');
      }
      const validModes = ['CRYPTO', 'CARD', 'BANK'];
      const providedModes = modes.split(',').map((m: string) => m.trim().toUpperCase());
      const invalidModes = providedModes.filter((m: string) => !validModes.includes(m));
      if (invalidModes.length > 0) {
        return errorResponseHelper(res, 400, `Invalid payment modes: ${invalidModes.join(', ')}. Valid options: ${validModes.join(', ')}`);
      }
      updateData.allowedModes = providedModes.join(',');
    }
    
    if (fee_payer !== undefined) {
      const validFeePayers = ['customer', 'company'];
      if (!validFeePayers.includes(fee_payer.toLowerCase())) {
        return errorResponseHelper(res, 400, "Invalid fee_payer. Must be 'customer' or 'company'.");
      }
      updateData.fee_payer = fee_payer.toLowerCase();
    }
    
    if (apply_tax !== undefined) {
      updateData.apply_tax = Boolean(apply_tax);
    }
    
    // Handle accepted_currencies update
    if (accepted_currencies !== undefined) {
      if (accepted_currencies === null || (Array.isArray(accepted_currencies) && accepted_currencies.length === 0)) {
        // Clear selection - use all configured wallets
        updateData.accepted_currencies = null;
      } else if (Array.isArray(accepted_currencies)) {
        // Fetch configured wallets to validate
        const company_id = existingLink.dataValues.company_id;
        const walletWhereClause: Record<string, unknown> = {
          user_id: userData.user_id,
          wallet_type: { [Op.in]: cryptoTypes },
          wallet_address: { [Op.not]: null },
        };
        if (company_id) {
          walletWhereClause.company_id = company_id;
        }
        
        const configuredWallets = await userWalletModel.findAll({
          where: walletWhereClause,
          attributes: ['wallet_type'],
        });
        
        allConfiguredCurrencies = [...new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];
        
        // Normalize to uppercase
        const requestedCurrencies = accepted_currencies.map((c: string) => c.toUpperCase().trim());
        
        // Validate all requested currencies are valid crypto types
        const invalidCryptos = requestedCurrencies.filter((c: string) => !cryptoTypes.includes(c));
        if (invalidCryptos.length > 0) {
          return errorResponseHelper(
            res,
            400,
            `Invalid cryptocurrency types: ${invalidCryptos.join(', ')}. Valid options: ${cryptoTypes.join(', ')}`
          );
        }
        
        // Validate all requested currencies have configured wallets
        const unconfiguredCurrencies = requestedCurrencies.filter((c: string) => !allConfiguredCurrencies.includes(c));
        if (unconfiguredCurrencies.length > 0) {
          return errorResponseHelper(
            res,
            400,
            `No wallet configured for: ${unconfiguredCurrencies.join(', ')}. Please configure wallets first or select from available: ${allConfiguredCurrencies.join(', ')}`
          );
        }
        
        updateData.accepted_currencies = requestedCurrencies.join(',');
        cronLogger.info(`[updatePaymentLink] Updated accepted currencies: ${updateData.accepted_currencies}`);
      }
    }
    
    if (expire !== undefined) {
      // Calculate new expires_at
      if (expire === "No" || expire === null || expire === "") {
        updateData.expires_at = null;
      } else {
        const now = new Date();
        if (expire === "24h") {
          updateData.expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        } else if (expire === "7d") {
          updateData.expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (expire === "30d") {
          updateData.expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
          return errorResponseHelper(res, 400, "Invalid expire value. Valid options: '24h', '7d', '30d', 'No', or null");
        }
      }
    }
    
    if (callback_url !== undefined) {
      updateData.callback_url = callback_url || null;
    }
    
    if (redirect_url !== undefined) {
      updateData.redirect_url = redirect_url || null;
    }
    
    if (webhook_url !== undefined) {
      updateData.webhook_url = webhook_url || null;
    }

    if (name !== undefined) {
      updateData.customer_name = name || null;
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No valid fields provided for update");
    }

    // Update the link in database
    await paymentLinkModel.update(updateData, {
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    // Fetch updated link
    const updatedLink = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    // CRITICAL: Also update Redis so checkout page and payment processing get new data
    if (updatedLink) {
      const linkData = updatedLink.dataValues;
      
      // Extract the uniqueRef from payment_link URL (the 'd' parameter)
      const paymentLinkUrl = linkData.payment_link;
      const urlMatch = paymentLinkUrl?.match(/[?&]d=([a-f0-9]+)/i);
      const uniqueRef = urlMatch ? urlMatch[1] : null;
      
      if (uniqueRef) {
        // Get existing Redis data to preserve fields not in database
        const existingRedisData = await getRedisItem("customer-" + uniqueRef);
        
        let updatedRedisPayload: Record<string, unknown>;
        
        if (existingRedisData && Object.keys(existingRedisData).length > 0) {
          // Calculate new available_currencies based on accepted_currencies
          let newAvailableCurrencies = existingRedisData.available_currencies || existingRedisData.all_configured_currencies || [];
          
          if (linkData.accepted_currencies) {
            // Use merchant's selection
            newAvailableCurrencies = linkData.accepted_currencies.split(',').map((c: string) => c.trim());
          } else if (existingRedisData.all_configured_currencies) {
            // No selection, use all configured
            newAvailableCurrencies = existingRedisData.all_configured_currencies;
          }
          
          // Merge updated fields with existing Redis data
          updatedRedisPayload = {
            ...existingRedisData,
            // Update all fields that could have changed
            email: linkData.email,
            base_amount: linkData.base_amount,
            amount: linkData.base_amount,  // FIX: Sync 'amount' alongside 'base_amount' for code paths that read 'amount'
            base_currency: linkData.base_currency,
            description: linkData.description,
            expires_at: linkData.expires_at,
            callback_url: linkData.callback_url,
            redirect_url: linkData.redirect_url,
            webhook_url: linkData.webhook_url,
            fee_payer: linkData.fee_payer,
            apply_tax: linkData.apply_tax,
            allowedModes: linkData.allowedModes,
            accepted_currencies: linkData.accepted_currencies,
            available_currencies: newAvailableCurrencies,
            customer_name: linkData.customer_name,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // FIX: Redis key expired/evicted — reconstruct from DB to keep payment link functional
          cronLogger.warn(`[updatePaymentLink] Redis key customer-${uniqueRef} missing, reconstructing from DB`);
          
          // Fetch configured wallets for available_currencies
          const company_id = linkData.company_id;
          const walletWhereClause: Record<string, unknown> = {
            user_id: userData.user_id,
            wallet_type: { [Op.in]: cryptoTypes },
            wallet_address: { [Op.not]: null },
          };
          if (company_id) {
            walletWhereClause.company_id = company_id;
          }
          const configuredWallets = await userWalletModel.findAll({
            where: walletWhereClause,
            attributes: ['wallet_type'],
          });
          const reconstructedCurrencies = [...new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];
          
          let availableCurrencies = reconstructedCurrencies;
          if (linkData.accepted_currencies) {
            availableCurrencies = linkData.accepted_currencies.split(',').map((c: string) => c.trim());
          }
          
          updatedRedisPayload = {
            transaction_id: linkData.transaction_id,
            email: linkData.email,
            allowedModes: linkData.allowedModes,
            base_amount: linkData.base_amount,
            amount: linkData.base_amount,
            base_currency: linkData.base_currency,
            user_id: linkData.user_id,
            adm_id: linkData.user_id,
            company_id: company_id,
            payment_link: linkData.payment_link,
            description: linkData.description,
            expires_at: linkData.expires_at,
            callback_url: linkData.callback_url,
            redirect_url: linkData.redirect_url,
            webhook_url: linkData.webhook_url,
            fee_payer: linkData.fee_payer || 'company',
            apply_tax: linkData.apply_tax || false,
            accepted_currencies: linkData.accepted_currencies,
            customer_name: linkData.customer_name,
            pathType: "createLink",
            link_id: linkData.link_id,
            available_currencies: availableCurrencies,
            all_configured_currencies: reconstructedCurrencies,
            createdAt: linkData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reconstructed: true,  // Flag so we know this was rebuilt
          };
          cronLogger.info(`[updatePaymentLink] Reconstructed Redis payload for customer-${uniqueRef}`);
        }
        
        await setRedisItem("customer-" + uniqueRef, updatedRedisPayload);
        cronLogger.info(`[updatePaymentLink] Redis updated for key: customer-${uniqueRef}`);
        
        // FIX: If an active crypto address exists, update crypto-{address} Redis key too
        // This handles the edge case where merchant updates webhook_url/amount AFTER
        // a customer has initiated payment but BEFORE it's confirmed
        const activeAddress = updatedRedisPayload.active_crypto_address as { address?: string; destination_tag?: number | null } | undefined;
        if (activeAddress?.address) {
          const activeDestTag = activeAddress.destination_tag ? Number(activeAddress.destination_tag) : null;
          const activeCryptoKey = getCryptoRedisKey(activeAddress.address, activeDestTag);
          const cryptoRedisData = await getRedisItem(activeCryptoKey);
          if (cryptoRedisData && parseState(cryptoRedisData.status) === PaymentState.PENDING) {
            const cryptoUpdates: Record<string, unknown> = {};
            
            if (updateData.webhook_url !== undefined) {
              cryptoUpdates.webhook_url = linkData.webhook_url;
            }
            if (updateData.callback_url !== undefined) {
              cryptoUpdates.callback_url = linkData.callback_url;
            }
            
            if (Object.keys(cryptoUpdates).length > 0) {
              await setRedisItem(activeCryptoKey, {
                ...cryptoRedisData,
                ...cryptoUpdates,
              });
              cronLogger.info(`[updatePaymentLink] Also updated ${activeCryptoKey} with: ${Object.keys(cryptoUpdates).join(', ')}`);
            }
          }
        }
      } else {
        cronLogger.warn(`[updatePaymentLink] Could not extract uniqueRef from payment_link: ${paymentLinkUrl}`);
      }
    }

    // Format response to be consistent - accepted_currencies as array
    const responseData = {
      ...updatedLink.dataValues,
      accepted_currencies: updatedLink.dataValues.accepted_currencies 
        ? updatedLink.dataValues.accepted_currencies.split(',').map((c: string) => c.trim())
        : null,
    };

    successResponseHelper(res, 200, "Payment link updated successfully", responseData);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { id: userData.id, email: userData.email });
  }
};

export const deletePaymentLink = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  const link_id = req.params.id;
  try {
    // First get the payment link to extract uniqueRef for Redis deletion
    const linkToDelete = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });
    
    if (!linkToDelete) {
      return errorResponseHelper(res, 404, "Link not found!");
    }
    
    // Extract uniqueRef from payment_link URL
    const paymentLinkUrl = linkToDelete.dataValues.payment_link;
    const urlMatch = paymentLinkUrl?.match(/[?&]d=([a-f0-9]+)/i);
    const uniqueRef = urlMatch ? urlMatch[1] : null;
    
    // Delete from database
    const links = await paymentLinkModel.destroy({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    // Also delete from Redis to prevent checkout access
    if (uniqueRef) {
      await deleteRedisItem("customer-" + uniqueRef);
      cronLogger.info(`[deletePaymentLink] Redis deleted for key: customer-${uniqueRef}`);
    }

    successResponseHelper(res, 200, "Payment link deleted successfully", links);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { id: userData.id, email: userData.email });
  }
};
