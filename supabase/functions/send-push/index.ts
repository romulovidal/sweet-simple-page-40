import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
 import webpush from "https://esm.sh/web-push@3.6.7";
import { z } from "https://esm.sh/zod@3.25.76";
import { safeSend } from "../_shared/atis-antiban.ts";

const PushPayloadSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  url: z.string().trim().max(200).optional().default("/"),
  type: z.string().trim().max(50).optional().default("general"),
  ttl: z.number().int().min(60).max(60 * 60 * 24 * 7).optional().default(60 * 60 * 24),
  urgency: z.enum(["very-low", "low", "normal", "high"]).optional().default("high"),
  groupsOnly: z.boolean().optional().default(false),
  // Quando informado, a notificação vai apenas para as inscrições desse usuário.
  user_id: z.string().uuid().optional(),
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
   supabase: any,
   sub: { id: string; endpoint: string; p256dh: string; auth: string },
   payload: string,
   options: any,
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

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    let subsQuery = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
    if (body.user_id) subsQuery = subsQuery.eq("user_id", body.user_id);
    const { data: subs, error } = await subsQuery;

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

    const results = body.groupsOnly ? [] : await Promise.all((subs || []).map(sub => 
      sendToSubscription(supabase, sub, payload, requestOptions)
    ));
    
    results.forEach(res => {
      sent += res.sent;
      failed += res.failed;
    });

    // Forward the notification to WhatsApp groups that opted in.
    let waSent = 0;
    let waFailed = 0;
    let waIndividualSent = 0;
    let waIndividualFailed = 0;
    try {
      const evoUrl = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/$/, "");
      const evoKey = Deno.env.get("EVOLUTION_API_KEY") ?? "";
      if (evoUrl && evoKey) {
        const { data: groups } = await supabase
          .from("atis_groups")
          .select("wa_group_id, name, notification_types, notification_times")
          .eq("forward_notifications", true)
          .eq("active", true)
          .not("wa_group_id", "is", null);

        const notifType = body.type === "culto-reminder-manual" ? "culto-reminder" : (body.type || "general");
          const nowTime = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Fortaleza", hour: "2-digit", minute: "2-digit", hour12: false,
          }).format(new Date());
          const filteredGroups = (groups ?? []).filter((g: any) => {
          const types = Array.isArray(g.notification_types) ? g.notification_types : null;
          // null/empty = accepts all (backward compatible)
          if (!types || types.length === 0) return true;
            if (!types.includes(notifType)) return false;
            const times = g.notification_times && typeof g.notification_times === "object" ? g.notification_times : {};
            const scheduled = typeof times[notifType] === "string" ? times[notifType] : "";
            return !scheduled || scheduled === nowTime;
        });

        if (filteredGroups.length) {
          const link = body.url && body.url !== "/"
            ? `https://biblia.atalaias.online${body.url}`
            : "https://biblia.atalaias.online";
          const waText = `📣 *${body.title}*\n\n${body.body}\n\n🔗 ${link}`;
          const results = await Promise.all(filteredGroups.map(async (g: any) => {
            try {
              const res = await safeSend(supabase, g.wa_group_id, waText, { kind: "bulk", noFooter: true });
              const raw = typeof res.body === "string" ? res.body : JSON.stringify(res.body ?? "");
              await supabase.from("atis_messages_log").insert({
                direction: "outbound",
                wa_to: g.wa_group_id,
                wa_group_id: g.wa_group_id,
                body: waText,
                status: res.ok ? "sent" : (res.skipped ? "skipped" : "error"),
                error: res.ok ? null : (res.skipped ? res.reason : `${res.status}: ${raw.slice(0, 300)}`),
                raw: { source: "push_forward", type: body.type, skipped: res.skipped ?? false },
              });
              return res.ok;
            } catch (err) {
              console.error("[send-push] group forward failed", g.wa_group_id, err);
              return false;
            }
          }));
          waSent = results.filter(Boolean).length;
          waFailed = results.length - waSent;
        }

        // Forward to individual users who opted in via profile.
        const { data: subscribers } = body.groupsOnly ? { data: [] } : await supabase
          .from("profiles")
          .select("whatsapp, display_name")
          .eq("whatsapp_opt_in", true)
          .not("whatsapp", "is", null);

        if (subscribers?.length) {
          const link = body.url && body.url !== "/"
            ? `https://biblia.atalaias.online${body.url}`
            : "https://biblia.atalaias.online";
          const results = await Promise.all(subscribers.map(async (u: any) => {
            const digits = String(u.whatsapp ?? "").replace(/\D/g, "");
            if (digits.length < 10) return false;
            // Ensure Brazilian country code (55) prefix
            const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
            // Try with and without the 9th digit after DDD (BR mobile variance)
            const ddd = withCountry.slice(2, 4);
            const rest = withCountry.slice(4);
            const variants = new Set<string>([withCountry]);
            if (rest.length === 9 && rest.startsWith("9")) variants.add(`55${ddd}${rest.slice(1)}`);
            else if (rest.length === 8) variants.add(`55${ddd}9${rest}`);
            const jids = [...variants].map((n) => `${n}@s.whatsapp.net`);
            const firstName = (u.display_name ?? "").split(" ")[0] || "";
            const salute = firstName ? `Olá, *${firstName}*! ` : "";
            const waText = `${salute}📣 *${body.title}*\n\n${body.body}\n\n🔗 ${link}`;
            try {
              let ok = false;
              let lastStatus = 0;
              let lastRaw = "";
              let lastJid = jids[0];
              for (const jid of jids) {
                lastJid = jid;
                const res = await fetch(`${evoUrl}/message/sendText/atis`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: evoKey },
                  body: JSON.stringify({ number: jid, text: waText }),
                });
                lastRaw = await res.text().catch(() => "");
                lastStatus = res.status;
                if (res.ok) { ok = true; break; }
                if (!lastRaw.includes('"exists":false')) break;
              }
              await supabase.from("atis_messages_log").insert({
                direction: "outbound",
                wa_to: lastJid,
                body: waText,
                status: ok ? "sent" : "error",
                error: ok ? null : `${lastStatus}: ${lastRaw.slice(0, 300)}`,
                raw: { source: "push_forward_individual", type: body.type },
              });
              return ok;
            } catch (err) {
              console.error("[send-push] individual forward failed", jids[0], err);
              return false;
            }
          }));
          waIndividualSent = results.filter(Boolean).length;
          waIndividualFailed = results.length - waIndividualSent;
        }
      }
    } catch (err) {
      console.error("[send-push] group forward top-level error", err);
    }

    return new Response(
      JSON.stringify({ sent, failed, total: (subs || []).length, ttl: body.ttl, urgency: body.urgency, waSent, waFailed, waIndividualSent, waIndividualFailed }),
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
