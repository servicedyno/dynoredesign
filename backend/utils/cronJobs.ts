import cron from "node-cron";
import { QueryTypes } from "sequelize";
import sequelize from "./dbInstance";
import { createNotification, NOTIFICATION_TYPES } from "../controller";
import { notificationPreferencesModel, userTransactionModel } from "../models";
import { cronLogger, log } from "./loggers";
import { captureError } from "../services/errorMonitoringService";
// Unused imports removed from top level - dynamically imported where needed

/**
 * Weekly Summary Cron Job
 * Schedule: Every Monday at 9:00 AM UTC
 * Logic:
 * 1. Find users with weekly_summary = true in their preferences
 * 2. Aggregate past 7 days: transactions count, volume, fees
 * 3. Create notification record
 * 4. (Future: Send email with summary via Email Service)
 */
export const setupWeeklySummaryCron = () => {
  // Run every Monday at 9:00 AM UTC
  // Cron format: minute hour day-of-month month day-of-week
  // 0 9 * * 1 = At 09:00 on Monday
  cron.schedule("0 9 * * 1", async () => {
    log("Weekly Summary Cron Job starting...", "info");
    
    try {
      // Get date range for last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Find all users with weekly_summary enabled
      const usersWithWeeklySummary = await sequelize.query(
        `SELECT DISTINCT np.user_id, np.company_id, u.name, u.email
         FROM tbl_notification_preferences np
         JOIN tbl_user u ON u.user_id = np.user_id
         WHERE np.weekly_summary = true`,
        { type: QueryTypes.SELECT }
      ) as Array<Record<string, unknown>>;

      log(`Found ${usersWithWeeklySummary.length} users with weekly summary enabled`, "info");

      for (const user of usersWithWeeklySummary) {
        try {
          // Get transaction summary for this user
          const summary = await sequelize.query(
            `SELECT 
              COUNT(*) as transaction_count,
              COALESCE(SUM(CASE WHEN status = 'done' THEN base_amount ELSE 0 END), 0) as total_volume,
              COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) as completed_count,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
              COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed_count
             FROM tbl_user_transaction 
             WHERE user_id = :userId 
             AND "createdAt" >= :startDate
             AND "createdAt" <= :endDate`,
            {
              replacements: { 
                userId: user.user_id, 
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
              },
              type: QueryTypes.SELECT,
            }
          ) as Array<Record<string, unknown>>;

          const stats = summary[0] || {
            transaction_count: 0,
            total_volume: 0,
            completed_count: 0,
            pending_count: 0,
            failed_count: 0,
          };

          // Define interface for stats
          interface WeeklyStats {
            transaction_count: string | number;
            total_volume: string | number;
            completed_count: string | number;
            pending_count: string | number;
            failed_count: string | number;
            total_count?: string | number;
            top_currency?: string;
          }

          const typedStats = stats as unknown as WeeklyStats;

          // Create notification with summary data
          const notificationData = {
            period_start: startDate.toISOString().split('T')[0],
            period_end: endDate.toISOString().split('T')[0],
            transaction_count: parseInt(String(typedStats.transaction_count)),
            total_volume: parseFloat(String(typedStats.total_volume)),
            completed_count: parseInt(String(typedStats.completed_count)),
            pending_count: parseInt(String(typedStats.pending_count)),
            failed_count: parseInt(String(typedStats.failed_count)),
          };

          const title = "Your Weekly Summary";
          const totalVolume = parseFloat(String(typedStats.total_volume));
          const message = `This week you had ${typedStats.transaction_count} transactions with a total volume of $${totalVolume.toFixed(2)}. ${typedStats.completed_count} completed, ${typedStats.pending_count} pending.`;

          await createNotification(
            Number(user.user_id),
            NOTIFICATION_TYPES.WEEKLY_SUMMARY,
            title,
            message,
            notificationData,
            Number(user.company_id)
          );

          log(`Weekly summary created for user ${user.user_id}`, "info");

          // Send weekly summary email
          try {
            const { sendWeeklySummaryEmail } = await import("../services/emailService");
            const periodStart = startDate.toISOString().split('T')[0];
            const periodEnd = endDate.toISOString().split('T')[0];
            await sendWeeklySummaryEmail(
              String(user.email),
              String(user.name || ''),
              periodStart,
              periodEnd,
              Number(typedStats.total_count || typedStats.transaction_count || 0),
              totalVolume.toFixed(2),
              Number(typedStats.completed_count || 0),
              Number(typedStats.pending_count || 0),
              String(typedStats.top_currency || "N/A")
            );
            log(`Weekly summary email sent to ${user.email}`, "info");
          } catch (emailError) {
            log(`Failed to send weekly summary email to ${user.email}: ${emailError}`, "error");
          }

        } catch (userError) {
          log(`Error creating weekly summary for user ${user.user_id}: ${userError}`, "error");
        }
      }

      log("Weekly Summary Cron Job completed", "info");
      
    } catch (e) {
      log(`Weekly Summary Cron Job Error: ${e}`, "error");
      cronLogger?.error?.("Weekly Summary Cron Error", {}, new Error(String(e)));
      captureError(e, 'cron', { extraContext: 'setupWeeklySummaryCron' });
    }
  });

  log("Weekly Summary Cron Job scheduled for every Monday at 9:00 AM UTC", "info");
};

