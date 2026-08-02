import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.25.76";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIdentifier,
  getRequestUserId,
  createAdminClient,
} from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({ culto_id: z.string().uuid() });

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genSlug(len = 6) {
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = await getRequestUserId(req);
    const identifier = getClientIdentifier(req, userId);
    const admin = createAdminClient();
    const rl = await checkRateLimit(admin, identifier, "create-culto-share", 30, 60);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: culto, error } = await supabase
      .from("culto_selections")
      .select("id, share_slug, is_active")
      .eq("id", parsed.data.culto_id)
      .maybeSingle();

    if (error || !culto) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (culto.share_slug) {
      return new Response(JSON.stringify({ slug: culto.share_slug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = genSlug(6);
      const { error: upErr } = await supabase
        .from("culto_selections")
        .update({ share_slug: slug })
        .eq("id", culto.id);
      if (!upErr) {
        return new Response(JSON.stringify({ slug }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!String(upErr.message).includes("duplicate key")) throw upErr;
    }

    return new Response(JSON.stringify({ error: "Failed to allocate slug" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-culto-share error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});