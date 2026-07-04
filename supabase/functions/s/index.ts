// Public verse share landing: serves crawler-friendly HTML with dynamic
// Open Graph tags + client redirect to the SPA for humans.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const APP_ORIGIN =
  Deno.env.get("APP_PUBLIC_ORIGIN") ?? "https://biblia.atalaias.online";
const FUNC_ORIGIN = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatVerseRanges(verses: number[]): string {
  if (!verses.length) return "";
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur !== prev + 1) {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = cur!;
    }
    prev = cur!;
  }
  return parts.join(",");
}

function isBotUA(ua: string): boolean {
  return /bot|crawler|spider|facebookexternalhit|whatsapp|telegram|slackbot|discordbot|twitterbot|linkedinbot|embedly|pinterest|redditbot|applebot|googlebot|bingbot|duckduckbot|preview|snapchat|vkshare|w3c_validator|quora link preview/i.test(
    ua,
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Path: /functions/v1/s/<slug>  → segments = ["functions","v1","s","<slug>"]
  const segments = url.pathname.split("/").filter(Boolean);
  const slug = segments[segments.length - 1];

  if (!slug || !/^[A-Za-z0-9]{4,12}$/.test(slug)) {
    return new Response("Not Found", { status: 404 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase
    .from("verse_shares")
    .select("book_abbrev, chapter, verses, text_snippet, book_name, version")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return new Response("Link não encontrado", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const verses = (data.verses ?? []) as number[];
  const versesParam = formatVerseRanges(verses);
  const bookLabel = data.book_name ?? data.book_abbrev.toUpperCase();
  const reference = `${bookLabel} ${data.chapter}:${versesParam}`;
  const versionLabel = data.version ? ` (${data.version})` : "";
  const title = `${reference}${versionLabel} — Bíblia do Atalaia`;
  const rawSnippet = (data.text_snippet ?? "").replace(/\s+/g, " ").trim();
  const description = rawSnippet
    ? rawSnippet.length > 200
      ? rawSnippet.slice(0, 197) + "…"
      : rawSnippet
    : `Leia ${reference} na Bíblia do Atalaia.`;

  const appUrl = `${APP_ORIGIN}/biblia?book=${encodeURIComponent(
    data.book_abbrev,
  )}&chapter=${data.chapter}&verses=${encodeURIComponent(versesParam)}`;
  const canonicalUrl = `${FUNC_ORIGIN}/s/${slug}`;
  const ogImage = `${FUNC_ORIGIN}/og/${slug}.png`;

  const ua = req.headers.get("user-agent") ?? "";
  const bot = isBotUA(ua);

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Bíblia do Atalaia" />
<meta property="og:title" content="${escapeHtml(reference)}${escapeHtml(versionLabel)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${escapeHtml(reference)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(reference)}${escapeHtml(versionLabel)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage)}" />
${bot ? "" : `<meta http-equiv="refresh" content="0; url=${escapeHtml(appUrl)}" />`}
<style>
  html,body{margin:0;padding:0;background:#0b0b10;color:#e8e6f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:640px;margin:0 auto;padding:32px 20px;text-align:center;}
  .ref{font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#a29bcf;margin-bottom:8px;}
  h1{font-size:22px;margin:0 0 20px;font-weight:600;}
  blockquote{font-size:18px;line-height:1.55;margin:0 0 24px;color:#ded9f2;}
  a{display:inline-block;background:#6d5efc;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;}
</style>
</head>
<body>
<div class="wrap">
  <div class="ref">Bíblia do Atalaia${escapeHtml(versionLabel)}</div>
  <h1>${escapeHtml(reference)}</h1>
  ${rawSnippet ? `<blockquote>${escapeHtml(rawSnippet)}</blockquote>` : ""}
  <a href="${escapeHtml(appUrl)}">Abrir no app</a>
</div>
${
  bot
    ? ""
    : `<script>window.location.replace(${JSON.stringify(appUrl)});</script>`
}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Robots-Tag": "index, follow",
    },
  });
});