/**
 * Trigger weekly summary manually (for testing)
 */
export const triggerWeeklySummary = async (userId?: number) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    let users: Array<Record<string, unknown>>;

    if (userId) {
      // Get specific user
      users = await sequelize.query(
        `SELECT u.user_id, u.name, u.email, np.company_id
         FROM tbl_user u
         LEFT JOIN tbl_notification_preferences np ON np.user_id = u.user_id
         WHERE u.user_id = :userId`,
        { 
          replacements: { userId },
          type: QueryTypes.SELECT 
        }
      ) as Array<Record<string, unknown>>;
    } else {
      // Get all users with weekly summary enabled
      users = await sequelize.query(
        `SELECT DISTINCT np.user_id, np.company_id, u.name, u.email
         FROM tbl_notification_preferences np
         JOIN tbl_user u ON u.user_id = np.user_id
         WHERE np.weekly_summary = true`,
        { type: QueryTypes.SELECT }
      ) as Array<Record<string, unknown>>;
    }

    const results = [];

    for (const user of users) {
      const summary = await sequelize.query(
        `SELECT 
          COUNT(*) as transaction_count,
          COALESCE(SUM(CASE WHEN status = 'done' THEN base_amount ELSE 0 END), 0) as total_volume,
          COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) as completed_count,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed_count
         FROM tbl_user_transaction 
         WHERE user_id = :userId 
         AND "createdAt" >= :startDate
         AND "createdAt" <= :endDate`,
        {
          replacements: { 
            userId: String(user.user_id), 
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
          type: QueryTypes.SELECT,
        }
      ) as Array<Record<string, unknown>>;

      const stats = summary[0];

      // Define interface for stats
      interface SummaryStats {
        transaction_count: string | number;
        total_volume: string | number;
        completed_count: string | number;
        pending_count: string | number;
        failed_count: string | number;
      }

      const typedStats = stats as unknown as SummaryStats;
      const totalVolume = parseFloat(String(typedStats.total_volume || 0));

      const notificationData = {
        period_start: startDate.toISOString().split('T')[0],
        period_end: endDate.toISOString().split('T')[0],
        transaction_count: parseInt(String(typedStats.transaction_count)),
        total_volume: totalVolume,
        completed_count: parseInt(String(typedStats.completed_count)),
        pending_count: parseInt(String(typedStats.pending_count)),
        failed_count: parseInt(String(typedStats.failed_count)),
      };

      const notification = await createNotification(
        Number(user.user_id),
        NOTIFICATION_TYPES.WEEKLY_SUMMARY,
        "Your Weekly Summary",
        `This week you had ${typedStats.transaction_count} transactions with a total volume of $${totalVolume.toFixed(2)}.`,
        notificationData,
        Number(user.company_id)
      );

      results.push({
        user_id: user.user_id,
        notification,
        summary: notificationData,
      });
    }

    return results;

  } catch (e) {
    console.error("Trigger weekly summary error:", e);
    captureError(e, 'cron', { extraContext: 'triggerWeeklySummary' });
    throw e;
  }
};

