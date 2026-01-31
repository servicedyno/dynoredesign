import cron from "node-cron";
import { QueryTypes } from "sequelize";
import sequelize from "./dbInstance";
import { createNotification, NOTIFICATION_TYPES } from "../controller";
import { notificationPreferencesModel, userTransactionModel } from "../models";
import { cronLogger, log } from "./loggers";

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
    console.log("Weekly Summary Cron Job ==============> Starting");
    
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
      ) as any[];

      console.log(`Found ${usersWithWeeklySummary.length} users with weekly summary enabled`);

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
          ) as any[];

          const stats = summary[0] || {
            transaction_count: 0,
            total_volume: 0,
            completed_count: 0,
            pending_count: 0,
            failed_count: 0,
          };

          // Create notification with summary data
          const notificationData = {
            period_start: startDate.toISOString().split('T')[0],
            period_end: endDate.toISOString().split('T')[0],
            transaction_count: parseInt(stats.transaction_count),
            total_volume: parseFloat(stats.total_volume),
            completed_count: parseInt(stats.completed_count),
            pending_count: parseInt(stats.pending_count),
            failed_count: parseInt(stats.failed_count),
          };

          const title = "Your Weekly Summary";
          const message = `This week you had ${stats.transaction_count} transactions with a total volume of $${parseFloat(stats.total_volume).toFixed(2)}. ${stats.completed_count} completed, ${stats.pending_count} pending.`;

          await createNotification(
            user.user_id,
            NOTIFICATION_TYPES.WEEKLY_SUMMARY,
            title,
            message,
            notificationData,
            user.company_id
          );

          console.log(`Weekly summary created for user ${user.user_id}`);

          // TODO: Send email when Email Service (Phase 9) is implemented
          // await sendWeeklySummaryEmail(user.email, user.name, notificationData);

        } catch (userError) {
          console.error(`Error creating weekly summary for user ${user.user_id}:`, userError);
        }
      }

      console.log("Weekly Summary Cron Job ==============> Completed");
      
    } catch (e) {
      console.error("Weekly Summary Cron Job Error:", e);
      cronLogger?.error?.("Weekly Summary Cron Error", {}, new Error(e as any));
    }
  });

  console.log("Weekly Summary Cron Job scheduled for every Monday at 9:00 AM UTC");
};

/**
 * Trigger weekly summary manually (for testing)
 */
export const triggerWeeklySummary = async (userId?: number) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    let users: any[];

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
      ) as any[];
    } else {
      // Get all users with weekly summary enabled
      users = await sequelize.query(
        `SELECT DISTINCT np.user_id, np.company_id, u.name, u.email
         FROM tbl_notification_preferences np
         JOIN tbl_user u ON u.user_id = np.user_id
         WHERE np.weekly_summary = true`,
        { type: QueryTypes.SELECT }
      ) as any[];
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
            userId: user.user_id, 
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
          type: QueryTypes.SELECT,
        }
      ) as any[];

      const stats = summary[0];

      const notificationData = {
        period_start: startDate.toISOString().split('T')[0],
        period_end: endDate.toISOString().split('T')[0],
        transaction_count: parseInt(stats.transaction_count),
        total_volume: parseFloat(stats.total_volume),
        completed_count: parseInt(stats.completed_count),
        pending_count: parseInt(stats.pending_count),
        failed_count: parseInt(stats.failed_count),
      };

      const notification = await createNotification(
        user.user_id,
        NOTIFICATION_TYPES.WEEKLY_SUMMARY,
        "Your Weekly Summary",
        `This week you had ${stats.transaction_count} transactions with a total volume of $${parseFloat(stats.total_volume).toFixed(2)}.`,
        notificationData,
        user.company_id
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
    console.log("Wallet Reminder Cron Job ==============> Starting");
    
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
      ) as any[];

      console.log(`Found ${usersWithoutWallets.length} users without wallets to remind`);

      for (const user of usersWithoutWallets) {
        try {
          // Send wallet reminder email
          const { sendAddWalletReminderEmail } = await import("../services/emailService");
          await sendAddWalletReminderEmail(user.email, user.name, user.company_name);

          // Mark user as reminded
          await sequelize.query(
            `UPDATE tbl_user SET wallet_reminder_sent = true WHERE user_id = :userId`,
            {
              replacements: { userId: user.user_id },
              type: QueryTypes.UPDATE
            }
          );

          console.log(`Wallet reminder sent to user ${user.user_id} (${user.email})`);

        } catch (userError) {
          console.error(`Error sending wallet reminder to user ${user.user_id}:`, userError);
        }
      }

      console.log("Wallet Reminder Cron Job ==============> Completed");
      
    } catch (e) {
      console.error("Wallet Reminder Cron Job Error:", e);
      cronLogger?.error?.("Wallet Reminder Cron Error", {}, new Error(e as any));
    }
  });

  console.log("Wallet Reminder Cron Job scheduled for every hour");
};

/**
 * Trigger wallet reminder manually (for testing)
 */
export const triggerWalletReminder = async (userId?: number) => {
  try {
    let users: any[];

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
      ) as any[];
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
      ) as any[];
    }

    const results = [];

    for (const user of users) {
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
    throw e;
  }
};

/**
 * Infrastructure Health Check Cron Job
 * Schedule: Every 5 minutes
 * Logic: Run health checks on all monitored services and store results
 */
export const setupHealthCheckCron = () => {
  // Run every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const monitoringService = require("../services/monitoringService").default;
      await monitoringService.runHealthChecks();
    } catch (e) {
      console.error("Health Check Cron Job Error:", e);
    }
  });

  console.log("Health Check Cron Job scheduled for every 5 minutes");
};

export default {
  setupWeeklySummaryCron,
  triggerWeeklySummary,
  setupWalletReminderCron,
  triggerWalletReminder,
  setupHealthCheckCron,
};
