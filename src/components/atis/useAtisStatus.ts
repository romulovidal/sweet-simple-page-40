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
    try {
      const { data, error } = await supabase.functions.invoke("atis-instance", {
        body: { action: "status" },
      });
      if (error) throw error;
      const s = (data as any)?.state ?? "unknown";
      setState((s === "open" || s === "connected") ? "open" : (s as AtisConnState));
    } catch {
      setState("error");
    } finally {
      setLoading(false);
      setLastCheckedAt(new Date());
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  return {
    state,
    connected: state === "open",
    loading,
    refresh: load,
    lastCheckedAt,
  };
}