/**
 * Wallet Reminder Cron Job
 * Schedule: Every hour
 * Logic:
 * 1. Find users who registered 24 hours ago
 * 2. Check if they have any wallet addresses
 * 3. If not, send wallet reminder email
 * 4. Mark as reminded to avoid duplicates
 */
export const setupWalletReminderCron = () => {
  // Run every hour
  // Cron format: minute hour day-of-month month day-of-week
  // 0 * * * * = At minute 0 of every hour
  cron.schedule("0 * * * *", async () => {
    log("Wallet Reminder Cron Job starting...", "info");
    
    try {
      // Get date 24 hours ago
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      // Get date 25 hours ago (1 hour window)
      const twentyFiveHoursAgo = new Date();
      twentyFiveHoursAgo.setHours(twentyFiveHoursAgo.getHours() - 25);

      // Find users who:
      // 1. Registered between 25-24 hours ago
      // 2. Have at least one company created
      // 3. Have no wallet addresses
      // 4. Haven't been reminded yet
      const usersWithoutWallets = await sequelize.query(
        `SELECT DISTINCT u.user_id, u.name, u.email, c.company_id, c.company_name,
                COALESCE(u.wallet_reminder_sent, false) as wallet_reminder_sent
         FROM tbl_user u
         LEFT JOIN tbl_company c ON c.user_id = u.user_id
         LEFT JOIN tbl_user_addresses wa ON wa.user_id = u.user_id AND wa.company_id = c.company_id
         WHERE u."createdAt" >= :twentyFiveHoursAgo
         AND u."createdAt" <= :twentyFourHoursAgo
         AND c.company_id IS NOT NULL
         AND wa.user_address_id IS NULL
         AND COALESCE(u.wallet_reminder_sent, false) = false`,
        {
          replacements: { 
            twentyFourHoursAgo: twentyFourHoursAgo.toISOString(),
            twentyFiveHoursAgo: twentyFiveHoursAgo.toISOString()
          },
          type: QueryTypes.SELECT
        }
      ) as Array<Record<string, unknown>>;

      log(`Found ${usersWithoutWallets.length} users without wallets to remind`, "info");

      for (const user of usersWithoutWallets) {
        try {
          // Send wallet reminder email
          const { sendAddWalletReminderEmail } = await import("../services/emailService");
          await sendAddWalletReminderEmail(String(user.email), String(user.name), String(user.company_name));

          // Mark user as reminded
          await sequelize.query(
            `UPDATE tbl_user SET wallet_reminder_sent = true WHERE user_id = :userId`,
            {
              replacements: { userId: user.user_id },
              type: QueryTypes.UPDATE
            }
          );

          log(`Wallet reminder sent to user ${user.user_id} (${user.email})`, "info");

        } catch (userError) {
          log(`Error sending wallet reminder to user ${user.user_id}: ${userError}`, "error");
        }
      }

      log("Wallet Reminder Cron Job completed", "info");
      
    } catch (e) {
      log(`Wallet Reminder Cron Job Error: ${e}`, "error");
      cronLogger?.error?.("Wallet Reminder Cron Error", {}, new Error(String(e)));
      captureError(e, 'cron', { extraContext: 'setupWalletReminderCron' });
    }
  });

  log("Wallet Reminder Cron Job scheduled for every hour", "info");
};

/**
 * Trigger wallet reminder manually (for testing)
 */
