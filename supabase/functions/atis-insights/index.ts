import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { buildDestinationInsights, type DestinationInsightType } from "../_shared/atis/destination-insights.ts";

type Json = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validDestinationType(value: unknown): DestinationInsightType | null {
  return value === "contact" || value === "individual" || value === "group" ? value : null;
}

function clampDays(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(7, Math.min(90, parsed)) : 30;
}

async function ensureDestination(supabase: any, type: DestinationInsightType, id: string) {
  const table = type === "contact" ? "atis_contacts" : type === "individual" ? "atis_individuals" : "atis_groups";
  const { data, error } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("DESTINATION_NOT_FOUND");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const auth = await validateAdminAuth(req, supabaseUrl, serviceKey);
  if (!auth.authorized) return json({ error: "UNAUTHORIZED", message: auth.error }, 401);

  let body: Json = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const destinationType = validDestinationType(body.destination_type);
  const destinationId = typeof body.id === "string" ? body.id.trim() : "";
  if (!destinationType || !destinationId) return json({ error: "DESTINATION_REQUIRED" }, 400);

  const days = clampDays(body.days);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    await ensureDestination(supabase, destinationType, destinationId);
    const since = new Date(Date.now() - days * 24 * 3600_000).toISOString();
    const { data, error } = await supabase
      .from("atis_inbound_messages")
      .select("status,assistant_route,metadata,received_at")
      .gte("received_at", since)
      .contains("metadata", { destination_type: destinationType, destination_id: destinationId })
      .order("received_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    return json({
      ok: true,
      privacy: {
        message_text_read: false,
        response_text_read: false,
        aggregation_only: true,
      },
      insights: buildDestinationInsights(data ?? [], destinationType),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATIS_INSIGHTS_ERROR";
    console.error("[atis-insights] failed", message);
    if (message === "DESTINATION_NOT_FOUND") return json({ error: message }, 404);
    return json({ error: "ATIS_INSIGHTS_ERROR", message }, 500);
  }
});
