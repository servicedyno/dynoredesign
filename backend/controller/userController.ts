import express from "express";
import {
  downloadUserImage,
  errorResponseHelper,
  getErrorMessage,
  getMinutesBetweenDates,
  sendEmail,
  successResponseHelper,
} from "../helper/index";
import { handleControllerError } from "../helper/controllerErrorHandler";
import emailService from "../services/emailService";
import { adminWalletModel, userModel, userWalletModel, companyModel, apiModel } from "../models";
import { userWalletAddressModel } from "../models/userModels";
import notificationModel from "../models/notificationModel";
import notificationPreferencesModel from "../models/notificationPreferencesModel";
import kycModel from "../models/kycModel";
import sha256 from "crypto-js/sha256";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../helper/passwordHelper";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import { QueryTypes, Op } from "sequelize";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
// OTP storage moved to Redis - localStorage import removed
import axios from "axios";
// tatumApi import removed - not used in this controller
import { userLogger } from "../utils/loggers";
import { getRedisItem, setRedisItem, setRedisTTL, deleteRedisItem } from "../utils/redisInstance";
import { isAccountLocked, recordFailedAttempt, clearFailedAttempts } from "../services/accountLockoutService";
import { createSession } from "../services/sessionService";
import { is2FARequired } from "../services/twoFactorService";

// Cache TTL for profile data (60 seconds)
const PROFILE_CACHE_TTL = 60;

const registerUser = async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, password, referral_code } = req.body;
    
    // Validate password strength
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return errorResponseHelper(res, 400, passwordError);
    }
    
    const newPassword = hashPassword(password);
    const isExists = await userModel
      .findOne({
        where: {
          email: email.toLowerCase(),
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);

    userLogger.info("isExists====>", isExists);
    if (isExists) {
      errorResponseHelper(res, 503, "Account Already Exists!!!");
    } else {
      const photoLocation = await downloadUserImage();
      const photo = process.env.SERVER_URL + photoLocation;

      // Generate unique referral code for new user
      const generateReferralCode = () => {
        // Short 8-char format: DYNO + 6 alphanumeric chars (e.g., DYNO-A3X9K2)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
        let code = '';
        const bytes = crypto.randomBytes(6);
        for (let i = 0; i < 6; i++) {
          code += chars[bytes[i] % chars.length];
        }
        return `DYNO-${code}`;
      };

      const userReferralCode = generateReferralCode();

      const createdUser = await userModel.create({
        name,
        email: email.toLowerCase(),
        photo,
        password: newPassword,
        referral_code: userReferralCode,
        referred_by_code: referral_code || null,
      });

      const walletData = await adminWalletModel.findAll();
      const fiatData = walletData.filter(
        (x) => x.dataValues.currency_type === "FIAT"
      );
      const cryptoData = walletData.filter(
        (x) => x.dataValues.currency_type === "CRYPTO"
      );

      for (let i = 0; i < fiatData.length; i++) {
        await userWalletModel.create({
          id: crypto.randomUUID(),
          user_id: createdUser.dataValues.user_id,
          wallet_type: fiatData[i].dataValues.wallet_type,
          currency_type: "FIAT",
        });
      }

      for (let i = 0; i < cryptoData.length; i++) {
        await userWalletModel.create({
          id: crypto.randomUUID(),
          user_id: createdUser.dataValues.user_id,
          wallet_type: cryptoData[i].dataValues.wallet_type,
          currency_type: "CRYPTO",
        });
      }

      // If user was referred, create referral record
      if (referral_code) {
        try {
          const referrer = await userModel.findOne({ where: { referral_code } });
          if (referrer) {
            // Import Referral model at the top if not already imported
            const Referral = require('../models/referralModels/referralModel').default;
            await Referral.create({
              referrer_user_id: referrer.dataValues.user_id,
              referred_user_id: createdUser.dataValues.user_id,
              referral_code,
              status: 'pending',
              activation_requirement: 'first_transaction_100',
              bonus_amount: 10.00,
              bonus_currency: 'USD',
              referee_discount_percent: 50.00,
              referee_discount_duration_days: 30,
              referred_at: new Date(),
              expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
            });
          }
        } catch (refError) {
          // Log error but don't fail registration
          userLogger.error("Error creating referral record:", refError);
        }
      }

      // Welcome email is deferred until after OTP verification (see verifyEmail)

      // Generate email verification OTP and send it
      const verifyOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const verifyKey = `email-verify:${createdUser.dataValues.user_id}`;
      await setRedisItem(verifyKey, { otp: verifyOtp, createdAt: new Date().toISOString() });
      await setRedisTTL(verifyKey, 600); // 10 minutes
      emailService.sendEmailVerificationOTPEmail(email.toLowerCase(), name, verifyOtp).catch(err => {
        userLogger.error("Failed to send email verification OTP:", err);
      });

      const resData = await getAccessToken(createdUser.dataValues.user_id);

      successResponseHelper(res, 200, "Registered Successful! Please verify your email.", {
        ...resData,
        email_verified: false,
        referral_code: userReferralCode,
        referred_by: referral_code || null,
      });
    }
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Register User with Phone Number (Step 1: Send OTP)
 * POST /api/user/registerPhone
 * Sends OTP to phone for verification
 */
const registerPhoneStep1 = async (req: express.Request, res: express.Response) => {
  try {
    const { name, password } = req.body;
    let { mobile } = req.body;
    
    if (!name || !mobile || !password) {
      return errorResponseHelper(res, 400, "Name, mobile number, and password are required");
    }
    
    // Strip + prefix if present (Telnyx expects digits only, we add + when calling API)
    mobile = mobile.replace(/^\+/, '').replace(/\s/g, '').replace(/-/g, '');
    
    // Validate mobile format (digits only, 10-15 chars)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(mobile)) {
      return errorResponseHelper(res, 400, "Invalid mobile number format. Use 10-15 digits with country code (e.g. 13025141000)");
    }
    
    // Check if mobile already registered
    const mobileExists = await userModel.findOne({
      where: { mobile }
    });
    
    if (mobileExists) {
      return errorResponseHelper(res, 400, "Mobile number already registered");
    }
    
    // Send OTP via Telnyx (with retry logic)
    const smsSent = await sendTelnyxSMS(mobile);
    if (smsSent) {
      return successResponseHelper(res, 200, "OTP sent to your mobile number. Please verify to complete registration.");
    }
    return errorResponseHelper(res, 503, "Failed to send OTP. Please try again shortly.");
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Register User with Phone Number (Step 2: Verify OTP & Create Account)
 * POST /api/user/registerPhone/verify
 * Verifies OTP and creates user account
 */
const registerPhoneStep2 = async (req: express.Request, res: express.Response) => {
  try {
    const { name, password, otp } = req.body;
    let { mobile } = req.body;
    
    if (!name || !mobile || !password || !otp) {
      return errorResponseHelper(res, 400, "All fields are required: name, mobile number, password, otp");
    }
    
    // Strip + prefix if present
    mobile = mobile.replace(/^\+/, '').replace(/\s/g, '').replace(/-/g, '');
    
    // Verify OTP with Telnyx
    try {
      const verifyResponse = await axios.post(
        `https://api.telnyx.com/v2/verifications/by_phone_number/+${mobile}/actions/verify`,
        {
          code: otp,
          verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID,
        },
        {
          headers: {
            Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
          },
        }
      );
      
      // Check if verification was successful
      if (verifyResponse.data?.data?.response_code !== "accepted") {
        return errorResponseHelper(res, 400, "Invalid or expired OTP");
      }
      
    } catch (otpError) {
      userLogger.error("OTP verification failed", otpError);
      return errorResponseHelper(res, 400, "Invalid or expired OTP");
    }
    
    // OTP verified, now create user account
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return errorResponseHelper(res, 400, passwordError);
    }
    const newPassword = hashPassword(password);
    
    // Double-check mobile doesn't exist
    const mobileExists = await userModel.findOne({
      where: { mobile }
    });
    
    if (mobileExists) {
      return errorResponseHelper(res, 400, "Mobile number already registered");
    }
    
    // Download default user image
    const photoLocation = await downloadUserImage();
    const photo = process.env.SERVER_URL + photoLocation;
    
    // Create user with mobile as primary identifier
    const createdUser = await userModel.create({
      name,
      mobile,
      email: null, // Email is optional for phone registration
      photo,
      password: newPassword,
      login_type: "SMS", // Mark as SMS-based login
    });
    
    // Create wallets for the new user
    const walletData = await adminWalletModel.findAll();
    const fiatData = walletData.filter(
      (x) => x.dataValues.currency_type === "FIAT"
    );
    const cryptoData = walletData.filter(
      (x) => x.dataValues.currency_type === "CRYPTO"
    );
    
    for (let i = 0; i < fiatData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: fiatData[i].dataValues.wallet_type,
        currency_type: "FIAT",
      });
    }
    
    for (let i = 0; i < cryptoData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: cryptoData[i].dataValues.wallet_type,
        currency_type: "CRYPTO",
      });
    }
    
    // Generate access token
    const resData = await getAccessToken(createdUser.dataValues.user_id);
    
    userLogger.info(`New user registered via phone: ${mobile}`);
    
    successResponseHelper(res, 200, "Registration successful!", resData);
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

