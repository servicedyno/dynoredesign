/**
 * Trial Conversion Service
 * 
 * Handles the conversion of trial payment links to full merchant accounts.
 * 
 * Flow:
 * 1. Visitor creates trial payment link (no account)
 * 2. Customer pays via crypto
 * 3. Visitor receives "funds waiting" notification
 * 4. Visitor claims funds → account created → funds released
 * 
 * This service handles step 4: account creation and fund release.
 */

import { apiLogger } from "../utils/loggers";
import trialPaymentLinkModel from "../models/trialPaymentLinkModel";

/**
 * Mark a trial link as paid (called from webhook processing / cryptoVerification)
 * Accepts trial link ID directly (from the payment_link_id lookup)
 */
export const markTrialLinkPaid = async (
  trialLinkId: number,
  paidCurrency: string,
  paidAmountCrypto: number,
  txHash: string
): Promise<boolean> => {
  try {
    const trialLink = await trialPaymentLinkModel.findByPk(trialLinkId);
    if (!trialLink) {
      apiLogger.warn(`[TrialConversion] Trial link not found for id: ${trialLinkId}`);
      return false;
    }

    const data = trialLink.get({ plain: true }) as any;
    if (data.status !== "active") {
      apiLogger.warn(`[TrialConversion] Trial link ${data.slug} is not active (status: ${data.status})`);
      return false;
    }

    // Calculate claim expiry (72h from now)
    const claimExpiresAt = new Date(
      Date.now() + (parseInt(process.env.TRIAL_CLAIM_EXPIRY_HOURS || "72") * 60 * 60 * 1000)
    );

    await trialPaymentLinkModel.update(
      {
        status: "paid",
        paid_amount_crypto: paidAmountCrypto,
        paid_currency: paidCurrency,
        paid_tx_hash: txHash,
        paid_at: new Date(),
        claim_expires_at: claimExpiresAt,
      },
      { where: { id: data.id } }
    );

    apiLogger.info(
      `[TrialConversion] Trial link ${data.slug} marked as paid: ${paidAmountCrypto} ${paidCurrency} (tx: ${txHash})`
    );

    return true;
  } catch (error: any) {
    apiLogger.error(`[TrialConversion] Error marking trial link paid: ${error.message}`);
    return false;
  }
};

/**
 * Expire stale trial links
 * - Active links older than 24h → expired
 * - Paid but unclaimed links older than 72h → flag for refund
 */
export const expireStaleTrialLinks = async (): Promise<{ expired: number; refundNeeded: number }> => {
  try {
    const now = new Date();

    // Expire unpaid active links
    const [expiredCount] = await trialPaymentLinkModel.update(
      { status: "expired" },
      {
        where: {
          status: "active",
          expires_at: { [require("sequelize").Op.lt]: now },
        },
      }
    );

    // Flag unclaimed paid links for refund
    const [refundCount] = await trialPaymentLinkModel.update(
      { status: "refunded" },
      {
        where: {
          status: "paid",
          claim_expires_at: { [require("sequelize").Op.lt]: now },
        },
      }
    );

    if (expiredCount > 0 || refundCount > 0) {
      apiLogger.info(
        `[TrialConversion] Cleanup: ${expiredCount} expired, ${refundCount} flagged for refund`
      );
    }

    return { expired: expiredCount, refundNeeded: refundCount };
  } catch (error: any) {
    apiLogger.error(`[TrialConversion] Error expiring stale links: ${error.message}`);
    return { expired: 0, refundNeeded: 0 };
  }
};

export default {
  markTrialLinkPaid,
  expireStaleTrialLinks,
};
