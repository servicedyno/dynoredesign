import { useState, useEffect, useCallback } from "react";
import axiosBaseApi from "@/axiosConfig";

interface NotificationPreferences {
  transactionUpdates: boolean;
  paymentReceived: boolean;
  weeklySummary: boolean;
  securityAlerts: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

const defaultPreferences: NotificationPreferences = {
  transactionUpdates: true,
  paymentReceived: false,
  weeklySummary: true,
  securityAlerts: false,
  emailNotifications: true,
  smsNotifications: false,
};

export const useNotificationPreferences = () => {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axiosBaseApi.get("/notifications/preferences");
      if (response?.data?.status && response.data.data) {
        setPreferences({
          transactionUpdates:
            response.data.data.transactionUpdates ?? defaultPreferences.transactionUpdates,
          paymentReceived:
            response.data.data.paymentReceived ?? defaultPreferences.paymentReceived,
          weeklySummary:
            response.data.data.weeklySummary ?? defaultPreferences.weeklySummary,
          securityAlerts:
            response.data.data.securityAlerts ?? defaultPreferences.securityAlerts,
          emailNotifications:
            response.data.data.emailNotifications ?? defaultPreferences.emailNotifications,
          smsNotifications:
            response.data.data.smsNotifications ?? defaultPreferences.smsNotifications,
        });
      }
    } catch (err) {
      console.error("Failed to fetch notification preferences:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = useCallback(async (prefs: NotificationPreferences) => {
    setSaving(true);
    setError(null);
    try {
      const response = await axiosBaseApi.put("/notifications/preferences", prefs);
      if (response?.data?.status) {
        setPreferences(prefs);
        return true;
      } else {
        setError(response?.data?.message || "Failed to save preferences");
        return false;
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to save preferences";
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updatePreference = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return {
    preferences,
    loading,
    saving,
    error,
    updatePreference,
    savePreferences,
    fetchPreferences,
  };
};