const login = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return errorResponseHelper(res, 400, "Email and password are required");
    }
    
    // ── Account Lockout Check ──────────────────────────────────────────────────
    const lockoutStatus = await isAccountLocked(email);
    if (lockoutStatus.locked) {
      const minutes = Math.ceil(lockoutStatus.remaining_seconds / 60);
      return errorResponseHelper(res, 429, `Account temporarily locked due to too many failed attempts. Try again in ${minutes} minutes.`);
    }
    
    const newPassword_unused = null; // Legacy sha256 removed — bcrypt used via verifyPassword
    
    // Step 1: Find user by email only (bcrypt hashes can't be queried directly)
    const userData = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
      },
    });
    
    // Step 2: Verify password using bcrypt (with transparent SHA-256 migration)
    const isPasswordValid = userData
      ? await verifyPassword(password, userData.dataValues.password, userData.dataValues.user_id)
      : false;
    
    if (!userData || !isPasswordValid) {
      // ── Record failed attempt & check lockout ─────────────────────────────
      const rawIp = req.headers['x-forwarded-for'] as string || req.ip || 'Unknown';
      const ipAddress = rawIp.split(',')[0].trim().substring(0, 45);
      
      const lockoutResult = await recordFailedAttempt(email, ipAddress);
      
      // Send alert email after 3 failed attempts (existing behavior)
      try {
        const cacheKey = `failed_logins:${email.toLowerCase()}`;
        const failedAttempts = await getRedisItem(cacheKey);
        let attemptCount = 1;
        if (failedAttempts !== null && failedAttempts !== undefined) {
          if (typeof failedAttempts === 'number') {
            attemptCount = failedAttempts + 1;
          } else if (typeof failedAttempts === 'string') {
            const parsed = parseInt(failedAttempts, 10);
            attemptCount = isNaN(parsed) ? 1 : parsed + 1;
          } else if (typeof failedAttempts === 'object') {
            const val = (failedAttempts as Record<string, unknown>).value || (failedAttempts as Record<string, unknown>).count;
            if (typeof val === 'number') {
              attemptCount = val + 1;
            } else if (typeof val === 'string') {
              const parsed = parseInt(val, 10);
              attemptCount = isNaN(parsed) ? 1 : parsed + 1;
            }
          }
        }
        await setRedisItem(cacheKey, attemptCount);
        await setRedisTTL(cacheKey, 3600);
        
        if (attemptCount >= 3) {
          const existingUser = await userModel.findOne({ where: { email: email.toLowerCase() } });
          if (existingUser) {
            const { sendFailedLoginAttemptsEmail } = await import("../services/emailService");
            const now = new Date();
            const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            await sendFailedLoginAttemptsEmail(
              existingUser.dataValues.email,
              existingUser.dataValues.name || 'User',
              attemptCount,
              ipAddress,
              date,
              time
            );
            userLogger.info(`[Login] Failed login alert sent to ${email} - ${attemptCount} attempts from ${ipAddress}`);
          }
        }
      } catch (redisError) {
        userLogger.error("[Login] Redis error tracking failed attempts:", redisError);
      }
      
      // Return lockout warning if close to limit
      if (lockoutResult.locked) {
        return errorResponseHelper(res, 429, `Account locked for ${lockoutResult.lockout_minutes} minutes after ${lockoutResult.attempts} failed attempts.`);
      }
      
      const remainingAttempts = lockoutResult.max_attempts - lockoutResult.attempts;
      if (remainingAttempts <= 2 && remainingAttempts > 0) {
        return errorResponseHelper(res, 401, `Invalid email or password. ${remainingAttempts} attempt(s) remaining before account lockout.`);
      }
      
      return errorResponseHelper(res, 401, "Invalid email or password");
    } else {
      // ── Successful Login ──────────────────────────────────────────────────
      // Clear lockout and failed attempts
      await clearFailedAttempts(email);
      const cacheKey = `failed_logins:${email.toLowerCase()}`;
      await deleteRedisItem(cacheKey);
      
      // Check if 2FA is required
      const needs2FA = await is2FARequired(userData.dataValues.user_id);
      if (needs2FA) {
        // Return partial response — client must complete 2FA
        return successResponseHelper(res, 200, "2FA verification required", {
          requires_2fa: true,
          user_id: userData.dataValues.user_id,
          message: "Please provide your 2FA code to complete login.",
        });
      }
      
      // Check for new device/IP login
      const rawIp = req.headers['x-forwarded-for'] as string || req.ip || 'Unknown';
      const ipAddress = rawIp.split(',')[0].trim().substring(0, 45);
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const lastLoginIp = userData.dataValues.last_login_ip;
      
      userLogger.info(`[Login] User ${email} - Current IP: ${ipAddress}, Last IP: ${lastLoginIp || 'none'}`);
      
      // Send new device alert if IP changed (and not first login)
      const alertCacheKey = `new_device_alert:${userData.dataValues.user_id}:${ipAddress}`;
      const alertCacheValue = await getRedisItem(alertCacheKey);
      const alertAlreadySent = alertCacheValue && Object.keys(alertCacheValue).length > 0;
      
      userLogger.info(`[Login] Alert check - lastLoginIp: ${!!lastLoginIp}, ipChanged: ${lastLoginIp !== ipAddress}, alertAlreadySent: ${alertAlreadySent}`);
      
      if (lastLoginIp && lastLoginIp !== ipAddress && !alertAlreadySent) {
        try {
          await setRedisItem(alertCacheKey, 'sent');
          await setRedisTTL(alertCacheKey, 300);
          
          let location: string | null = null;
          try {
            const axios = (await import("axios")).default;
            const geoResponse = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=status,city,country`, { timeout: 3000 });
            if (geoResponse.data && geoResponse.data.status === 'success') {
              const { city, country } = geoResponse.data;
              location = city && country ? `${city}, ${country}` : (country || null);
            }
          } catch (geoError) {
            userLogger.info(`[Login] IP geolocation failed for ${ipAddress}:`, geoError.message);
          }
          
          const { sendNewDeviceLoginEmail } = await import("../services/emailService");
          const now = new Date();
          const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
          const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          await sendNewDeviceLoginEmail(
            userData.dataValues.email,
            userData.dataValues.name || 'User',
            ipAddress,
            userAgent,
            location,
            date,
            time
          );
          userLogger.info(`[Login] New device alert sent to ${email} - IP changed from ${lastLoginIp} to ${ipAddress} (${location || 'Unknown location'})`);
        } catch (emailError) {
          userLogger.error("[Login] Failed to send new device alert:", emailError);
        }
      }
      
      // Update last login IP
      await userModel.update(
        { last_login_ip: ipAddress },
        { where: { user_id: userData.dataValues.user_id } }
      );
      
      // ── Create Session with Refresh Token ──────────────────────────────────
      const sessionData = await createSession(userData.dataValues, req as any);
      
      // Build response (backward compatible + new fields)
      const { password: _pw, telegram_id: _tid, ...userDataClean } = userData.dataValues;
      const resData = {
        userData: userDataClean,
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        expiresIn: sessionData.expiresIn,
        session_id: sessionData.session_id,
        token_type: "Bearer",
      };
      
      successResponseHelper(res, 200, "Login Successful!", resData);
    }
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

const checkEmail = async (req: express.Request, res: express.Response) => {
  try {
    const { email } = req.query as { email?: string };
    const userData = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
      },
    });

    let resData: Record<string, unknown> = { validEmail: false };
    if (userData) {
      resData = {
        validEmail: true,
        email: userData.dataValues.email,
        mobile: userData.dataValues.mobile ? userData.dataValues.mobile : null,
      };
    }
    successResponseHelper(res, 200, "User profile retrieved successfully", resData);
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

const getAccessToken = async (id: number) => {
  const users: IUserType[] = await sequelize.query(
    "select * from tbl_user where user_id=" + id,
    {
      type: QueryTypes.SELECT,
    }
  );

  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;

  const { password, telegram_id, ...userData } = users[0];

  if (tokenSecret) {
    const accessToken = jwt.sign(userData, tokenSecret, {
      expiresIn: "365d",
    });
    const resData = { userData, accessToken };
    return resData;
  }
};

/**
 * Helper: Send OTP via email and store in Redis.
 * Returns true on success, false on failure.
 */
const sendEmailOTP = async (email: string, name: string): Promise<boolean> => {
  try {
    const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
    await sendEmail(
      email,
      name,
      "OTP for login",
      "Here is your login code: " + randomNumberOTP
    );
    // Store OTP in Redis with 10-minute TTL
    const otpKey = `otp:${email}`;
    await setRedisItem(otpKey, {
      otp: randomNumberOTP.toString(),
      createdAt: new Date().toISOString(),
    });
    await setRedisTTL(otpKey, 600); // 10 minutes TTL
    return true;
  } catch (err) {
    userLogger.error("[generateOTP] Email OTP send failed", { email, error: (err as Error).message });
    return false;
  }
};

/**
 * Helper: Send OTP via Telnyx SMS with retry.
 * Retries once after 1s delay on 401/5xx errors.
 * Returns true on success, false on failure.
 */
const sendTelnyxSMS = async (mobile: string, maxRetries: number = 1): Promise<boolean> => {
  const telnyxApiKey = process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN;
  const verifyProfileId = process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await axios.post(
        "https://api.telnyx.com/v2/verifications/sms",
        {
          phone_number: "+" + mobile,
          verify_profile_id: verifyProfileId,
          timeout_secs: 600,
        },
        {
          headers: {
            Authorization: "Bearer " + telnyxApiKey,
          },
          timeout: 10000, // 10s timeout
        }
      );
      return true; // Success
    } catch (err: any) {
      const status = err?.response?.status;
      const errMsg = err?.response?.data?.errors?.[0]?.detail || err?.message || "Unknown error";
      userLogger.error(`[generateOTP] Telnyx SMS attempt ${attempt + 1}/${maxRetries + 1} failed`, {
        mobile: mobile.slice(0, 4) + "****", // Mask PII
        status,
        error: errMsg,
      });

      // Only retry on 401 (auth flake) or 5xx (server errors)
      if (attempt < maxRetries && (status === 401 || status === 429 || (status >= 500 && status < 600))) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // 1s, 2s backoff
        continue;
      }
      return false; // Non-retryable or exhausted retries
    }
  }
  return false;
};

const generateOTP = async (req: express.Request, res: express.Response) => {
  try {
    const { email, mobile } = req.body;
    if (mobile) {
      // Mobile-based OTP with Telnyx SMS + email fallback
      const userData = await userModel.findOne({
        where: { mobile },
        attributes: ['mobile', 'email', 'name'],
      });

      if (!userData) {
        return errorResponseHelper(res, 404, "Please enter a registered mobile number!");
      }

      // Attempt 1: Send via Telnyx SMS (with built-in retry)
      const smsSent = await sendTelnyxSMS(mobile);
      if (smsSent) {
        return successResponseHelper(res, 200, "OTP sent successfully via SMS!");
      }

      // Attempt 2: Fall back to email if user has one registered
      const userEmail = userData.dataValues?.email;
      const userName = userData.dataValues?.name || "User";
      if (userEmail) {
        userLogger.info(`[generateOTP] Telnyx SMS failed, falling back to email for mobile user`, {
          mobile: mobile.slice(0, 4) + "****",
          email: userEmail,
        });
        const emailSent = await sendEmailOTP(userEmail, userName);
        if (emailSent) {
          return successResponseHelper(res, 200, "SMS unavailable. OTP sent to your registered email instead.");
        }
      }

      // Both channels failed
      userLogger.error("[generateOTP] All OTP channels failed", {
        mobile: mobile.slice(0, 4) + "****",
        hasEmail: !!userEmail,
      });
      return errorResponseHelper(res, 503, "Unable to send OTP at this time. Please try again shortly.");

    } else if (email) {
      // Email-based OTP
      const userData = await userModel.findOne({
        where: { email },
      });
      if (userData?.dataValues) {
        const sent = await sendEmailOTP(email, userData.dataValues.name);
        if (sent) {
          return successResponseHelper(res, 200, "OTP sent successfully!");
        }
        return errorResponseHelper(res, 503, "Unable to send OTP email. Please try again shortly.");
      } else {
        return errorResponseHelper(res, 404, "Please enter a registered email!");
      }
    } else {
      return errorResponseHelper(res, 400, "Please add any number or email!");
    }
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

const confirmOTP = async (req: express.Request, res: express.Response) => {
  try {
    const { email, otp, mobile } = req.body;
    if (otp) {
      if (mobile) {
        const {
          data: { data },
        } = await axios.post(
          `https://api.telnyx.com/v2/verifications/by_phone_number/+${mobile}/actions/verify`,
          {
            code: otp,
            verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID,
          },
          {
            headers: {
              Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
            },
          }
        );
        if (data.response_code === "accepted") {
          // Look up user by mobile when using phone OTP, fallback to email
          const userData = await userModel.findOne({
            where: mobile ? { mobile } : { email },
          });
          if (!userData) {
            return errorResponseHelper(res, 404, "User not found for this phone number");
          }
          const resData = await getAccessToken(userData.dataValues.user_id);
          successResponseHelper(res, 200, "Login Successful!", resData);
        } else {
          errorResponseHelper(res, 400, "OTP did not match!");
        }
      } else {
        // Get OTP from Redis instead of localStorage
        const otpKey = `otp:${email}`;
        const item = await getRedisItem(otpKey);
        
        if (!item || !item.otp) {
          errorResponseHelper(res, 400, "OTP expired or not found!");
          return;
        }
        
        const createdTime = new Date(item.createdAt);
        const currentTime = new Date();
        const diff = getMinutesBetweenDates(currentTime, createdTime);
        if (diff < 10) {
          if (otp === item.otp) {
            const userData = await userModel.findOne({
              where: {
                email,
              },
            });
            // Delete OTP after successful verification
            await deleteRedisItem(otpKey);
            const resData = await getAccessToken(userData.dataValues.user_id);
            successResponseHelper(res, 200, "Login Successful!", resData);
          } else {
            errorResponseHelper(res, 400, "OTP did not match!");
          }
        } else {
          // Delete expired OTP
          await deleteRedisItem(otpKey);
          errorResponseHelper(res, 400, "OTP expired!");
        }
      }
    } else {
      errorResponseHelper(res, 400, "Please add OTP!");
    }
  } catch (e) {
    const message = getErrorMessage(e);
    userLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message ?? "Please request for a new code!");
  }
};

