// Landing page pública para seleção de hinos de culto.
// Crawlers recebem HTML com Open Graph; humanos são redirecionados ao app.
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

function isBotUA(ua: string): boolean {
  return /bot|crawler|spider|facebookexternalhit|whatsapp|telegram|slackbot|discordbot|twitterbot|linkedinbot|embedly|pinterest|redditbot|applebot|googlebot|bingbot|duckduckbot|preview|snapchat|vkshare|w3c_validator|quora link preview/i.test(ua);
}

function fmtDate(iso: string) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const slug = url.pathname.split("/").filter(Boolean).pop() ?? "";

  if (!slug || !/^[A-Za-z0-9]{4,12}$/.test(slug)) {
    return new Response("Not Found", { status: 404 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("culto_selections")
    .select("id, title, culto_date, items, is_active")
    .eq("share_slug", slug)
    .maybeSingle();

  if (error || !data || data.is_active === false) {
    return new Response("Seleção não encontrada", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const items = (data.items ?? []) as Array<{ hino_number: number }>;
  const numbers = items.map((it) => it.hino_number);
  const title = `${data.title} — Seleção de Hinos`;
  const dateLabel = fmtDate(data.culto_date);
  const description = numbers.length
    ? `${dateLabel} · ${numbers.length} hino${numbers.length === 1 ? "" : "s"}: ${numbers.join(", ")}`
    : `${dateLabel} · seleção de hinos da Harpa Atalaia.`;

  const appUrl = `${APP_ORIGIN}/harpa/culto/${data.id}`;
  const shareUrl = `${APP_ORIGIN}/c/${slug}`;
  const ogImage = `${FUNC_ORIGIN}/og-culto/${slug}.png`;

  if (!isBotUA(req.headers.get("user-agent") ?? "")) {
    return new Response(null, {
      status: 302,
      headers: { Location: appUrl, "Cache-Control": "no-store" },
    });
  }

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(shareUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Bíblia do Atalaia" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(shareUrl)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage)}" />
<style>
  html,body{margin:0;background:#0b0b10;color:#e8e6f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:640px;margin:0 auto;padding:32px 20px;text-align:center;}
  .ref{font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#a29bcf;margin-bottom:8px;}
  h1{font-size:22px;margin:0 0 12px;font-weight:600;}
  p{color:#ded9f2;line-height:1.55;}
  a{display:inline-block;background:#6d5efc;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;margin-top:20px;}
</style>
</head>
<body>
<div class="wrap">
  <div class="ref">Harpa Atalaia</div>
  <h1>${escapeHtml(data.title)}</h1>
  <p>${escapeHtml(description)}</p>
  <a href="${escapeHtml(appUrl)}">Abrir no app</a>
</div>
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
