import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AtisConnState = "open" | "connecting" | "close" | "unknown" | "error";

export interface AtisStatus {
  state: AtisConnState;
  connected: boolean;
  loading: boolean;
  refresh: () => void;
  lastCheckedAt: Date | null;
}

export function useAtisStatus(pollMs = 20000): AtisStatus {
  const [state, setState] = useState<AtisConnState>("unknown");
  const [loading, setLoading] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const load = async () => {
    console.log("[useAtisStatus] [ATIS_UI] status_request_started");
    try {
      const { data, error } = await supabase.functions.invoke("atis-instance", {
        body: { action: "status" },
      });
      
      if (error) {
        console.error("[useAtisStatus] [ATIS_UI] invoke error:", error);
        setState("error");
        return;
      }

      console.log("[useAtisStatus] [ATIS_UI] status_response:", data);
      const s = (data as any)?.state;
      
      // Mapeamento correto de estados da Evolution API
      let normalized: AtisConnState = "unknown";
      if (s === "open" || s === "connected") {
        normalized = "open";
      } else if (s === "connecting") {
        normalized = "connecting";
      } else if (s === "close" || s === "disconnected") {
        normalized = "close";
      }

      console.log(`[useAtisStatus] [ATIS_UI] normalized_status: ${normalized}`);
      setState(normalized);
    } catch (err: any) {
      console.warn("[useAtisStatus] [ATIS_UI] fetch error:", err.message);
      setState("error");
    } finally {
      setLoading(false);
      setLastCheckedAt(new Date());
    }
  };

  useEffect(() => {
    load();

    console.log("[useAtisStatus] [ATIS_REALTIME] subscribing to atis_config...");
    const channel = supabase
      .channel('atis_config_status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'atis_config',
          filter: 'id=eq.1'
        },
        (payload) => {
          const newState = payload.new.last_connection_state;
          console.log(`[useAtisStatus] [ATIS_REALTIME] event_received: ${newState}`);
          
          if (newState === "open" || newState === "connected") {
            setState("open");
          } else if (newState === "connecting") {
            setState("connecting");
          } else if (newState === "close" || newState === "disconnected") {
            setState("close");
          }
        }
      )
      .subscribe((status) => {
        console.log(`[useAtisStatus] [ATIS_REALTIME] subscription_status: ${status}`);
      });

    const id = setInterval(load, pollMs);
    return () => {
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [pollMs]);

  return {
    state,
    connected: state === "open",
    loading,
    refresh: load,
    lastCheckedAt,
  };
}