const updateUser = async (req: express.Request, res: express.Response) => {
  try {
    const file = req.file as Express.Multer.File;
    
    // Handle multiple input formats
    let data;
    
    // Format 1: JSON string in "data" field (backwards compatibility)
    if (req.body.data && typeof req.body.data === 'string') {
      data = JSON.parse(req.body.data);
    } 
    // Format 2: Object in "data" field (backwards compatibility)
    else if (req.body.data && typeof req.body.data === 'object') {
      data = req.body.data;
    } 
    // Format 3: Individual form fields (NEW - Swagger UI friendly)
    else if (req.body.name || req.body.email) {
      data = {
        name: req.body.name,
        email: req.body.email,
      };
      // Remove undefined fields
      Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    } else {
      return res.status(400).json({ message: "Missing user data. Please provide name and email.", error: true });
    }
    
    const userData = jwt.decode(res.locals.token) as IUserType;
    const oldEmail = userData.email;
    const oldName = userData.name;
    
    // Track what fields are being updated
    const updatedFields: string[] = [];
    if (data.name && data.name !== oldName) {
      updatedFields.push(`Name: ${oldName} → ${data.name}`);
    }
    if (data.email && data.email !== oldEmail) {
      updatedFields.push(`Email: ${oldEmail} → ${data.email}`);
    }
    
    let photo;
    if (file) {
      const serverUrl = process.env.SERVER_URL?.endsWith('/') ? process.env.SERVER_URL : process.env.SERVER_URL + '/';
      photo = serverUrl + "images/" + file.filename;
      updatedFields.push('Profile Photo: Updated');
    }
    await userModel.update(
      {
        ...data,
        photo,
      },
      { where: { user_id: userData.user_id } }
    );
    
    // Send profile update notification email
    if (updatedFields.length > 0) {
      const { sendUserProfileUpdatedEmail } = await import("../services/emailService");
      const newEmail = data.email || oldEmail;
      const newName = data.name || oldName;
      
      sendUserProfileUpdatedEmail(
        newEmail,
        newName,
        updatedFields,
        data.email && data.email !== oldEmail ? oldEmail : undefined
      ).catch(err => {
        userLogger.error("[UpdateUser] Failed to send notification email:", err);
      });
    }
    
    const token = await getAccessToken(userData.user_id);
    successResponseHelper(res, 200, "User updated successfully!", token);
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

const changePassword = async (req: express.Request, res: express.Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userData = jwt.decode(res.locals.token) as IUserType;
    
    // Validate new password strength
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return errorResponseHelper(res, 400, passwordError);
    }

    // Find user and verify old password using bcrypt (with SHA-256 migration)
    const user = await userModel.findOne({ where: { user_id: userData.user_id } });
    if (!user) {
      return errorResponseHelper(res, 401, "User not found");
    }
    
    const isOldPasswordValid = await verifyPassword(oldPassword, user.dataValues.password, userData.user_id);
    if (isOldPasswordValid) {
      const newPass = hashPassword(newPassword);
      await userModel.update(
        { password: newPass },
        {
          where: {
            user_id: userData.user_id,
          },
        }
      );
      
      // Send password changed notification email
      try {
        const user = await userModel.findByPk(userData.user_id);
        if (user && user.dataValues.email) {
          const now = new Date();
          const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
          const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          await emailService.sendPasswordChangedEmail(
            user.dataValues.email,
            user.dataValues.name || 'User',
            date,
            time
          );
          userLogger.info(`[ChangePassword] Password changed notification sent to ${user.dataValues.email}`);
        }
      } catch (emailError) {
        userLogger.error("[ChangePassword] Failed to send password changed email:", emailError);
        // Don't fail the request if email fails
      }
      
      successResponseHelper(res, 200, "Password updated successfully!", null);
    } else {
      errorResponseHelper(res, 401, "Old password not recognized!");
    }
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

const connectSocial = async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, photo, provider, id = "0" } = req.body;

    const isExists = await userModel
      .findOne({
        where: {
          [Op.or]: [
            {
              email: email,
            },
            { telegram_id: id },
          ],
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);

    userLogger.info("isExists====>", isExists);
    if (isExists) {
      const userData = await userModel.findOne({
        where: {
          [Op.or]: [
            {
              email,
            },
            { telegram_id: id },
          ],
        },
      });
      if (!userData) {
        errorResponseHelper(res, 404, "User not found!");
      } else {
        const resData = await getAccessToken(userData.dataValues.user_id);
        successResponseHelper(res, 200, "Login Successful!", resData);
      }
    } else {
      const image =
        photo ?? process.env.SERVER_URL + (await downloadUserImage());
      const createdUser = await userModel.create({
        name,
        email,
        photo: image,
        login_type: provider.toUpperCase(),
        telegram_id: id,
      });

      if (provider === "telegram") {
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: id,
            text: "Please provide an email or mobile number to have more control over your account.",
          }
        );
      }
      const resData = await getAccessToken(createdUser.dataValues.user_id);

      // Send welcome email if email is available
      if (email) {
        try {
          await emailService.sendWelcomeEmail(email.toLowerCase(), name || "User");
        } catch (emailError) {
          // Log error but don't fail registration
          userLogger.error("Error sending welcome email:", emailError);
        }
      }

      successResponseHelper(res, 200, "Registered Successful!", resData);
    }
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Facebook Sign-In / Sign-Up
 * POST /api/user/facebook-signin
 * Authenticates or registers user via Facebook OAuth
 */
const facebookSignIn = async (req: express.Request, res: express.Response) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return errorResponseHelper(res, 400, "Facebook access token is required");
    }

    // Verify token and get user info from Facebook
    let facebookUserInfo: { id?: string; name?: string; email?: string; picture?: { data?: { url?: string } } };
    try {
      const response = await axios.get(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
      );
      facebookUserInfo = response.data;
    } catch (fbError) {
      userLogger.error("Facebook token verification failed", fbError);
      return errorResponseHelper(res, 401, "Invalid Facebook access token");
    }

    if (!facebookUserInfo || !facebookUserInfo.id) {
      return errorResponseHelper(res, 400, "Could not retrieve user info from Facebook");
    }

    const { id: facebookId, name, email, picture } = facebookUserInfo;
    const photoUrl = picture?.data?.url;

    // Check if user exists by email or facebook ID (stored in external_id)
    let user = await userModel.findOne({
      where: {
        [Op.or]: [
          email ? { email: email.toLowerCase() } : null,
          { external_id: facebookId },
        ].filter(Boolean),
      },
    });

    if (user) {
      // Update external_id if not set
      if (!user.dataValues.external_id && facebookId) {
        await userModel.update(
          { 
            external_id: facebookId,
            login_type: "FACEBOOK",
          },
          { where: { user_id: user.dataValues.user_id } }
        );
      }

      // Generate access token and return
      const resData = await getAccessToken(user.dataValues.user_id);
      return successResponseHelper(res, 200, "Login Successful!", resData);
    }

    // Create new user
    const defaultPhoto = process.env.SERVER_URL + (await downloadUserImage());
    const finalPhoto = photoUrl || defaultPhoto;
    
    const createdUser = await userModel.create({
      name: name || (email ? email.split("@")[0] : "Facebook User"),
      email: email ? email.toLowerCase() : null,
      photo: finalPhoto,
      login_type: "FACEBOOK",
      external_id: facebookId,
    });

    // Create wallets for the new user
    const walletData = await adminWalletModel.findAll();
    const fiatData = walletData.filter(
      (x) => x.dataValues.currency_type === "FIAT"
    );
    const cryptoData = walletData.filter(
      (x) => x.dataValues.currency_type === "CRYPTO"
    );

    for (let i = 0; i < fiatData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: fiatData[i].dataValues.wallet_type,
        currency_type: "FIAT",
      });
    }

    for (let i = 0; i < cryptoData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: cryptoData[i].dataValues.wallet_type,
        currency_type: "CRYPTO",
      });
    }

    // Generate access token
    const resData = await getAccessToken(createdUser.dataValues.user_id);

    // Send welcome email if email is available
    if (email) {
      try {
        await emailService.sendWelcomeEmail(email.toLowerCase(), name || "Facebook User");
      } catch (emailError) {
        // Log error but don't fail registration
        userLogger.error("Error sending welcome email:", emailError);
      }
    }

    userLogger.info(`New user registered via Facebook: ${facebookId}`);

    return successResponseHelper(res, 200, "Registration Successful!", resData);

  } catch (e) {


      handleControllerError(res, e, userLogger);
  }
};

