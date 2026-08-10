import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppFeatures {
  presentation_mode: boolean;
  audio_bible: boolean;
  personal_notes: boolean;
  prayer_requests: boolean;
  reading_goals: boolean;
  ask_bible: boolean;
  smart_notifications: boolean;
}

const DEFAULT_FEATURES: AppFeatures = {
  presentation_mode: true,
  audio_bible: true,
  personal_notes: true,
  prayer_requests: true,
  reading_goals: true,
  ask_bible: true,
  smart_notifications: true,
};

export function useAppFeatures() {
  const [features, setFeatures] = useState<AppFeatures>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "app_features")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          setFeatures({ ...DEFAULT_FEATURES, ...(data.value as Partial<AppFeatures>) });
        }
        setLoading(false);
      });
  }, []);

  return { features, loading };
}
