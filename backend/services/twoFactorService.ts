/**
 * Two-Factor Authentication Service
 * 
 * Implements TOTP-based 2FA with backup codes.
 * Uses otplib for TOTP generation/verification.
 */
import { authenticator } from "otplib";
import crypto from "crypto";
import User2FA from "../models/securityModels/user2FAModel";
import { userLogger } from "../utils/loggers";
import QRCode from "qrcode";

// Configuration
authenticator.options = {
  window: 1, // Allow 1 step tolerance (30 seconds before/after)
};

const APP_NAME = process.env.APP_NAME || "DynoPay";
const BACKUP_CODE_COUNT = 10;
const MAX_2FA_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Generate backup codes
 */
const generateBackupCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Format: XXXX-XXXX (8 chars with dash)
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
};

/**
 * Hash backup codes for storage
 */
const hashBackupCodes = (codes: string[]): string[] => {
  return codes.map((code) =>
    crypto.createHash("sha256").update(code.replace("-", "")).digest("hex")
  );
};

/**
 * Setup 2FA for a user — generates secret and QR code
 * Does NOT enable 2FA yet — user must verify first
 */
export const setup2FA = async (
  userId: number,
  email: string
): Promise<{ secret: string; qr_code: string; backup_codes: string[] }> => {
  // Check if already enabled
  const existing = await User2FA.findOne({ where: { user_id: userId } });
  if (existing && existing.is_enabled) {
    throw new Error("2FA is already enabled. Disable it first to reconfigure.");
  }

  // Generate TOTP secret
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, APP_NAME, secret);

  // Generate QR code as data URL
  const qr_code = await QRCode.toDataURL(otpauth);

  // Generate backup codes
  const plainBackupCodes = generateBackupCodes();
  const hashedBackupCodes = hashBackupCodes(plainBackupCodes);

  // Upsert 2FA record (not enabled yet)
  if (existing) {
    await existing.update({
      secret,
      backup_codes: hashedBackupCodes,
      is_enabled: false,
      failed_attempts: 0,
      locked_until: null,
    });
  } else {
    await User2FA.create({
      user_id: userId,
      secret,
      backup_codes: hashedBackupCodes,
      is_enabled: false,
      method: "totp",
      failed_attempts: 0,
    });
  }

  userLogger.info(`[2FA] Setup initiated for user ${userId}`);

  return {
    secret, // For manual entry
    qr_code, // Data URL for QR code
    backup_codes: plainBackupCodes, // Show ONCE to user
  };
};

/**
 * Verify and enable 2FA — user must provide a valid TOTP code
 */
export const verify2FASetup = async (userId: number, token: string): Promise<boolean> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });
  if (!record) throw new Error("2FA setup not found. Please initiate setup first.");
  if (record.is_enabled) throw new Error("2FA is already enabled.");

  const isValid = authenticator.verify({ token, secret: record.secret });

  if (!isValid) {
    throw new Error("Invalid verification code. Please try again with a fresh code from your authenticator app.");
  }

  await record.update({
    is_enabled: true,
    enabled_at: new Date(),
    failed_attempts: 0,
  });

  userLogger.info(`[2FA] Enabled for user ${userId}`);
  return true;
};

/**
 * Validate a 2FA token during login
 */
export const validate2FAToken = async (
  userId: number,
  token: string
): Promise<{ valid: boolean; method: string }> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });
  if (!record || !record.is_enabled) {
    return { valid: true, method: "none" }; // 2FA not enabled, skip
  }

  // Check lockout
  if (record.locked_until && new Date() < new Date(record.locked_until)) {
    const remaining = Math.ceil((new Date(record.locked_until).getTime() - Date.now()) / 60000);
    throw new Error(`2FA verification locked. Try again in ${remaining} minutes.`);
  }

  // Try TOTP first
  const isTOTPValid = authenticator.verify({ token, secret: record.secret });

  if (isTOTPValid) {
    await record.update({
      last_used_at: new Date(),
      failed_attempts: 0,
      locked_until: null,
    });
    return { valid: true, method: "totp" };
  }

  // Try backup code
  const normalizedToken = token.replace("-", "");
  const hashedToken = crypto.createHash("sha256").update(normalizedToken).digest("hex");

  if (record.backup_codes && record.backup_codes.includes(hashedToken)) {
    // Remove used backup code
    const updatedCodes = record.backup_codes.filter((c) => c !== hashedToken);
    await record.update({
      backup_codes: updatedCodes,
      last_used_at: new Date(),
      failed_attempts: 0,
      locked_until: null,
    });
    userLogger.info(`[2FA] Backup code used by user ${userId}. Remaining: ${updatedCodes.length}`);
    return { valid: true, method: "backup_code" };
  }

  // Failed attempt
  const newAttempts = (record.failed_attempts || 0) + 1;
  const updates: Record<string, unknown> = { failed_attempts: newAttempts };

  if (newAttempts >= MAX_2FA_FAILED_ATTEMPTS) {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
    updates.locked_until = lockUntil;
    userLogger.warn(`[2FA] User ${userId} locked after ${newAttempts} failed 2FA attempts`);
  }

  await record.update(updates);
  return { valid: false, method: "failed" };
};

/**
 * Disable 2FA for a user
 */
export const disable2FA = async (userId: number): Promise<boolean> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });
  if (!record || !record.is_enabled) {
    throw new Error("2FA is not currently enabled.");
  }

  await record.update({
    is_enabled: false,
    failed_attempts: 0,
    locked_until: null,
  });

  userLogger.info(`[2FA] Disabled for user ${userId}`);
  return true;
};

/**
 * Regenerate backup codes
 */
export const regenerateBackupCodes = async (userId: number): Promise<string[]> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });
  if (!record || !record.is_enabled) {
    throw new Error("2FA must be enabled to regenerate backup codes.");
  }

  const plainCodes = generateBackupCodes();
  const hashedCodes = hashBackupCodes(plainCodes);

  await record.update({ backup_codes: hashedCodes });

  userLogger.info(`[2FA] Backup codes regenerated for user ${userId}`);
  return plainCodes;
};

/**
 * Get 2FA status for a user
 */
export const get2FAStatus = async (userId: number): Promise<{
  enabled: boolean;
  method: string;
  backup_codes_remaining: number;
  enabled_at: Date | null;
  last_used_at: Date | null;
}> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });

  if (!record) {
    return { enabled: false, method: "none", backup_codes_remaining: 0, enabled_at: null, last_used_at: null };
  }

  return {
    enabled: record.is_enabled,
    method: record.method,
    backup_codes_remaining: record.backup_codes?.length || 0,
    enabled_at: record.enabled_at || null,
    last_used_at: record.last_used_at || null,
  };
};

/**
 * Check if 2FA is required for login (is it enabled for this user?)
 */
export const is2FARequired = async (userId: number): Promise<boolean> => {
  const record = await User2FA.findOne({
    where: { user_id: userId, is_enabled: true },
    attributes: ["is_enabled"],
  });
  return !!record;
};

export default {
  setup2FA,
  verify2FASetup,
  validate2FAToken,
  disable2FA,
  regenerateBackupCodes,
  get2FAStatus,
  is2FARequired,
};
