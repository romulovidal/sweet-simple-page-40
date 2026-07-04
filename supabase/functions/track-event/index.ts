import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_EVENTS = new Set([
  "page_view",
  "chapter_view",
  "search",
  "verse_save",
  "verse_share",
  "plan_start",
  "plan_day_complete",
  "ai_use",
  "install_prompt_shown",
  "install_prompt_accepted",
]);

function sanitizeProps(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (count >= 20) break;
    if (typeof k !== "string" || k.length > 40) continue;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else continue;
    count++;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const events = Array.isArray(body.events) ? body.events : [body];
    if (events.length === 0 || events.length > 20) {
      return new Response(JSON.stringify({ error: "invalid batch size" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Autenticação opcional: se o cliente enviar Authorization, tentamos identificar user_id
    let user_id: string | null = null;
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      try {
        const { data } = await supabase.auth.getUser(auth.slice(7));
        user_id = data.user?.id ?? null;
      } catch { /* ignora — evento anônimo */ }
    }

    // Rate limit por device_id (ou por IP se ausente): 120/min
    const firstDevice = typeof (events[0]?.device_id) === "string" ? events[0].device_id : null;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rlKey = firstDevice ? `device:${firstDevice}` : `ip:${ip}`;
    const rl = await checkRateLimit(supabase, rlKey, "track-event", 120, 60);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const rows = [];
    for (const ev of events) {
      if (!ev || typeof ev !== "object") continue;
      const name = typeof ev.event === "string" ? ev.event : ev.event_name;
      if (typeof name !== "string" || !ALLOWED_EVENTS.has(name)) continue;
      const device_id = typeof ev.device_id === "string" && ev.device_id.length <= 80
        ? ev.device_id : null;
      const path = typeof ev.path === "string" ? ev.path.slice(0, 200) : null;
      rows.push({
        user_id,
        device_id,
        event_name: name,
        props: sanitizeProps(ev.props),
        path,
      });
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase.from("analytics_events").insert(rows);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});