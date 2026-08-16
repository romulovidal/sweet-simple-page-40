import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "https://esm.sh/web-push@3.6.7";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAdminAuth } from "../_shared/auth-utils.ts";

const PushPayloadSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  url: z.string().trim().max(200).optional().default("/"),
  type: z.string().trim().max(50).optional().default("general"),
  ttl: z.number().int().min(60).max(60 * 60 * 24 * 7).optional().default(60 * 60 * 24),
  urgency: z.enum(["very-low", "low", "normal", "high"]).optional().default("high"),
  groupsOnly: z.boolean().optional().default(false),
  user_id: z.string().uuid().optional(),
});

async function requireAdminUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const auth = await validateAdminAuth(req, supabaseUrl, serviceKey);
  if (auth.authorized) return { userId: auth.userId };

  const status = auth.error === "Administrative access required" ? 403 : 401;
  return {
    error: new Response(
      JSON.stringify({
        error: status === 401 ? "Unauthorized" : "Forbidden",
        details: auth.error,
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    ),
  };
}

async function sendToSubscription(
  supabase: any,
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: string,
  options: any,
) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      options,
    );
    return { sent: 1, failed: 0 };
  } catch (e: any) {
    const statusCode = e.statusCode || 500;
    if (statusCode === 410 || statusCode === 404) {
      await supabase.from("push_subscriptions").delete().eq("id", sub.id);
    }
    return { sent: 0, failed: 1, error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "Service role not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = await requireAdminUser(req, supabaseUrl, serviceKey);
  if (auth.error) return auth.error;

  try {
    const validated = PushPayloadSchema.parse(await req.json());
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let query = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
    if (validated.user_id) query = query.eq("user_id", validated.user_id);

    const { data: subs, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, message: "No active subscriptions found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails("mailto:admin@biblia-atalaia.lovable.app", vapidPublicKey, vapidPrivateKey);

    const pushPayload = JSON.stringify({
      title: validated.title,
      body: validated.body,
      url: validated.url,
      type: validated.type,
    });
    const options = { TTL: validated.ttl, urgency: validated.urgency };

    const results = await Promise.all(
      subs.map((sub: any) => sendToSubscription(supabase, sub, pushPayload, options)),
    );
    const totalSent = results.reduce((acc, result) => acc + result.sent, 0);
    const totalFailed = results.reduce((acc, result) => acc + result.failed, 0);

    const { error: logError } = await supabase.from("push_log").insert({
      title: validated.title,
      body: validated.body,
      url: validated.url,
      total_sent: totalSent,
      total_failed: totalFailed,
      sent_by: auth.userId,
    });
    if (logError) console.error("[send-push] push_log insert failed", logError);

    return new Response(JSON.stringify({ sent: totalSent, failed: totalFailed, total: subs.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-push] Request failed", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
