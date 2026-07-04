// Dynamic Open Graph image for verse shares (1200x630 PNG).
// Uses satori (React → SVG) + @resvg/resvg-wasm (SVG → PNG).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import satori, { init as initSatori } from "https://esm.sh/satori@0.10.14/wasm";
import initYoga from "https://esm.sh/yoga-wasm-web@0.3.3";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const YOGA_WASM = "https://esm.sh/yoga-wasm-web@0.3.3/dist/yoga.wasm";
const RESVG_WASM = "https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
// Inter is a reliable web font hosted by rsms (used across satori examples).
const FONT_REGULAR = "https://rsms.me/inter/font-files/Inter-Regular.woff";
const FONT_BOLD = "https://rsms.me/inter/font-files/Inter-Bold.woff";

let ready: Promise<{ fontRegular: ArrayBuffer; fontBold: ArrayBuffer }> | null = null;

async function ensureReady() {
  if (ready) return ready;
  ready = (async () => {
    const [yogaBuf, resvgBuf, fontRegularRes, fontBoldRes] = await Promise.all([
      fetch(YOGA_WASM).then((r) => r.arrayBuffer()),
      fetch(RESVG_WASM).then((r) => r.arrayBuffer()),
      fetch(FONT_REGULAR).then((r) => r.arrayBuffer()),
      fetch(FONT_BOLD).then((r) => r.arrayBuffer()),
    ]);
    const yoga = await initYoga(yogaBuf);
    initSatori(yoga);
    await initWasm(resvgBuf);
    return { fontRegular: fontRegularRes, fontBold: fontBoldRes };
  })();
  return ready;
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

// Tiny JSX-free element helper for satori.
function el(type: string, props: Record<string, unknown>, ...children: unknown[]): unknown {
  return { type, props: { ...props, children: children.length <= 1 ? children[0] : children } };
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
    const slug = last.replace(/\.png$/i, "");

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

    if (error || !data) return new Response("Not Found", { status: 404 });

    const verses = (data.verses ?? []) as number[];
    const bookLabel = (data.book_name ?? data.book_abbrev).toString();
    const reference = `${bookLabel} ${data.chapter}:${formatVerseRanges(verses)}`;
    const versionLabel = data.version ? String(data.version) : "";
    const raw = (data.text_snippet ?? "").replace(/\s+/g, " ").trim();
    // Keep the visual clean; long verses truncated for layout.
    const snippet = raw.length > 240 ? raw.slice(0, 237) + "…" : raw;

    const { fontRegular, fontBold } = await ensureReady();

    const tree = el(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg,#1a1436 0%,#0b0b1a 55%,#0a1a2a 100%)",
          color: "#f4f1ff",
          fontFamily: "Inter",
        },
      },
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 16 } },
        el(
          "div",
          {
            style: {
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg,#7c6bff,#4f8dff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
              color: "#fff",
            },
          },
          "A",
        ),
        el(
          "div",
          {
            style: {
              fontSize: 22,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#b3a9e6",
              fontWeight: 600,
            },
          },
          "Bíblia do Atalaia",
        ),
      ),
      el(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 20 } },
        snippet
          ? el(
              "div",
              {
                style: {
                  fontSize: snippet.length > 160 ? 34 : 42,
                  lineHeight: 1.35,
                  color: "#f4f1ff",
                  fontWeight: 500,
                  display: "flex",
                },
              },
              `“${snippet}”`,
            )
          : el("div", { style: { display: "flex" } }, ""),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          },
        },
        el(
          "div",
          {
            style: {
              fontSize: 46,
              fontWeight: 700,
              color: "#ffffff",
              display: "flex",
            },
          },
          reference,
        ),
        versionLabel
          ? el(
              "div",
              {
                style: {
                  fontSize: 22,
                  color: "#8a80c4",
                  fontWeight: 600,
                  padding: "8px 16px",
                  border: "1px solid #3a3266",
                  borderRadius: 999,
                  display: "flex",
                },
              },
              versionLabel,
            )
          : el("div", { style: { display: "flex" } }, ""),
      ),
    );

    const svg = await satori(tree as never, {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
        { name: "Inter", data: fontBold, weight: 700, style: "normal" },
      ],
    });

    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } })
      .render()
      .asPng();

    return new Response(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        // Slug is immutable → cache aggressively.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("og image error:", e);
    return new Response("OG image error", { status: 500 });
  }
});