/**
 * Forgot Password - Send reset email with token
 * POST /api/user/forgot-password
 */
const forgotPassword = async (req: express.Request, res: express.Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponseHelper(res, 400, "Email is required");
    }

    // Find user by email
    const user = await userModel.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists or not for security
      return successResponseHelper(res, 200, "If the email exists, a reset link has been sent", {});
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = sha256(resetToken).toString();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save token to database
    await userModel.update(
      {
        reset_token: resetTokenHash,
        reset_token_expiry: resetTokenExpiry,
      },
      {
        where: { user_id: user.dataValues.user_id },
      }
    );

    // Build reset URL - use FRONTEND_URL for dashboard/merchant login pages
    const frontendUrl = process.env.FRONTEND_URL || process.env.SERVER_URL || "https://dashboard.dynopay.com";
    // Remove trailing slash if present to avoid double slashes
    const baseUrl = frontendUrl.replace(/\/$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email.toLowerCase())}`;

    // Send reset email
    const emailMessage = `You requested a password reset for your Dynocash account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this, please ignore this email. Your password will remain unchanged.`;

    await sendEmail(
      email.toLowerCase(),
      user.dataValues.name || "User",
      "Password Reset Request - Dynocash",
      emailMessage
    );

    userLogger.info(`Password reset requested for email: ${email}`);
    
    return successResponseHelper(res, 200, "If the email exists, a reset link has been sent", {});

  } catch (e) {


      handleControllerError(res, e, userLogger);
  }
};

/**
 * Reset Password - Reset password with token
 * POST /api/user/reset-password
 */
const resetPassword = async (req: express.Request, res: express.Response) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      return errorResponseHelper(res, 400, "Token, email, and new password are required");
    }

    if (newPassword.length < 6) {
      return errorResponseHelper(res, 400, "Password must be at least 6 characters");
    }
    
    // Validate password strength (OWASP)
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return errorResponseHelper(res, 400, passwordError);
    }

    // Hash the provided token to compare with stored hash (sha256 is fine for tokens)
    const tokenHash = sha256(token).toString();

    // Find user with valid token
    const user = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
        reset_token: tokenHash,
        reset_token_expiry: {
          [Op.gt]: new Date(), // Token not expired
        },
      },
    });

    if (!user) {
      return errorResponseHelper(res, 400, "Invalid or expired reset token");
    }

    // Hash new password with bcrypt and update
    const hashedPassword = hashPassword(newPassword);

    await userModel.update(
      {
        password: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
      },
      {
        where: { user_id: user.dataValues.user_id },
      }
    );

    // Send branded password changed confirmation email
    try {
      const now = new Date();
      const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      await emailService.sendPasswordChangedEmail(
        email.toLowerCase(),
        user.dataValues.name || "User",
        date,
        time
      );
      userLogger.info(`[ResetPassword] Password changed notification sent to ${email}`);
    } catch (emailError) {
      userLogger.error("[ResetPassword] Failed to send password changed email:", emailError);
      // Don't fail the request if email fails
    }

    userLogger.info(`Password reset successful for email: ${email}`);

    return successResponseHelper(res, 200, "Password has been reset successfully", {});

  } catch (e) {


      handleControllerError(res, e, userLogger);
  }
};

/**
 * Google Sign-In - Authenticate with Google ID token
 * POST /api/user/google-signin
 */
const googleSignIn = async (req: express.Request, res: express.Response) => {
  try {
    const { idToken, accessToken } = req.body;

    if (!idToken && !accessToken) {
      return errorResponseHelper(res, 400, "Google ID token or access token is required");
    }

    let googleUserInfo: { email?: string; name?: string; picture?: string; sub?: string };

    if (idToken) {
      // Verify ID token with Google
      try {
        const response = await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );
        googleUserInfo = response.data;
      } catch (tokenError) {
        return errorResponseHelper(res, 401, "Invalid Google ID token");
      }
    } else if (accessToken) {
      // Use access token to get user info
      try {
        const response = await axios.get(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        googleUserInfo = response.data;
      } catch (tokenError) {
        return errorResponseHelper(res, 401, "Invalid Google access token");
      }
    }

    if (!googleUserInfo || !googleUserInfo.email) {
      return errorResponseHelper(res, 400, "Could not retrieve user info from Google");
    }

    const { email, name, picture, sub: googleId } = googleUserInfo;

    // Check if user exists by email or google_id
    let user = await userModel.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { google_id: googleId },
        ],
      },
    });

    if (user) {
      // Update google_id if not set
      if (!user.dataValues.google_id && googleId) {
        await userModel.update(
          { 
            google_id: googleId,
            login_type: "GOOGLE",
          },
          { where: { user_id: user.dataValues.user_id } }
        );
      }

      // Generate access token and return
      const resData = await getAccessToken(user.dataValues.user_id);
      return successResponseHelper(res, 200, "Login Successful!", resData);
    }

    // Create new user
    const photoUrl = picture || process.env.SERVER_URL + (await downloadUserImage());
    
    const createdUser = await userModel.create({
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      photo: photoUrl,
      login_type: "GOOGLE",
      google_id: googleId,
    });

    // Create default wallets for new user
    const walletData = await adminWalletModel.findAll();
    const fiatData = walletData.filter((x) => x.dataValues.currency_type === "FIAT");
    const cryptoData = walletData.filter((x) => x.dataValues.currency_type === "CRYPTO");

    for (let i = 0; i < fiatData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: fiatData[i].dataValues.wallet_type,
        currency_type: "FIAT",
      });
    }

    for (let i = 0; i < cryptoData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: cryptoData[i].dataValues.wallet_type,
        currency_type: "CRYPTO",
      });
    }

    const resData = await getAccessToken(createdUser.dataValues.user_id);

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(email.toLowerCase(), name || email.split("@")[0]);
    } catch (emailError) {
      // Log error but don't fail registration
      userLogger.error("Error sending welcome email:", emailError);
    }

    userLogger.info(`New user registered via Google: ${email}`);

    return successResponseHelper(res, 200, "Registration Successful!", resData);

  } catch (e) {


      handleControllerError(res, e, userLogger);
  }
};

/**
 * Get User Profile
 * GET /api/user/profile
 */
const getProfile = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    // Check Redis cache first
    const cacheKey = `profile:${userData.user_id}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      userLogger.info(`[Profile] Cache hit for user ${userData.user_id}`);
      return successResponseHelper(res, 200, "Profile retrieved successfully", cached);
    }

    // OPTIMIZED: Run all queries in parallel
    const [user, companiesCount, walletsCount, apiKeysCount] = await Promise.all([
      userModel.findOne({
        where: { user_id: userData.user_id },
        attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry', 'verified_otp', 'otp_expired'] }
      }),
      companyModel.count({ where: { user_id: userData.user_id } }),
      userWalletAddressModel.count({ where: { user_id: userData.user_id } }),
      apiModel.count({ where: { user_id: userData.user_id } })
    ]);

    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    const profileData = {
      ...user.dataValues,
      stats: {
        companies: companiesCount,
        wallets: walletsCount,
        api_keys: apiKeysCount,
      }
    };

    // Cache the result
    await setRedisItem(cacheKey, profileData);
    await setRedisTTL(cacheKey, PROFILE_CACHE_TTL);

    return successResponseHelper(res, 200, "Profile retrieved successfully", profileData);

  } catch (e) {


      handleControllerError(res, e, userLogger);
  }
};

