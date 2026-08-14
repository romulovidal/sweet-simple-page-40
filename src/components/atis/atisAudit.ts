import { atisDb } from "./atisDb";

/**
 * Audit tool to identify actual schema of atis_notification_configs
 * Run via preview or just use as reference after first manual check.
 */
export const auditAtisNotificationConfigs = async () => {
  try {
    const { data, error } = await atisDb.from("atis_notification_configs").select("*").limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return Object.keys(data[0]);
  } catch (e) {
    console.error("Audit failed", e);
    return null;
  }
};
