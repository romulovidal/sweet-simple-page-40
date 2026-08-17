import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { runAtisAssistant } from "../_shared/atis/assistant.ts";

// ATIS assistant behavior, including daily devotional grounding, is centralized in _shared/atis/assistant.ts.
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const auth = await validateAdminAuth(req, url, serviceKey);
  if (!auth.authorized) {
    const forbidden = auth.error === "Administrative access required";
    return json({ error: forbidden ? "FORBIDDEN" : "UNAUTHORIZED", message: auth.error }, forbidden ? 403 : 401);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return json({ error: "MESSAGE_REQUIRED" }, 400);
  if (message.length > 5000) return json({ error: "MESSAGE_TOO_LONG" }, 413);

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const result = await runAtisAssistant(supabase, message);
    return json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ATIS_AI_ERROR";
    console.error("[atis-ai]", code);
    const status = code === "AI_PROVIDER_UNAVAILABLE" ? 503 : 500;
    return json({ error: code, message: code }, status);
  }
});