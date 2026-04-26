import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import webpush from "npm:web-push@3.6.7";
import { z } from "https://esm.sh/zod@3.25.76";

const PushPayloadSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  url: z.string().trim().max(200).optional().default("/"),
  type: z.string().trim().max(50).optional().default("general"),
  ttl: z.number().int().min(60).max(60 * 60 * 24 * 7).optional().default(60 * 60 * 24),
  urgency: z.enum(["very-low", "low", "normal", "high"]).optional().default("high"),
});

type PushPayload = z.infer<typeof PushPayloadSchema>;

function isSafeRelativeUrl(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

async function requireAdminUser(req: Request, supabaseUrl: string, anonKey: string, serviceKey: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }

  const token = authHeader.replace(/^Bearer\s+/, "");
  if (token === serviceKey) {
    return { userId: "service-role" };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }

  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (roleError || !isAdmin) {
    return { error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }

  return { userId: user.id };
}

async function sendToSubscription(
  supabase: ReturnType<typeof createClient>,
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: string,
  options: webpush.RequestOptions,
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload,
      options,
    );
    return { sent: 1, failed: 0 };
  } catch (e: unknown) {
    const statusCode = typeof e === "object" && e !== null && "statusCode" in e ? Reflect.get(e, "statusCode") : undefined;
    const errorBody = typeof e === "object" && e !== null && "body" in e ? Reflect.get(e, "body") : undefined;

    console.error(`Push failed for ${sub.endpoint}:`, statusCode, errorBody);
    if (statusCode === 410 || statusCode === 404) {
      await supabase.from("push_subscriptions").delete().eq("id", sub.id);
    }
    return { sent: 0, failed: 1 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

    const authResult = await requireAdminUser(req, supabaseUrl, anonKey, serviceKey);
    if (authResult.error) {
      return authResult.error;
    }

    const rawBody = await req.json();
    const parsed = PushPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: PushPayload = parsed.data;
    if (!isSafeRelativeUrl(body.url)) {
      return new Response(JSON.stringify({ error: "A URL deve ser interna e começar com /." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");

    if (error) throw error;

    const payload = JSON.stringify({
      title: body.title,
      body: body.body,
      icon: "/logo.png",
      badge: "/logo.png",
      url: body.url || "/",
      type: body.type || "general",
      sentAt: new Date().toISOString(),
    });

    const requestOptions: webpush.RequestOptions = {
      TTL: body.ttl,
      urgency: body.urgency,
      topic: `congregacao-${body.type || "general"}`.slice(0, 32),
    };

    let sent = 0;
    let failed = 0;

    const results = await Promise.all((subs || []).map(sub => 
      sendToSubscription(supabase, sub, payload, requestOptions)
    ));
    
    results.forEach(res => {
      sent += res.sent;
      failed += res.failed;
    });

    return new Response(
      JSON.stringify({ sent, failed, total: (subs || []).length, ttl: body.ttl, urgency: body.urgency }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
