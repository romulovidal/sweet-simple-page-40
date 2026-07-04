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

const BodySchema = z.object({
  book_abbrev: z.string().trim().min(1).max(10),
  chapter: z.number().int().min(1).max(200),
  verses: z.array(z.number().int().min(1).max(200)).min(1).max(50),
});

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/l/1/I

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
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { book_abbrev, chapter, verses } = parsed.data;

    // Rate limit: 20 novos links / 60s por usuário/IP
    const userId = await getRequestUserId(req);
    const identifier = getClientIdentifier(req, userId);
    const admin = createAdminClient();
    const rl = await checkRateLimit(admin, identifier, "create-verse-share", 20, 60);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Deduplicação: procura link recente idêntico (últimas 24h)
    const sortedVerses = [...new Set(verses)].sort((a, b) => a - b);
    const { data: existing } = await supabase
      .from("verse_shares")
      .select("slug")
      .eq("book_abbrev", book_abbrev)
      .eq("chapter", chapter)
      .eq("verses", sortedVerses)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existing?.slug) {
      return new Response(JSON.stringify({ slug: existing.slug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenta gerar slug único (até 5 tentativas)
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = genSlug(6);
      const { error } = await supabase
        .from("verse_shares")
        .insert({ slug, book_abbrev, chapter, verses: sortedVerses });

      if (!error) {
        return new Response(JSON.stringify({ slug }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Se conflito de PK, tenta de novo com slug diferente
      if (!String(error.message).includes("duplicate key")) throw error;
    }

    return new Response(JSON.stringify({ error: "Failed to allocate slug" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-verse-share error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});