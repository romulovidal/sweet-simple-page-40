import { supabase } from "@/integrations/supabase/client";

export const initErrorMonitor = () => {
  if (typeof window === "undefined") return;

  const reportError = async (error: any, context: string) => {
    console.error(`[ErrorMonitor] ${context}:`, error);
    
    try {
      await supabase.from("admin_activity_log").insert({
        action: "frontend_error",
        details: {
          message: error?.message || String(error),
          stack: error?.stack,
          context,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });
    } catch (e) {
      // Fallback silent failure
    }
  };

  window.onerror = (message, source, lineno, colno, error) => {
    reportError(error || message, "window.onerror");
  };

  window.onunhandledrejection = (event) => {
    reportError(event.reason, "unhandled_rejection");
  };
};