/**
 * Update Profile (name, mobile, username)
 * PUT /api/user/profile
 * Allows updating basic profile fields without image
 */
const updateProfile = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { name, mobile, username } = req.body;
    
    // Fetch current DB data for accurate comparison (JWT may be stale)
    const currentUser = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: ['name', 'mobile', 'username']
    });
    const currentName = currentUser?.dataValues?.name || userData.name;
    const currentMobile = currentUser?.dataValues?.mobile || userData.mobile;
    const currentUsername = currentUser?.dataValues?.username || userData.username;
    
    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    const updatedFields: string[] = [];
    
    if (name !== undefined && name !== currentName) {
      updateData.name = name;
      updatedFields.push(`Name: ${currentName} → ${name}`);
    }
    if (mobile !== undefined && mobile !== currentMobile) {
      updateData.mobile = mobile;
      updatedFields.push(`Mobile: ${currentMobile || 'Not set'} → ${mobile}`);
    }
    if (username !== undefined && username !== currentUsername) {
      updateData.username = username;
      updatedFields.push(`Username: ${currentUsername} → ${username}`);
    }
    
    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No fields to update");
    }
    
    await userModel.update(updateData, {
      where: { user_id: userData.user_id }
    });
    
    // Get updated user data
    const updatedUser = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry'] }
    });
    
    // Invalidate profile cache
    await deleteRedisItem(`profile:${userData.user_id}`);
    
    // Send profile update notification email
    if (updatedFields.length > 0) {
      const { sendUserProfileUpdatedEmail } = await import("../services/emailService");
      sendUserProfileUpdatedEmail(
        userData.email,
        updatedUser?.dataValues.name || userData.name,
        updatedFields
      ).catch(err => {
        userLogger.error("[UpdateProfile] Failed to send notification email:", err);
      });
    }
    
    successResponseHelper(res, 200, "Profile updated successfully!", updatedUser);
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Change Email Address
 * PUT /api/user/email
 * Requires password confirmation for security
 */
const changeEmail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { newEmail, password } = req.body;
    
    if (!newEmail || !password) {
      return errorResponseHelper(res, 400, "Email and password are required");
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return errorResponseHelper(res, 400, "Invalid email format");
    }
    
    // Verify password using bcrypt (with SHA-256 migration)
    const user = await userModel.findOne({
      where: { user_id: userData.user_id }
    });
    
    if (!user || !(await verifyPassword(password, user.dataValues.password, userData.user_id))) {
      return errorResponseHelper(res, 401, "Invalid password");
    }
    
    // Check if new email is already in use
    const emailExists = await userModel.findOne({
      where: {
        email: newEmail.toLowerCase(),
        user_id: { [Op.ne]: userData.user_id }
      }
    });
    
    if (emailExists) {
      return errorResponseHelper(res, 400, "Email address already in use");
    }
    
    // Update email
    await userModel.update(
      { email: newEmail.toLowerCase() },
      { where: { user_id: userData.user_id } }
    );
    
    // Send confirmation email to new address
    try {
      await sendEmail(
        newEmail,
        user.dataValues.name || "User",
        "Email Address Changed - Dynopay",
        `Your Dynopay account email has been successfully changed to this address.

If you didn't make this change, please contact support immediately.

Best regards,
Dynopay Team`
      );
    } catch (emailError) {
      userLogger.error("Failed to send email change confirmation", emailError);
    }
    
    // Generate new token with updated email
    const token = await getAccessToken(userData.user_id);
    
    successResponseHelper(res, 200, "Email updated successfully!", token);
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Change Phone Number
 * PUT /api/user/phone
 * Requires password confirmation for security (since phone is used for SMS auth)
 */
