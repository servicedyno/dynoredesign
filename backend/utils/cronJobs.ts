import cron from "node-cron";
import { QueryTypes } from "sequelize";
import sequelize from "./dbInstance";
import { createNotification, NOTIFICATION_TYPES } from "../controller";
import { notificationPreferencesModel, userTransactionModel } from "../models";
import { cronLogger } from "./loggers";

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

export default {
  setupWeeklySummaryCron,
  triggerWeeklySummary,
};
