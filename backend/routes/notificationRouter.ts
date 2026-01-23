import express from "express";
import notificationController from "../controller/notificationController";
import { authMiddleware } from "../middleware";
import { triggerWeeklySummary } from "../utils/cronJobs";
import { successResponseHelper, errorResponseHelper, getErrorMessage } from "../helper";

const notificationRouter = express.Router();

// All notification routes require authentication
notificationRouter.use(authMiddleware);

// Preferences endpoints
// GET /api/notifications/preferences - Get user's notification settings
notificationRouter.get("/preferences", notificationController.getPreferences);

// PUT /api/notifications/preferences - Update notification settings
notificationRouter.put("/preferences", notificationController.updatePreferences);

// Notification list endpoints
// GET /api/notifications - List all notifications (with pagination)
// Query params: company_id, type, is_read, page, limit
notificationRouter.get("/", notificationController.getNotifications);

// GET /api/notifications/unread-count - Get unread badge count
notificationRouter.get("/unread-count", notificationController.getUnreadCount);

// GET /api/notifications/types - Get all notification types
notificationRouter.get("/types", notificationController.getNotificationTypes);

// POST /api/notifications/trigger-weekly-summary - Manually trigger weekly summary (for testing)
notificationRouter.post("/trigger-weekly-summary", async (req, res) => {
  try {
    const results = await triggerWeeklySummary(req.body.user_id);
    return successResponseHelper(res, 200, "Weekly summary triggered", { results });
  } catch (e) {
    const message = getErrorMessage(e);
    return errorResponseHelper(res, 500, message);
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
notificationRouter.put("/read-all", notificationController.markAllAsRead);

// PUT /api/notifications/:id/read - Mark single notification as read
notificationRouter.put("/:id/read", notificationController.markAsRead);

// DELETE /api/notifications/:id - Delete a notification
notificationRouter.delete("/:id", notificationController.deleteNotification);

export default notificationRouter;