const changePhone = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { newPhone, password } = req.body;
    
    if (!newPhone || !password) {
      return errorResponseHelper(res, 400, "Phone number and password are required");
    }
    
    // Validate phone format (basic - digits only, 10-15 chars)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(newPhone)) {
      return errorResponseHelper(res, 400, "Invalid phone number format. Use digits only (10-15 digits)");
    }
    
    // Verify password using bcrypt (with SHA-256 migration)
    const user = await userModel.findOne({
      where: { user_id: userData.user_id }
    });
    
    if (!user || !(await verifyPassword(password, user.dataValues.password, userData.user_id))) {
      return errorResponseHelper(res, 401, "Invalid password");
    }
    
    // Check if new phone is already in use by another user
    const phoneExists = await userModel.findOne({
      where: {
        mobile: newPhone,
        user_id: { [Op.ne]: userData.user_id }
      }
    });
    
    if (phoneExists) {
      return errorResponseHelper(res, 400, "Phone number already in use by another account");
    }
    
    // Update phone number
    await userModel.update(
      { mobile: newPhone },
      { where: { user_id: userData.user_id } }
    );
    
    // Get updated user data
    const updatedUser = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry'] }
    });
    
    // Optionally send SMS confirmation to new number
    try {
      await axios.post(
        "https://api.telnyx.com/v2/messages",
        {
          from: process.env.TELNYX_PHONE_NUMBER,
          to: "+" + newPhone,
          text: `Your Dynopay phone number has been successfully updated to this number. If you didn't make this change, please contact support immediately.`
        },
        {
          headers: {
            Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
          },
        }
      );
    } catch (smsError) {
      // Log but don't fail the request if SMS fails
      userLogger.error("Failed to send phone change confirmation SMS", smsError);
    }
    
    userLogger.info(`Phone number updated for user ${userData.user_id}`);
    
    successResponseHelper(res, 200, "Phone number updated successfully!", updatedUser);
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Remove Email from Account
 * DELETE /api/user/email
 * Requires password and must have alternative login method (mobile/social)
 */
const removeEmail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { password } = req.body;
    
    if (!password) {
      return errorResponseHelper(res, 400, "Password is required");
    }
    
    // Get user data
    const user = await userModel.findOne({
      where: { user_id: userData.user_id }
    });
    
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }
    
    // Verify password using bcrypt (with SHA-256 migration)
    if (!(await verifyPassword(password, user.dataValues.password, userData.user_id))) {
      return errorResponseHelper(res, 401, "Invalid password");
    }
    
    // Check if user has alternative login method
    const hasMobile = user.dataValues.mobile && user.dataValues.mobile.length > 0;
    const hasGoogle = user.dataValues.google_id;
    const hasTelegram = user.dataValues.telegram_id;
    
    if (!hasMobile && !hasGoogle && !hasTelegram) {
      return errorResponseHelper(
        res, 
        400, 
        "Cannot remove email. Please add a phone number or link a social account first."
      );
    }
    
    // Remove email
    await userModel.update(
      { email: null },
      { where: { user_id: userData.user_id } }
    );
    
    userLogger.info(`Email removed for user ${userData.user_id}`);
    
    successResponseHelper(res, 200, "Email removed successfully. You can still login using your phone or social accounts.");
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Remove Phone Number from Account
 * DELETE /api/user/phone
 * Requires password and must have alternative login method (email/social)
 */
const removePhone = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { password } = req.body;
    
    if (!password) {
      return errorResponseHelper(res, 400, "Password is required");
    }
    
    // Get user data
    const user = await userModel.findOne({
      where: { user_id: userData.user_id }
    });
    
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }
    
    // Verify password using bcrypt (with SHA-256 migration)
    if (!(await verifyPassword(password, user.dataValues.password, userData.user_id))) {
      return errorResponseHelper(res, 401, "Invalid password");
    }
    
    // Check if user has alternative login method
    const hasEmail = user.dataValues.email && user.dataValues.email.length > 0;
    const hasGoogle = user.dataValues.google_id;
    const hasTelegram = user.dataValues.telegram_id;
    
    if (!hasEmail && !hasGoogle && !hasTelegram) {
      return errorResponseHelper(
        res, 
        400, 
        "Cannot remove phone. Please add an email or link a social account first."
      );
    }
    
    // Remove mobile
    await userModel.update(
      { mobile: null },
      { where: { user_id: userData.user_id } }
    );
    
    userLogger.info(`Phone removed for user ${userData.user_id}`);
    
    successResponseHelper(res, 200, "Phone number removed successfully. You can still login using your email or social accounts.");
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Delete User Account
 * DELETE /api/user/account
 * Requires password confirmation for security
 */
const deleteAccount = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { password, confirmation } = req.body;

    if (!password) {
      return errorResponseHelper(res, 400, "Password is required for account deletion");
    }

    if (confirmation !== "DELETE") {
      return errorResponseHelper(res, 400, "Please type 'DELETE' to confirm account deletion");
    }

    // Verify password using bcrypt (with SHA-256 migration)
    const user = await userModel.findOne({
      where: { user_id: userData.user_id }
    });

    if (!user || !(await verifyPassword(password, user.dataValues.password, userData.user_id))) {
      return errorResponseHelper(res, 401, "Invalid password");
    }

    // Delete all related data (cascading should handle most, but let's be explicit)
    const userId = userData.user_id;

    // Delete notifications
    await notificationModel.destroy({ where: { user_id: userId } });
    
    // Delete notification preferences
    await notificationPreferencesModel.destroy({ where: { user_id: userId } });

    // Delete KYC records
    await kycModel.destroy({ where: { user_id: userId } });

    // Delete wallet addresses
    await userWalletAddressModel.destroy({ where: { user_id: userId } });

    // Delete wallets
    await userWalletModel.destroy({ where: { user_id: userId } });

    // Delete API keys (will cascade to plans and subscriptions)
    await apiModel.destroy({ where: { user_id: userId } });

    // Delete companies (will cascade to related data)
    await companyModel.destroy({ where: { user_id: userId } });

    // Clean up Redis entries for user's payment links
    try {
      const { paymentLinkModel } = await import("../models");
      const userPaymentLinks = await paymentLinkModel.findAll({
        where: { user_id: userId },
        attributes: ['payment_link'],
      });
      
      for (const link of userPaymentLinks) {
        const paymentLinkUrl = link.dataValues.payment_link;
        const urlMatch = paymentLinkUrl?.match(/[?&]d=([a-f0-9]+)/i);
        if (urlMatch && urlMatch[1]) {
          await deleteRedisItem("customer-" + urlMatch[1]);
        }
      }
      
      // Delete payment links from database
      await paymentLinkModel.destroy({ where: { user_id: userId } });
      
      // Clean up any cached data for this user
      await deleteRedisItem(`dashboard:${userId}:all`);
      await deleteRedisItem(`profile:${userId}`);
      await deleteRedisItem(`wallets:${userId}`);
      await deleteRedisItem(userData.email + "-withdrawal-otp");
      
      userLogger.info(`Redis cleanup completed for user ${userId}`);
    } catch (redisError) {
      userLogger.warn(`Redis cleanup failed for user ${userId}: ${getErrorMessage(redisError)}`);
      // Continue with deletion even if Redis cleanup fails
    }

    // Finally, delete the user
    await userModel.destroy({ where: { user_id: userId } });

    userLogger.info(`User account deleted: ${userData.email}`);

    return successResponseHelper(res, 200, "Account deleted successfully", {
      message: "Your account and all associated data have been permanently deleted"
    });

  } catch (e) {


      handleControllerError(res, e, userLogger);
  }
};

/**
 * Unsubscribe from referee code reminder emails
 * No authentication required - uses unsubscribe token
 */