export const triggerWalletReminder = async (userId?: number) => {
  try {
    let users: Array<Record<string, unknown>>;

    if (userId) {
      // Get specific user
      users = await sequelize.query(
        `SELECT u.user_id, u.name, u.email, c.company_id, c.company_name
         FROM tbl_user u
         LEFT JOIN tbl_company c ON c.user_id = u.user_id
         LEFT JOIN tbl_user_addresses wa ON wa.user_id = u.user_id AND wa.company_id = c.company_id
         WHERE u.user_id = :userId
         AND c.company_id IS NOT NULL
         AND wa.user_address_id IS NULL`,
        { 
          replacements: { userId },
          type: QueryTypes.SELECT 
        }
      ) as Array<Record<string, unknown>>;
    } else {
      // Get all users without wallets (for testing)
      users = await sequelize.query(
        `SELECT DISTINCT u.user_id, u.name, u.email, c.company_id, c.company_name
         FROM tbl_user u
         LEFT JOIN tbl_company c ON c.user_id = u.user_id
         LEFT JOIN tbl_user_addresses wa ON wa.user_id = u.user_id AND wa.company_id = c.company_id
         WHERE c.company_id IS NOT NULL
         AND wa.user_address_id IS NULL
         LIMIT 10`,
        { type: QueryTypes.SELECT }
      ) as Array<Record<string, unknown>>;
    }

    const results = [];

    for (const user of users as Array<{ user_id: number; email: string; name: string; company_name: string }>) {
      const { sendAddWalletReminderEmail } = await import("../services/emailService");
      await sendAddWalletReminderEmail(user.email, user.name, user.company_name);

      results.push({
        user_id: user.user_id,
        email: user.email,
        company_name: user.company_name,
        reminder_sent: true
      });
    }

    return results;

  } catch (e) {
    console.error("Trigger wallet reminder error:", e);
    captureError(e, 'cron', { extraContext: 'triggerWalletReminder' });
    throw e;
  }
};

/**
 * Infrastructure Health Check Cron Job
 * Schedule: Every 15 minutes (OPTIMIZED: was every-5-min, health rarely changes that fast)
 * Logic: Run health checks on all monitored services and store results
 * Savings: 288 to 96 runs/day, ~1440 to ~480 DB rows/day
 */
export const setupHealthCheckCron = () => {
  // OPTIMIZED: Reduced from */5 to */15 — 3x fewer DB writes, health status rarely changes in 5 min
  cron.schedule("*/15 * * * *", async () => {
    try {
      const monitoringService = require("../services/monitoringService").default;
      await monitoringService.runHealthChecks();
    } catch (e) {
      log(`Health Check Cron Job Error: ${e}`, "error");
      captureError(e, 'cron', { extraContext: 'setupHealthCheckCron' });
    }
  });

  // Prune health check records older than 7 days — runs daily at 3:00 AM UTC
  // Prevents unbounded tbl_service_health growth (~480 rows/day × 7 days = ~3,360 rows max)
  cron.schedule("0 3 * * *", async () => {
    try {
      const monitoringService = require("../services/monitoringService").default;
      await monitoringService.pruneOldHealthChecks();
    } catch (e) {
      log(`Health Check Pruning Error: ${e}`, "error");
      captureError(e, 'cron', { extraContext: 'pruneOldHealthChecks' });
    }
  });

  log("Health Check Cron Job scheduled for every 15 minutes", "info");
  log("Health Check Retention Cleanup scheduled daily at 3:00 AM UTC (7-day retention)", "info");
};

/**
 * Referee Code Reminder Cron Job
 * Schedule: Daily at 10:00 AM UTC
 * Logic: Send weekly reminders to users with unused referee codes
 * - Week 1 (7 days): "Don't forget your offer"
 * - Week 2 (14 days): "Your discount is waiting"
 * - Week 3 (21 days): "Only X days left"
 * - Final (27 days): "Last chance - expires in 3 days"
 */
