import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const API_KEY = Deno.env.get("YOUTUBE_API_KEY");

// Fast isolate-local cache plus persistent database cache. The result never
// contains the API key and can safely be reused by the app and ATIS.
const cache = new Map<string, { videoId: string; title: string; channel: string; ts: number }>();
const MEMORY_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DB_TTL_MS = 1000 * 60 * 60 * 24 * 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!API_KEY) {
      return json({ error: "Busca do YouTube não configurada", code: "YOUTUBE_API_KEY_MISSING" }, 503);
    }

    const { number, title } = await req.json().catch(() => ({}));
    const n = Number(number);
    const t = typeof title === "string" ? title.trim() : "";
    if (!Number.isFinite(n) || n <= 0 || !t) {
      return json({ error: "Parâmetros inválidos" }, 400);
    }

    const key = `${n}::${t.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < MEMORY_TTL_MS) {
      return json({ ...cached, cached: true, cache_source: "memory" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
    const supabase = supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : null;

    if (supabase) {
      try {
        const { data: dbCached, error: cacheError } = await supabase
          .from("atis_harpa_youtube_cache")
          .select("hymn_title,youtube_video_id,youtube_title,youtube_channel,checked_at,expires_at")
          .eq("hymn_number", n)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (cacheError) throw cacheError;
        if (dbCached?.youtube_video_id) {
          const result = {
            videoId: String(dbCached.youtube_video_id),
            title: String(dbCached.youtube_title || dbCached.hymn_title || t),
            channel: String(dbCached.youtube_channel || ""),
            ts: new Date(dbCached.checked_at || Date.now()).getTime(),
          };
          cache.set(key, result);
          return json({ ...result, cached: true, cache_source: "database" });
        }
      } catch (error) {
        // Cache failure must never prevent a fresh provider search.
        console.error("[youtube-search] persistent cache read failed", (error as Error)?.message);
      }
    }

    const padded = String(n).padStart(2, "0");
    const q = `${padded} ${t} harpa cristã`;
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("videoEmbeddable", "true");
    url.searchParams.set("q", q);
    url.searchParams.set("key", API_KEY);

    const resp = await fetch(url);
    const raw = await resp.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

    if (!resp.ok) {
      const reason = String(data?.error?.errors?.[0]?.reason ?? data?.error?.status ?? "unknown");
      const providerMessage = String(data?.error?.message ?? "");
      const suspended = /suspend/i.test(providerMessage);
      const quota = /quota/i.test(reason) || /quota/i.test(providerMessage);
      const code = suspended
        ? "YOUTUBE_API_KEY_SUSPENDED"
        : quota
        ? "YOUTUBE_QUOTA_EXCEEDED"
        : `YOUTUBE_HTTP_${resp.status}`;

      console.error("[youtube-search] provider failure", { status: resp.status, reason, code });
      return json({ error: "Busca do YouTube temporariamente indisponível", code }, 503);
    }

    const item = data?.items?.[0];
    if (!item?.id?.videoId) {
      return json({ error: "Nenhum vídeo encontrado" }, 404);
    }

    const result = {
      videoId: item.id.videoId as string,
      title: (item.snippet?.title as string) ?? q,
      channel: (item.snippet?.channelTitle as string) ?? "",
      ts: Date.now(),
    };
    cache.set(key, result);

    if (supabase) {
      try {
        const checkedAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + DB_TTL_MS).toISOString();
        const { error: upsertError } = await supabase.from("atis_harpa_youtube_cache").upsert({
          hymn_number: n,
          hymn_title: t,
          youtube_video_id: result.videoId,
          youtube_title: result.title,
          youtube_channel: result.channel,
          checked_at: checkedAt,
          expires_at: expiresAt,
          metadata: { source: "youtube_data_api_v3", query: q },
        }, { onConflict: "hymn_number" });
        if (upsertError) throw upsertError;
      } catch (error) {
        console.error("[youtube-search] persistent cache write failed", (error as Error)?.message);
      }
    }

    return json({ ...result, cached: false, cache_source: "provider" });
  } catch (e) {
    console.error("[youtube-search] error", e);
    return json({ error: "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
