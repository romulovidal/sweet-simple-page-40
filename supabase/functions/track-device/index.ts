import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isValidDeviceId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  if (id.length < 8 || id.length > 80) return false;
  return /^[A-Za-z0-9_-]+$/.test(id);
}

function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function sanitizeHistory(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const clean = new Set<string>();
  for (const v of input) {
    if (isValidDate(v)) clean.add(v);
    if (clean.size >= 400) break;
  }
  return [...clean].sort();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { device_id, current_streak, last_seen_date, history } = body ?? {};

    if (!isValidDeviceId(device_id)) {
      return new Response(JSON.stringify({ error: "invalid device_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (last_seen_date !== null && last_seen_date !== undefined && !isValidDate(last_seen_date)) {
      return new Response(JSON.stringify({ error: "invalid last_seen_date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const streak = Math.max(0, Math.min(9999, Number(current_streak) || 0));
    const cleanHistory = sanitizeHistory(history);
    const ua = req.headers.get("user-agent")?.slice(0, 250) ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch existing to merge history and prevent regressions.
    const { data: existing } = await supabase
      .from("device_streaks")
      .select("current_streak, last_seen_date, history")
      .eq("device_id", device_id)
      .maybeSingle();

    const mergedHistorySet = new Set<string>(cleanHistory);
    if (existing?.history && Array.isArray(existing.history)) {
      for (const v of existing.history as string[]) {
        if (isValidDate(v)) mergedHistorySet.add(v);
      }
    }
    const mergedHistory = [...mergedHistorySet].sort();

    const nextLastSeen =
      existing?.last_seen_date && last_seen_date
        ? (existing.last_seen_date > last_seen_date ? existing.last_seen_date : last_seen_date)
        : (last_seen_date ?? existing?.last_seen_date ?? null);

    const nextStreak = Math.max(streak, existing?.current_streak ?? 0);

    const { error } = await supabase.from("device_streaks").upsert(
      {
        device_id,
        current_streak: nextStreak,
        last_seen_date: nextLastSeen,
        history: mergedHistory,
        user_agent: ua,
      },
      { onConflict: "device_id" }
    );

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const err = e as Error;
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});