export const setupRefereeCodeReminderCron = () => {
  // Run daily at 10:00 AM UTC
  cron.schedule("0 10 * * *", async () => {
    log("Referee Code Reminder Cron Job starting...", "info");
    
    try {
      const { sendRefereeCodeReminderEmail } = await import("../helper");
      const { refereeCodeModel, userModel } = await import("../models");
      const { Op } = await import("sequelize");
      
      const now = new Date();
      
      // Find all active (sent) referee codes that:
      // 1. Are not expired
      // 2. Have not been unsubscribed
      // 3. Need a reminder based on their age
      const activeCodes = await refereeCodeModel.findAll({
        where: {
          status: 'sent',
          expires_at: { [Op.gt]: now },
          unsubscribed_at: null,
        },
      });
      
      log(`Found ${activeCodes.length} active referee codes to check for reminders`, "info");
      
      let remindersSent = 0;
      let skippedAlreadySignedUp = 0;
      
      for (const code of activeCodes) {
        try {
          const codeData = code.dataValues;
          const sentAt = new Date(codeData.sent_at);
          const expiresAt = new Date(codeData.expires_at);
          const daysSinceSent = Math.floor((now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24));
          const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // Check if user has already signed up with this email
          const existingUser = await userModel.findOne({
            where: { email: codeData.customer_email },
          });
          
          if (existingUser) {
            skippedAlreadySignedUp++;
            continue; // Skip - user already signed up
          }
          
          let reminderType: 'week1' | 'week2' | 'week3' | 'final' | null = null;
          let reminderColumn: string | null = null;
          
          // Determine which reminder to send based on days since sent
          if (daysSinceSent >= 27 && !codeData.final_reminder_sent_at) {
            reminderType = 'final';
            reminderColumn = 'final_reminder_sent_at';
          } else if (daysSinceSent >= 21 && !codeData.reminder_3_sent_at) {
            reminderType = 'week3';
            reminderColumn = 'reminder_3_sent_at';
          } else if (daysSinceSent >= 14 && !codeData.reminder_2_sent_at) {
            reminderType = 'week2';
            reminderColumn = 'reminder_2_sent_at';
          } else if (daysSinceSent >= 7 && !codeData.reminder_1_sent_at) {
            reminderType = 'week1';
            reminderColumn = 'reminder_1_sent_at';
          }
          
          if (reminderType && reminderColumn) {
            // Send reminder email
            await sendRefereeCodeReminderEmail(
              codeData.customer_email,
              codeData.code,
              Number(codeData.discount_percent),
              codeData.discount_duration_days,
              daysRemaining,
              reminderType,
              codeData.unsubscribe_token
            );
            
            // Mark reminder as sent
            await refereeCodeModel.update(
              { [reminderColumn]: now },
              { where: { code_id: codeData.code_id } }
            );
            
            remindersSent++;
            log(`Sent ${reminderType} reminder to ${codeData.customer_email} (code: ${codeData.code})`, "info");
          }
        } catch (codeError: unknown) {
          const err = codeError as { message?: string };
          log(`Error processing referee code ${code.dataValues.code}: ${err.message}`, "error");
        }
      }
      
      log(`Referee Code Reminder Cron completed: ${remindersSent} reminders sent, ${skippedAlreadySignedUp} skipped (already signed up)`, "info");
      
    } catch (e: unknown) {
      const err = e as { message?: string };
      log(`Referee Code Reminder Cron Job Error: ${err.message}`, "error");
      cronLogger?.error?.("Referee Code Reminder Cron Error", {}, new Error(err.message));
    }
  });
  
  log("Referee Code Reminder Cron Job scheduled for daily at 10:00 AM UTC", "info");
};

/**
 * Manually trigger referee code reminders (for testing)
 */
