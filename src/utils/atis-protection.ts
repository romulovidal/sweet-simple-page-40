/**
 * Helper to check if an automation is protected (System automation)
 * Protected automations cannot be deleted, and certain fields (source_key, notification_type) 
 * are locked to maintain system integrity.
 */
export function isProtectedAutomation(sourceKey?: string | null): boolean {
  if (!sourceKey) return false;
  
  return (
    sourceKey.startsWith("system:") ||
    sourceKey === "legacy:atis_birthday_greeting" ||
    sourceKey === "legacy:atis_daily_devotional"
  );
}
