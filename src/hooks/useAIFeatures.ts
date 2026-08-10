import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AIFeatures {
  summary: boolean;
  devotional: boolean;
  connections: boolean;
  word_meaning: boolean;
  timeline: boolean;
  plan_generator: boolean;
  exegetai: boolean;
}

const DEFAULT_FEATURES: AIFeatures = {
  summary: true,
  devotional: true,
  connections: true,
  word_meaning: true,
  timeline: true,
  plan_generator: true,
  exegetai: true,
};

export function useAIFeatures() {
  const [features, setFeatures] = useState<AIFeatures>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "ai_features")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data?.value && typeof data.value === "object") {
          setFeatures({ ...DEFAULT_FEATURES, ...(data.value as Partial<AIFeatures>) });
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return { features, loading };
}