export const triggerRefereeCodeReminders = async () => {
  log("Manually triggering Referee Code Reminders...", "info");
  
  const { sendRefereeCodeReminderEmail } = await import("../helper");
  const { refereeCodeModel, userModel } = await import("../models");
  const { Op } = await import("sequelize");
  
  const now = new Date();
  
  const activeCodes = await refereeCodeModel.findAll({
    where: {
      status: 'sent',
      expires_at: { [Op.gt]: now },
      unsubscribed_at: null,
    },
  });
  
  const results = {
    total: activeCodes.length,
    reminders_sent: 0,
    skipped_already_signed_up: 0,
    skipped_no_reminder_due: 0,
    details: [] as Array<Record<string, unknown>>,
  };
  
  for (const code of activeCodes) {
    const codeData = code.dataValues;
    const sentAt = new Date(codeData.sent_at);
    const expiresAt = new Date(codeData.expires_at);
    const daysSinceSent = Math.floor((now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if user has already signed up
    const existingUser = await userModel.findOne({
      where: { email: codeData.customer_email },
    });
    
    if (existingUser) {
      results.skipped_already_signed_up++;
      results.details.push({
        email: codeData.customer_email,
        code: codeData.code,
        status: 'skipped_already_signed_up',
      });
      continue;
    }
    
    let reminderType: 'week1' | 'week2' | 'week3' | 'final' | null = null;
    let reminderColumn: string | null = null;
    
    if (daysSinceSent >= 27 && !codeData.final_reminder_sent_at) {
      reminderType = 'final';
      reminderColumn = 'final_reminder_sent_at';
    } else if (daysSinceSent >= 21 && !codeData.reminder_3_sent_at) {
      reminderType = 'week3';
      reminderColumn = 'reminder_3_sent_at';
    } else if (daysSinceSent >= 14 && !codeData.reminder_2_sent_at) {
      reminderType = 'week2';
      reminderColumn = 'reminder_2_sent_at';
    } else if (daysSinceSent >= 7 && !codeData.reminder_1_sent_at) {
      reminderType = 'week1';
      reminderColumn = 'reminder_1_sent_at';
    }
    
    if (reminderType && reminderColumn) {
      await sendRefereeCodeReminderEmail(
        codeData.customer_email,
        codeData.code,
        Number(codeData.discount_percent),
        codeData.discount_duration_days,
        daysRemaining,
        reminderType,
        codeData.unsubscribe_token
      );
      
      await refereeCodeModel.update(
        { [reminderColumn]: now },
        { where: { code_id: codeData.code_id } }
      );
      
      results.reminders_sent++;
      results.details.push({
        email: codeData.customer_email,
        code: codeData.code,
        reminder_type: reminderType,
        days_since_sent: daysSinceSent,
        days_remaining: daysRemaining,
        status: 'sent',
      });
    } else {
      results.skipped_no_reminder_due++;
      results.details.push({
        email: codeData.customer_email,
        code: codeData.code,
        days_since_sent: daysSinceSent,
        status: 'no_reminder_due',
      });
    }
  }
  
  return results;
};

/**
 * Payment Link Reminder Cron Job
 * Schedule: Every hour
 * Logic: Send reminders to customers with unpaid payment links
 * 
 * Reminder schedule based on expiry:
 * - 24h expiry: 6h, 18h, 23h after creation
 * - 7d expiry: Day 2, Day 5, Day 7 (few hours before)
 * - 30d expiry: Day 7, Day 21, Day 29
 * - No expiry: Day 7, Day 30, Day 60
 */
export const setupPaymentLinkReminderCron = () => {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    log("Payment Link Reminder Cron Job starting...", "info");
    
    try {
      const { sendPaymentLinkReminderEmail } = await import("../helper");
      const { paymentLinkModel, companyModel } = await import("../models");
      const { Op } = await import("sequelize");
      
      const now = new Date();
      
      // Find all pending payment links with email that:
      // 1. Have status = 'pending'
      // 2. Have an email address
      // 3. Are not expired (or have no expiry)
      // 4. Have not been unsubscribed
      const pendingLinks = await paymentLinkModel.findAll({
        where: {
          status: 'pending',
          email: { [Op.not]: null },
          unsubscribed_at: null,
          [Op.or]: [
            { expires_at: null },
            { expires_at: { [Op.gt]: now } },
          ],
        },
      });
      
      log(`Found ${pendingLinks.length} pending payment links to check for reminders`, "info");
      
      let remindersSent = 0;
      
      for (const link of pendingLinks) {
        try {
          const linkData = link.dataValues;
          const createdAt = new Date(linkData.createdAt);
          const expiresAt = linkData.expires_at ? new Date(linkData.expires_at) : null;
          
          // Calculate hours/days since creation
          const hoursSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
          const daysSinceCreation = Math.floor(hoursSinceCreation / 24);
          
          // Determine expiry type
          let expiryType: '24h' | '7d' | '30d' | 'none' = 'none';
          if (expiresAt) {
            const totalHours = Math.floor((expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
            if (totalHours <= 25) expiryType = '24h';
            else if (totalHours <= 168 + 1) expiryType = '7d'; // 7 days
            else expiryType = '30d';
          }
          
          let reminderType: 'reminder1' | 'reminder2' | 'final' | null = null;
          let reminderColumn: string | null = null;
          
          // Determine which reminder to send based on expiry type and time elapsed
          switch (expiryType) {
            case '24h':
              // 6h, 18h, 23h
              if (hoursSinceCreation >= 23 && !linkData.final_reminder_sent_at) {
                reminderType = 'final';
                reminderColumn = 'final_reminder_sent_at';
              } else if (hoursSinceCreation >= 18 && !linkData.reminder_2_sent_at) {
                reminderType = 'reminder2';
                reminderColumn = 'reminder_2_sent_at';
              } else if (hoursSinceCreation >= 6 && !linkData.reminder_1_sent_at) {
                reminderType = 'reminder1';
                reminderColumn = 'reminder_1_sent_at';
              }
              break;
              
            case '7d':
              // Day 2, Day 5, Day 7
              if (daysSinceCreation >= 6 && !linkData.final_reminder_sent_at) {
                reminderType = 'final';
                reminderColumn = 'final_reminder_sent_at';
              } else if (daysSinceCreation >= 5 && !linkData.reminder_2_sent_at) {
                reminderType = 'reminder2';
                reminderColumn = 'reminder_2_sent_at';
              } else if (daysSinceCreation >= 2 && !linkData.reminder_1_sent_at) {
                reminderType = 'reminder1';
                reminderColumn = 'reminder_1_sent_at';
              }
              break;
              
            case '30d':
              // Day 7, Day 21, Day 29
              if (daysSinceCreation >= 29 && !linkData.final_reminder_sent_at) {
                reminderType = 'final';
                reminderColumn = 'final_reminder_sent_at';
              } else if (daysSinceCreation >= 21 && !linkData.reminder_2_sent_at) {
                reminderType = 'reminder2';
                reminderColumn = 'reminder_2_sent_at';
              } else if (daysSinceCreation >= 7 && !linkData.reminder_1_sent_at) {
                reminderType = 'reminder1';
                reminderColumn = 'reminder_1_sent_at';
              }
              break;
              
            case 'none':
              // Day 7, Day 30, Day 60
              if (daysSinceCreation >= 60 && !linkData.final_reminder_sent_at) {
                reminderType = 'final';
                reminderColumn = 'final_reminder_sent_at';
              } else if (daysSinceCreation >= 30 && !linkData.reminder_2_sent_at) {
                reminderType = 'reminder2';
                reminderColumn = 'reminder_2_sent_at';
              } else if (daysSinceCreation >= 7 && !linkData.reminder_1_sent_at) {
                reminderType = 'reminder1';
                reminderColumn = 'reminder_1_sent_at';
              }
              break;
          }
          
          if (reminderType && reminderColumn) {
            // Get company name
            let companyName = "Dynopay Merchant";
            if (linkData.company_id) {
              const company = await companyModel.findByPk(linkData.company_id);
              if (company) {
                companyName = (company as { company_name?: string }).company_name || companyName;
              }
            }
            
            // Generate unsubscribe token if not exists
            let unsubscribeToken = linkData.unsubscribe_token;
            if (!unsubscribeToken) {
              const crypto = await import("crypto");
              unsubscribeToken = crypto.randomBytes(32).toString('hex');
              await paymentLinkModel.update(
                { unsubscribe_token: unsubscribeToken },
                { where: { link_id: linkData.link_id } }
              );
            }
            
            // Send reminder email
            await sendPaymentLinkReminderEmail(
              linkData.email,
              companyName,
              String(linkData.base_amount),
              linkData.base_currency,
              linkData.description,
              linkData.payment_link,
              expiresAt,
              reminderType,
              unsubscribeToken
            );
            
            // Mark reminder as sent
            await paymentLinkModel.update(
              { [reminderColumn]: now },
              { where: { link_id: linkData.link_id } }
            );
            
            remindersSent++;
            log(`Sent ${reminderType} to ${linkData.email} for payment link ${linkData.link_id} (${expiryType} expiry)`, "info");
          }
        } catch (linkError: unknown) {
          const err = linkError as { message?: string };
          log(`Error processing payment link ${link.dataValues.link_id}: ${err.message}`, "error");
        }
      }
      
      log(`Payment Link Reminder Cron completed: ${remindersSent} reminders sent`, "info");
      
    } catch (e: unknown) {
      const err = e as { message?: string };
      log(`Payment Link Reminder Cron Job Error: ${err.message}`, "error");
      cronLogger?.error?.("Payment Link Reminder Cron Error", {}, new Error(err.message));
    }
  });
  
  log("Payment Link Reminder Cron Job scheduled for every hour", "info");
};

/**
 * Manually trigger payment link reminders (for testing)
 */
export const triggerPaymentLinkReminders = async () => {
  log("Manually triggering Payment Link Reminders...", "info");
  
  await import("../helper");
  const { paymentLinkModel } = await import("../models");
  const { Op } = await import("sequelize");
  
  const now = new Date();
  
  const pendingLinks = await paymentLinkModel.findAll({
    where: {
      status: 'pending',
      email: { [Op.not]: null },
      unsubscribed_at: null,
      [Op.or]: [
        { expires_at: null },
        { expires_at: { [Op.gt]: now } },
      ],
    },
  });
  
  const results = {
    total: pendingLinks.length,
    reminders_sent: 0,
    skipped_no_reminder_due: 0,
    details: [] as Array<Record<string, unknown>>,
  };
  
  for (const link of pendingLinks) {
    const linkData = link.dataValues;
    const createdAt = new Date(linkData.createdAt);
    const expiresAt = linkData.expires_at ? new Date(linkData.expires_at) : null;
    
    const hoursSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    const daysSinceCreation = Math.floor(hoursSinceCreation / 24);
    
    // Determine expiry type
    let expiryType: '24h' | '7d' | '30d' | 'none' = 'none';
    if (expiresAt) {
      const totalHours = Math.floor((expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
      if (totalHours <= 25) expiryType = '24h';
      else if (totalHours <= 168 + 1) expiryType = '7d';
      else expiryType = '30d';
    }
    
    results.details.push({
      link_id: linkData.link_id,
      email: linkData.email,
      expiry_type: expiryType,
      hours_since_creation: hoursSinceCreation,
      days_since_creation: daysSinceCreation,
      reminder_1_sent: !!linkData.reminder_1_sent_at,
      reminder_2_sent: !!linkData.reminder_2_sent_at,
      final_reminder_sent: !!linkData.final_reminder_sent_at,
    });
  }
  
  return results;
};

export default {
  setupWeeklySummaryCron,
  triggerWeeklySummary,
  setupWalletReminderCron,
  triggerWalletReminder,
  setupHealthCheckCron,
  setupRefereeCodeReminderCron,
  triggerRefereeCodeReminders,
  setupPaymentLinkReminderCron,
  triggerPaymentLinkReminders,
};
