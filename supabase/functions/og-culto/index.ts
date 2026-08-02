// Imagem Open Graph dinâmica para seleções de culto (1200x630 PNG).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import satori, { init as initSatori } from "https://esm.sh/satori@0.10.14/wasm";
import initYoga from "https://esm.sh/yoga-wasm-web@0.3.3";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const YOGA_WASM = "https://unpkg.com/yoga-wasm-web@0.3.3/dist/yoga.wasm";
const RESVG_WASM = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const FONT_REGULAR =
  "https://unpkg.com/@fontsource/inter@5.0.16/files/inter-latin-400-normal.woff";
const FONT_BOLD =
  "https://unpkg.com/@fontsource/inter@5.0.16/files/inter-latin-700-normal.woff";

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

function el(type: string, props: Record<string, unknown>, ...children: unknown[]): unknown {
  return { type, props: { ...props, children: children.length <= 1 ? children[0] : children } };
}

function fmtDate(iso: string) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
      .toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        timeZone: "UTC",
      })
      .toUpperCase();
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
    const slug = last.replace(/\.png$/i, "");
    if (!slug || !/^[A-Za-z0-9]{4,12}$/.test(slug)) {
      return new Response("Not Found", { status: 404 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("culto_selections")
      .select("title, culto_date, items, is_active")
      .eq("share_slug", slug)
      .maybeSingle();

    if (error || !data || data.is_active === false) {
      return new Response("Not Found", { status: 404 });
    }

    const items = (data.items ?? []) as Array<{ hino_number: number }>;
    const numbers = items.map((it) => it.hino_number);
    const shown = numbers.slice(0, 8);
    const rest = numbers.length - shown.length;
    const title = String(data.title ?? "Seleção de Hinos");

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
          background: "linear-gradient(135deg,#1a1436 0%,#0b0b1a 55%,#0a1a2a 100%)",
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
              fontSize: 24,
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
          "Harpa Atalaia · Seleção do culto",
        ),
      ),
      el(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 18 } },
        el(
          "div",
          {
            style: {
              fontSize: title.length > 30 ? 52 : 64,
              fontWeight: 700,
              color: "#ffffff",
              display: "flex",
              lineHeight: 1.15,
            },
          },
          title,
        ),
        el(
          "div",
          { style: { fontSize: 24, color: "#b3a9e6", fontWeight: 600, display: "flex" } },
          fmtDate(String(data.culto_date ?? "")),
        ),
        el(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 } },
          ...shown.map((n) =>
            el(
              "div",
              {
                style: {
                  display: "flex",
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#e9e4ff",
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: "1px solid #3a3266",
                  background: "rgba(124,107,255,0.14)",
                },
              },
              String(n),
            )
          ),
          rest > 0
            ? el(
                "div",
                {
                  style: {
                    display: "flex",
                    fontSize: 30,
                    fontWeight: 600,
                    color: "#8a80c4",
                    padding: "10px 18px",
                  },
                },
                `+${rest}`,
              )
            : el("div", { style: { display: "flex" } }, ""),
        ),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 22,
            color: "#8a80c4",
            fontWeight: 600,
          },
        },
        el(
          "div",
          { style: { display: "flex" } },
          `${numbers.length} hino${numbers.length === 1 ? "" : "s"}`,
        ),
        el("div", { style: { display: "flex" } }, "Bíblia do Atalaia"),
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

    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();

    return new Response(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("og-culto error:", e);
    return new Response("OG image error", { status: 500 });
  }
});
