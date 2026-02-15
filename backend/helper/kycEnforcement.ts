/**
 * Shared KYC enforcement logic.
 * Extracts the volume check + threshold + grace period logic used by both
 * checkout (cryptoVerification) and payment creation endpoints.
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import { kycModel } from "../models";
import { cronLogger } from "../utils/loggers";

const KYC_THRESHOLD_USD = 10000;
const KYC_GRACE_PERIOD_DAYS = 90;

export interface KycCheckResult {
  /** Whether volume exceeds threshold */
  needsEnforcement: boolean;
  totalVolume: number;
  kycStatus: string;
  /** True if grace period has expired and KYC is not approved */
  blocked: boolean;
  daysRemaining?: number;
  thresholdDate?: Date | null;
  gracePeriodEnd?: Date | null;
  veriffSessionUrl?: string | null;
  hasActiveSession?: boolean;
}

/**
 * Check KYC enforcement for a user/company.
 * Returns an object describing whether the user is blocked, in grace period, or approved.
 */
export async function checkKycEnforcement(
  userId: string | number,
  companyId?: string | number | null,
  logPrefix: string = '[KYC]',
): Promise<KycCheckResult> {
  // Calculate total transaction volume
  const volumeQuery = companyId
    ? `SELECT COALESCE(SUM(CAST(base_amount AS DECIMAL)), 0) as total_volume 
       FROM tbl_customer_transaction 
       WHERE company_id = :companyId AND status = 'successful'`
    : `SELECT COALESCE(SUM(CAST(base_amount AS DECIMAL)), 0) as total_volume 
       FROM tbl_customer_transaction 
       WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId) AND status = 'successful'`;

  const volumeResult = await sequelize.query<{ total_volume: string }>(
    volumeQuery,
    {
      replacements: { userId, companyId },
      type: QueryTypes.SELECT,
    }
  );

  const totalVolume = parseFloat(String(volumeResult[0]?.total_volume || "0"));

  if (totalVolume < KYC_THRESHOLD_USD) {
    return { needsEnforcement: false, totalVolume, kycStatus: 'not_required', blocked: false };
  }

  // KYC is required — check status
  const kycWhereClause: Record<string, unknown> = { user_id: userId };
  if (companyId) kycWhereClause.company_id = companyId;

  const kycRecord = await kycModel.findOne({
    where: kycWhereClause,
    order: [["created_at", "DESC"]],
  });

  const kycStatus = kycRecord ? kycRecord.get("status") as string : "not_started";
  const veriffSessionUrl = kycRecord ? kycRecord.get("veriff_session_url") as string | null : null;
  const hasActiveSession = !!(veriffSessionUrl && ["submitted", "pending"].includes(kycStatus));

  if (kycStatus === "approved") {
    cronLogger.info(`${logPrefix} User ${userId} KYC approved. Volume: $${totalVolume.toFixed(2)}`);
    return { needsEnforcement: true, totalVolume, kycStatus, blocked: false, veriffSessionUrl, hasActiveSession };
  }

  // Not approved — check grace period
  const thresholdReachedQuery = companyId
    ? `SELECT MIN("createdAt") as threshold_date
       FROM (
         SELECT "createdAt", 
                SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
         FROM tbl_customer_transaction 
         WHERE company_id = :companyId AND status = 'successful'
       ) sub
       WHERE running_total >= :threshold`
    : `SELECT MIN("createdAt") as threshold_date
       FROM (
         SELECT "createdAt", 
                SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
         FROM tbl_customer_transaction 
         WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId) AND status = 'successful'
       ) sub
       WHERE running_total >= :threshold`;

  const thresholdResult = await sequelize.query<{ threshold_date: string }>(
    thresholdReachedQuery,
    {
      replacements: { userId, companyId, threshold: KYC_THRESHOLD_USD },
      type: QueryTypes.SELECT,
    }
  );

  const thresholdDate = thresholdResult[0]?.threshold_date ? new Date(thresholdResult[0].threshold_date) : null;

  if (!thresholdDate) {
    cronLogger.warn(`${logPrefix} Could not determine threshold date for user ${userId}. Allowing.`);
    return { needsEnforcement: true, totalVolume, kycStatus, blocked: false, thresholdDate: null, veriffSessionUrl, hasActiveSession };
  }

  const now = new Date();
  const gracePeriodEnd = new Date(thresholdDate);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + KYC_GRACE_PERIOD_DAYS);
  const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const blocked = now >= gracePeriodEnd;

  if (blocked) {
    cronLogger.info(`${logPrefix} User ${userId} grace period expired. Volume: $${totalVolume.toFixed(2)}, KYC status: ${kycStatus}`);
  } else {
    cronLogger.info(`${logPrefix} User ${userId} within grace period. Volume: $${totalVolume.toFixed(2)}, Days remaining: ${daysRemaining}`);
  }

  return {
    needsEnforcement: true,
    totalVolume,
    kycStatus,
    blocked,
    daysRemaining,
    thresholdDate,
    gracePeriodEnd,
    veriffSessionUrl,
    hasActiveSession,
  };
}

export { KYC_THRESHOLD_USD, KYC_GRACE_PERIOD_DAYS };
