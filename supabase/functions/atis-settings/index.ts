// Administrative endpoint for the editable ATIS ministerial prompt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

type Json = Record<string, any>;
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
  let input: Json = {};
  try { input = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const action = String(input.action ?? "get");
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const { data: row, error } = await supabase.from("atis_settings").select("key,value,updated_at").eq("key", "assistant").maybeSingle();
    if (error) throw error;
    if (!row) return json({ error: "ASSISTANT_SETTINGS_NOT_FOUND" }, 404);
    if (action === "get") {
      return json({
        prompt: typeof row.value?.system_prompt === "string" ? row.value.system_prompt : "",
        enabled: row.value?.enabled !== false,
        auto_reply_direct: row.value?.auto_reply_direct !== false,
        auto_reply_groups: row.value?.auto_reply_groups === true,
        updated_at: row.updated_at,
        immutable_policy: true,
      });
    }
    if (action === "save") {
      const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
      if (prompt.length < 200) return json({ error: "PROMPT_TOO_SHORT", message: "O prompt precisa ter pelo menos 200 caracteres." }, 400);
      if (prompt.length > 20000) return json({ error: "PROMPT_TOO_LONG", message: "O prompt pode ter no máximo 20.000 caracteres." }, 400);
      const next = { ...(row.value ?? {}), system_prompt: prompt };
      const { data: saved, error: saveError } = await supabase.from("atis_settings").update({ value: next }).eq("key", "assistant").select("updated_at").single();
      if (saveError) throw saveError;
      return json({ ok: true, prompt, updated_at: saved.updated_at, immutable_policy: true });
    }
    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("[atis-settings]", error instanceof Error ? error.message : error);
    return json({ error: "ATIS_SETTINGS_ERROR" }, 500);
  }
});
