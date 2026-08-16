import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const API_KEY = Deno.env.get("YOUTUBE_API_KEY");

// Cache best-effort por isolate. O resultado de busca não contém a API key.
const cache = new Map<string, { videoId: string; title: string; channel: string; ts: number }>();
const TTL_MS = 1000 * 60 * 60 * 24 * 7;

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
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return json({ ...cached, cached: true });
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
    return json(result);
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