const unsubscribeFromReminders = async (req: express.Request, res: express.Response) => {
  try {
    // Token can come from query param (GET) or body (POST)
    const token = req.params.token || req.query.token || req.body.token;
    
    if (!token) {
      return errorResponseHelper(res, 400, "Unsubscribe token is required");
    }
    
    const { refereeCodeModel } = await import("../models");
    
    // Find the referee code with this unsubscribe token
    const refereeCode = await refereeCodeModel.findOne({
      where: { unsubscribe_token: token },
    });
    
    if (!refereeCode) {
      return errorResponseHelper(res, 404, "Invalid unsubscribe token");
    }
    
    const codeData = refereeCode.dataValues;
    
    // Check if already unsubscribed
    if (codeData.unsubscribed_at) {
      return successResponseHelper(res, 200, "You have already unsubscribed from reminder emails", {
        email: codeData.customer_email,
        unsubscribed_at: codeData.unsubscribed_at,
      });
    }
    
    // Mark as unsubscribed
    await refereeCodeModel.update(
      { unsubscribed_at: new Date() },
      { where: { code_id: codeData.code_id } }
    );
    
    userLogger.info(`[Unsubscribe] ${codeData.customer_email} unsubscribed from referee code reminders`);
    
    return successResponseHelper(res, 200, "Successfully unsubscribed from reminder emails", {
      email: codeData.customer_email,
      message: "You will no longer receive reminder emails about your discount code. Note: Your discount code is still valid if you decide to sign up.",
    });
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Unsubscribe from payment link reminder emails
 * No authentication required - uses unsubscribe token
 */
const unsubscribeFromPaymentReminders = async (req: express.Request, res: express.Response) => {
  try {
    // Token can come from query param (GET) or body (POST)
    const token = req.params.token || req.query.token || req.body.token;
    
    if (!token) {
      return errorResponseHelper(res, 400, "Unsubscribe token is required");
    }
    
    const { paymentLinkModel } = await import("../models");
    
    // Find the payment link with this unsubscribe token
    const paymentLink = await paymentLinkModel.findOne({
      where: { unsubscribe_token: token },
    });
    
    if (!paymentLink) {
      return errorResponseHelper(res, 404, "Invalid unsubscribe token");
    }
    
    const linkData = paymentLink.dataValues;
    
    // Check if already unsubscribed
    if (linkData.unsubscribed_at) {
      return successResponseHelper(res, 200, "You have already unsubscribed from payment reminder emails", {
        email: linkData.email,
        unsubscribed_at: linkData.unsubscribed_at,
      });
    }
    
    // Mark as unsubscribed
    await paymentLinkModel.update(
      { unsubscribed_at: new Date() },
      { where: { link_id: linkData.link_id } }
    );
    
    userLogger.info(`[Unsubscribe] ${linkData.email} unsubscribed from payment link reminders (link_id: ${linkData.link_id})`);
    
    return successResponseHelper(res, 200, "Successfully unsubscribed from payment reminder emails", {
      email: linkData.email,
      message: "You will no longer receive reminder emails about this payment. You can still complete the payment using your original link.",
    });
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Get onboarding status for authenticated user
 * GET /api/user/onboarding-status
 * 
 * Returns a comprehensive status of user's setup progress including:
 * - Wallet setup status
 * - KYC status
 * - API key status
 * - Company setup status
 * - Next steps for incomplete setup
 */
const getOnboardingStatus = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const userId = userData.user_id;
    
    // 1. Check wallet setup
    // Only count CRYPTO wallets - FIAT wallets are auto-created and don't count for onboarding
    const cryptoWallets = await userWalletModel.findAll({
      where: { 
        user_id: userId,
        currency_type: 'CRYPTO',  // Only count crypto wallets
      },
    });
    
    // Count crypto wallets that have an actual wallet_address configured
    const walletsWithAddress = cryptoWallets.filter((w: any) => {
      const address = w.get("wallet_address");
      return address && address.trim() !== '';
    });
    
    // Also check the separate addresses table (userWalletAddressModel)
    const additionalAddresses = await userWalletAddressModel.findAll({
      where: { user_id: userId },
    });
    
    // A merchant has crypto wallets if they have CRYPTO type wallets
    const hasCryptoWallet = cryptoWallets.length > 0;
    // A merchant can receive payments if they have at least one wallet address configured
    const hasWalletAddress = walletsWithAddress.length > 0 || additionalAddresses.length > 0;
    const totalConfiguredAddresses = walletsWithAddress.length + additionalAddresses.length;
    
    // 2. Check KYC status
    const kycRecord = await kycModel.findOne({
      where: { user_id: userId },
    });
    
    // Calculate total volume for KYC threshold check
    const volumeResult = await sequelize.query(
      `SELECT COALESCE(SUM(CAST(base_amount AS DECIMAL)), 0) as total_volume 
       FROM tbl_customer_transaction 
       WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId)
       AND status = 'successful'`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    ) as { total_volume: string }[];
    
    const totalVolume = parseFloat(String(volumeResult[0]?.total_volume || "0"));
    const kycThreshold = 10000; // $10,000 USD threshold
    const kycGracePeriodDays = 90;
    const requiresKyc = totalVolume >= kycThreshold;
    const kycStatus = kycRecord ? kycRecord.get("status") as string : "not_started";
    const kycApproved = kycStatus === "approved";
    
    // 3. Check API key status
    const apiKeys = await apiModel.findAll({
      where: { user_id: userId },
    });
    
    const hasProductionKey = apiKeys.some((key: any) => 
      key.get("environment") === "production" && key.get("status") === "active"
    );
    const hasDevelopmentKey = apiKeys.some((key: any) => 
      key.get("environment") === "development" && key.get("status") === "active"
    );
    
    // 4. Check company setup
    const companies = await companyModel.findAll({
      where: { user_id: userId },
    });
    
    const hasCompany = companies.length > 0;
    
    // 5. Calculate KYC grace period if applicable
    let kycWarning: {
      type: string;
      message: string;
      days_remaining: number;
      threshold_date: string | null;
      grace_period_end: string | null;
      verification_url: string | null;
      api_endpoint: string;
      has_active_session: boolean;
    } | null = null;
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://dynopay.io';
    
    // Get existing Veriff session URL if available
    const veriffSessionUrl = kycRecord ? kycRecord.get("veriff_session_url") as string | null : null;
    const kycSubmittedStatus = kycRecord ? kycRecord.get("status") as string : "not_started";
    
    // Determine if merchant has an active Veriff session they can continue
    const hasActiveSession = veriffSessionUrl && ["submitted", "pending"].includes(kycSubmittedStatus);
    
    if (requiresKyc && !kycApproved) {
      // Calculate grace period
      try {
        const thresholdQuery = `
          SELECT MIN("createdAt") as threshold_date
          FROM (
            SELECT "createdAt", 
                   SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
            FROM tbl_customer_transaction 
            WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId) 
            AND status = 'successful'
          ) sub
          WHERE running_total >= :threshold
        `;
        
        const thresholdResult = await sequelize.query<{ threshold_date: string }>(
          thresholdQuery,
          {
            replacements: { userId, threshold: kycThreshold },
            type: QueryTypes.SELECT,
          }
        );
        
        const thresholdDate = thresholdResult[0]?.threshold_date ? new Date(thresholdResult[0].threshold_date) : null;
        
        if (thresholdDate) {
          const gracePeriodEnd = new Date(thresholdDate);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + kycGracePeriodDays);
          const now = new Date();
          const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysRemaining > 0) {
            const urgencyType = daysRemaining <= 14 ? "critical" : daysRemaining <= 30 ? "warning" : "info";
            kycWarning = {
              type: urgencyType,
              message: daysRemaining <= 14 
                ? `URGENT: Only ${daysRemaining} days left to complete KYC verification! Your account will be restricted after ${gracePeriodEnd.toLocaleDateString()}.`
                : daysRemaining <= 30
                ? `Warning: ${daysRemaining} days remaining to complete KYC verification before your account is restricted.`
                : `KYC verification required within ${daysRemaining} days. Complete verification to continue processing payments.`,
              days_remaining: daysRemaining,
              threshold_date: thresholdDate.toISOString(),
              grace_period_end: gracePeriodEnd.toISOString(),
              // If merchant has an active Veriff session, use that URL; otherwise provide API endpoint
              verification_url: hasActiveSession ? veriffSessionUrl : null,
              api_endpoint: "/api/kyc/submit",
              has_active_session: !!hasActiveSession,
            };
          } else {
            kycWarning = {
              type: "critical",
              message: "Your KYC grace period has expired. Complete verification immediately to resume payment processing.",
              days_remaining: 0,
              threshold_date: thresholdDate.toISOString(),
              grace_period_end: gracePeriodEnd.toISOString(),
              verification_url: hasActiveSession ? veriffSessionUrl : null,
              api_endpoint: "/api/kyc/submit",
              has_active_session: !!hasActiveSession,
            };
          }
        }
      } catch (e) {
        userLogger.warn("[Onboarding] Could not calculate KYC grace period:", e);
      }
    }
    
    // 6. Determine next steps
    const nextSteps: string[] = [];
    
    // Check email verification status
    const userRecord = await userModel.findOne({ where: { user_id: userId }, attributes: ['email_verified'] });
    const isEmailVerified = userRecord?.dataValues?.email_verified === true;
    
    if (!isEmailVerified) {
      nextSteps.push("Verify your email address to unlock all features");
    }
    
    if (!hasCompany) {
      nextSteps.push("Create a company to start accepting payments");
    }
    
    if (!hasWalletAddress) {
      nextSteps.push("Add a wallet address to receive crypto payments");
    }
    
    if (requiresKyc && !kycApproved) {
      const kycMessage = kycWarning?.days_remaining !== undefined && kycWarning.days_remaining <= 30
        ? `URGENT: Complete KYC verification (${kycWarning.days_remaining} days remaining)`
        : "Complete KYC verification to continue processing payments";
      nextSteps.push(kycMessage);
    }
    
    if (!hasProductionKey && hasCompany) {
      nextSteps.push("Create a production API key for live payments");
    }
    
    // 7. Determine if onboarding is complete (email must be verified)
    const onboardingComplete = isEmailVerified && hasCompany && hasWalletAddress && (!requiresKyc || kycApproved);
    
    // Build response
    const onboardingStatus = {
      email_verification: {
        is_verified: isEmailVerified,
        required_action: !isEmailVerified ? "Verify your email address" : null,
      },
      wallet_setup: {
        has_wallet: hasCryptoWallet,  // Has at least one CRYPTO wallet type
        has_wallet_address: hasWalletAddress,  // Has at least one address to receive payments
        wallet_count: cryptoWallets.length,  // Only CRYPTO wallets (not FIAT)
        address_count: totalConfiguredAddresses,  // Total configured addresses
        // Breakdown for clarity
        wallets_with_address: walletsWithAddress.length,
        additional_addresses: additionalAddresses.length,
        required_action: !hasWalletAddress ? "Add at least one wallet address to receive payments" : null,
      },
      kyc_status: {
        status: kycStatus,
        requires_kyc: requiresKyc,
        is_approved: kycApproved,
        total_volume: totalVolume,
        threshold: kycThreshold,
        grace_period_days: kycGracePeriodDays,
        required_action: requiresKyc && !kycApproved ? "Complete KYC verification" : null,
        // Include warning for in-app banner display
        warning: kycWarning,
      },
      api_key_status: {
        has_production_key: hasProductionKey,
        has_development_key: hasDevelopmentKey,
        total_keys: apiKeys.length,
        required_action: !hasProductionKey && hasCompany ? "Create a production API key for live payments" : null,
      },
      company_setup: {
        has_company: hasCompany,
        company_count: companies.length,
        required_action: !hasCompany ? "Create a company to start accepting payments" : null,
      },
      onboarding_complete: onboardingComplete,
      next_steps: nextSteps,
    };
    
    userLogger.info(`[Onboarding] Status retrieved for user ${userId}: complete=${onboardingComplete}, next_steps=${nextSteps.length}`);
    
    return successResponseHelper(res, 200, "Onboarding status retrieved successfully", onboardingStatus);
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/verify-email
 * Verify email address using OTP sent during registration.
 * Requires authentication.
 */
const verifyEmail = async (req: express.Request, res: express.Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    const userId = userData.user_id;
    const { otp } = req.body;

    if (!otp) {
      return errorResponseHelper(res, 400, "OTP is required");
    }

    // Check if already verified
    const user = await userModel.findOne({ where: { user_id: userId } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }
    if (user.dataValues.email_verified) {
      return successResponseHelper(res, 200, "Email is already verified", { email_verified: true });
    }

    // Acquire a lock to prevent duplicate verification (race condition guard)
    const verifyLockKey = `email-verify-lock:${userId}`;
    const existingLock = await getRedisItem(verifyLockKey);
    if (existingLock && Object.keys(existingLock).length > 0) {
      return successResponseHelper(res, 200, "Email verification is being processed", { email_verified: true });
    }
    await setRedisItem(verifyLockKey, { processing: true });
    await setRedisTTL(verifyLockKey, 30); // 30 second lock

    // Check OTP from Redis
    const verifyKey = `email-verify:${userId}`;
    const storedData = await getRedisItem(verifyKey);
    if (!storedData || typeof storedData !== 'object' || !('otp' in (storedData as Record<string, unknown>))) {
      await deleteRedisItem(verifyLockKey);
      return errorResponseHelper(res, 400, "Verification code has expired. Please request a new one.");
    }

    const storedOtp = (storedData as Record<string, unknown>).otp;
    if (String(storedOtp) !== String(otp)) {
      await deleteRedisItem(verifyLockKey);
      return errorResponseHelper(res, 400, "Invalid verification code. Please try again.");
    }

    // OTP matches — mark email as verified
    await userModel.update({ email_verified: true }, { where: { user_id: userId } });
    await deleteRedisItem(verifyKey);

    // Invalidate profile cache so subsequent calls reflect the change
    await deleteRedisItem(`profile:${userId}`);

    userLogger.info(`[VerifyEmail] Email verified for user ${userId}`);

    // Send welcome email now that OTP is verified (non-blocking, with dedup guard)
    const welcomeSentKey = `welcome-email-sent:${userId}`;
    const alreadySent = await getRedisItem(welcomeSentKey);
    if (!alreadySent || Object.keys(alreadySent).length === 0) {
      await setRedisItem(welcomeSentKey, { sent: true });
      await setRedisTTL(welcomeSentKey, 3600); // 1 hour dedup window
      const email = user.dataValues.email;
      const name = user.dataValues.name || "User";
      emailService.sendWelcomeEmail(email.toLowerCase(), name).catch(err => {
        userLogger.error("[VerifyEmail] Failed to send welcome email:", err);
      });
    }

    // Release lock
    await deleteRedisItem(verifyLockKey);

    return successResponseHelper(res, 200, "Email verified successfully!", { email_verified: true });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/resend-verification
 * Resend email verification OTP. Requires authentication.
 * Rate limited: 1 request per 60 seconds.
 */
const resendVerification = async (req: express.Request, res: express.Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    const userId = userData.user_id;

    const user = await userModel.findOne({ where: { user_id: userId } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }
    if (user.dataValues.email_verified) {
      return successResponseHelper(res, 200, "Email is already verified", { email_verified: true });
    }

    // Cooldown check — 60 seconds between resend requests
    const cooldownKey = `email-verify-cooldown:${userId}`;
    const cooldown = await getRedisItem(cooldownKey);
    if (cooldown && Object.keys(cooldown).length > 0) {
      return errorResponseHelper(res, 429, "Please wait 60 seconds before requesting a new code.");
    }

    // Generate new OTP
    const email = user.dataValues.email;
    const name = user.dataValues.name || "User";
    const verifyOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 10 min TTL
    const verifyKey = `email-verify:${userId}`;
    await setRedisItem(verifyKey, { otp: verifyOtp, createdAt: new Date().toISOString() });
    await setRedisTTL(verifyKey, 600);

    // Set 60s cooldown
    await setRedisItem(cooldownKey, { sent: true });
    await setRedisTTL(cooldownKey, 60);

    // Send email (non-blocking)
    emailService.sendEmailVerificationOTPEmail(email, name, verifyOtp).catch(err => {
      userLogger.error("[ResendVerification] Failed to send verification email:", err);
    });

    userLogger.info(`[ResendVerification] Verification OTP resent for user ${userId}`);

    return successResponseHelper(res, 200, "Verification code sent to your email.");
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Update last selected company for the user (for session persistence across logins)
 * PUT /api/user/last-company
 * Body: { company_id: number }
 */
const updateLastCompany = async (req: express.Request, res: express.Response) => {
  try {
    const userId = (res.locals.user as any)?.user_id;
    if (!userId) return errorResponseHelper(res, 401, "Unauthorized");

    const { company_id } = req.body;
    if (!company_id) return errorResponseHelper(res, 400, "company_id is required");

    // Verify this company belongs to the user
    const company = await companyModel.findOne({
      where: { company_id, user_id: userId },
    });
    if (!company) return errorResponseHelper(res, 404, "Company not found or not owned by user");

    await userModel.update(
      { last_company_id: company_id },
      { where: { user_id: userId } }
    );

    successResponseHelper(res, 200, "Last company updated", { last_company_id: company_id });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

export default {
  registerUser,
  registerPhoneStep1,
  registerPhoneStep2,
  login,
  checkEmail,
  generateOTP,
  confirmOTP,
  connectSocial,
  facebookSignIn,
  updateUser,
  changePassword,
  forgotPassword,
  resetPassword,
  googleSignIn,
  getProfile,
  updateProfile,
  changeEmail,
  changePhone,
  removeEmail,
  removePhone,
  deleteAccount,
  unsubscribeFromReminders,
  unsubscribeFromPaymentReminders,
  getOnboardingStatus,
  verifyEmail,
  resendVerification,
  updateLastCompany,
};
