import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";
import { z } from "https://esm.sh/zod@3.25.76";

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
  user_id: z.string().uuid().nullable().optional(),
  action: z.enum(["upsert", "delete"]).default("upsert"),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getRequestUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
  } = await client.auth.getUser();

  return user ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const rawBody = await req.json();
    const parsed = SubscriptionSchema.safeParse(rawBody);

    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const user = await getRequestUser(req, supabaseUrl, anonKey);
    const requestedUserId = parsed.data.user_id ?? null;
    const resolvedUserId = user?.id ?? null;

    if (requestedUserId && requestedUserId !== resolvedUserId) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    if (parsed.data.action === "delete") {
      let deleteQuery = adminClient
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", parsed.data.endpoint);

      deleteQuery = resolvedUserId
        ? deleteQuery.eq("user_id", resolvedUserId)
        : deleteQuery.is("user_id", null);

      const { error } = await deleteQuery;

      if (error) {
        console.error("Push subscription delete failed:", error);
        return jsonResponse({ error: "Failed to delete subscription" }, 500);
      }

      return jsonResponse({ ok: true, action: "delete" });
    }

    const payload = {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_id: resolvedUserId,
    };

    const { error } = await adminClient
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "endpoint" });

    if (error) {
      console.error("Push subscription upsert failed:", error);
      return jsonResponse({ error: "Failed to save subscription" }, 500);
    }

    return jsonResponse({ ok: true, action: "upsert" });
  } catch (error) {
    console.error("Push subscription function error:", error);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
