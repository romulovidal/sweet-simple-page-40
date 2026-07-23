// Shared AI chat completions fetch.
// Primary: xAI (Grok) via OpenAI-compatible endpoint.
// Fallback 1: Google Gemini (user-provided key) when xAI returns 429/402/5xx.
// Fallback 2: Lovable AI Gateway when both above are unavailable.
// TTS (audio) is NOT handled here — see tts-verse function.

const XAI_URL = "https://api.x.ai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function shouldTryFallback(status: number): boolean {
  return status === 401 || status === 402 || status === 403 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

// Map any legacy model id (google/*, openai/*) to a supported Grok model.
// Defaults to grok-4-fast-non-reasoning: fast, cheap, no reasoning overhead —
// ideal for chat, devotionals, push copy, quick lookups.
// For heavier Bible study tools (exegese, contexto histórico) use grok-4-fast-reasoning.
function toGrokModel(model: string): string {
  const m = String(model || "").toLowerCase();
  if (m.startsWith("x-ai/") || m.startsWith("grok")) {
    return m.startsWith("x-ai/") ? m.slice("x-ai/".length) : m;
  }
  // Heavier reasoning tasks — map "pro" / "gpt-5" / "gpt-5.5" / "gemini-*-pro" to reasoning variant.
  if (m.includes("pro") || m.includes("gpt-5.5") || m.includes("gpt-5.4") || m.includes("gpt-5.2") || m.includes("o1") || m.includes("thinking")) {
    return "grok-4-fast-reasoning";
  }
  // Default: fast non-reasoning for everything else.
  return "grok-4-fast-non-reasoning";
}

function toGeminiModel(model: string): string {
  if (model.startsWith("google/")) {
    const name = model.slice("google/".length);
    if (name.includes("preview") || name.includes("3-flash") || name.includes("3.1") || name.includes("3.5") || name.includes("3.6")) {
      return "gemini-2.5-flash";
    }
    return name;
  }
  return "gemini-2.5-flash";
}

async function tryLovable(body: Record<string, unknown>, key: string): Promise<Response> {
  const rawModel = String(body.model ?? "");
  const lovableBody = {
    ...body,
    // The Lovable gateway requires catalog ids with a vendor prefix. If the
    // upstream call was prepared for direct xAI, switch to the known Gemini
    // chat fallback instead of sending a bare Grok model id.
    model: rawModel.startsWith("grok") || rawModel.startsWith("x-ai/") || !rawModel
      ? "google/gemini-2.5-flash"
      : rawModel,
  };
  return await fetch(LOVABLE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(lovableBody),
  });
}

async function tryGemini(body: Record<string, unknown>, key: string): Promise<Response> {
  const geminiBody = { ...body, model: toGeminiModel(String(body.model ?? "google/gemini-2.5-flash")) };
  return await fetch(GEMINI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  });
}

export async function aiChatFetch(body: Record<string, unknown>): Promise<Response> {
  const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // Primary: xAI Grok
  if (XAI_API_KEY) {
    const grokBody = { ...body, model: toGrokModel(String(body.model ?? "grok-4-fast-non-reasoning")) };
    const res = await fetch(XAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${XAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(grokBody),
    });

    // Provider/key/quota failure → try fallbacks. xAI returns 403 when the
    // team has no credits, so 403 must not stop the whole app.
    if (shouldTryFallback(res.status)) {
      try {
        const errText = await res.clone().text();
        console.error(`[ai-fetch] xAI ${res.status}, trying fallback. Body:`, errText.slice(0, 400));
      } catch { /* ignore */ }

      if (GEMINI_API_KEY) {
        const gRes = await tryGemini(body, GEMINI_API_KEY);
        if (gRes.ok) return gRes;
        if (shouldTryFallback(gRes.status) && LOVABLE_API_KEY) {
          try {
            const errText = await gRes.clone().text();
            console.error(`[ai-fetch] Gemini ${gRes.status}, trying Lovable fallback. Body:`, errText.slice(0, 400));
          } catch { /* ignore */ }
          return await tryLovable(body, LOVABLE_API_KEY);
        }
        return gRes;
      }
      if (LOVABLE_API_KEY) return await tryLovable(body, LOVABLE_API_KEY);
    }

    if (!res.ok) {
      try {
        const errText = await res.clone().text();
        console.error(`[ai-fetch] xAI ${res.status}:`, errText.slice(0, 400));
      } catch { /* ignore */ }
    }
    return res;
  }

  // No xAI key → Gemini
  if (GEMINI_API_KEY) {
    const res = await tryGemini(body, GEMINI_API_KEY);
    if (shouldTryFallback(res.status) && LOVABLE_API_KEY) {
      try {
        const errText = await res.clone().text();
        console.error(`[ai-fetch] Gemini ${res.status}, falling back to Lovable. Body:`, errText.slice(0, 400));
      } catch { /* ignore */ }
      return await tryLovable(body, LOVABLE_API_KEY);
    }
    if (!res.ok) {
      try {
        const errText = await res.clone().text();
        console.error(`[ai-fetch] Gemini ${res.status}:`, errText.slice(0, 400));
      } catch { /* ignore */ }
    }
    return res;
  }

  // Last resort: Lovable
  if (LOVABLE_API_KEY) return await tryLovable(body, LOVABLE_API_KEY);

  return new Response(JSON.stringify({ error: "No AI provider available" }), { status: 402 });
}

// Convenience: single-shot text generation. Returns generated text or '' on failure.
// Use this in place of native Gemini `generateContent` calls so everything routes
// through the same xAI Grok → Gemini → Lovable chain.
export async function aiGenerateText(opts: {
  system?: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.user });
  try {
    const res = await aiChatFetch({
      model: opts.model ?? "grok-4-fast-non-reasoning",
      messages,
      temperature: opts.temperature ?? 0.9,
      max_tokens: opts.maxTokens ?? 2048,
    });
    if (!res.ok) {
      try {
        const errText = await res.clone().text();
        console.error(`[ai-generate] ${res.status}:`, errText.slice(0, 300));
      } catch { /* ignore */ }
      return "";
    }
    const j = await res.json().catch(() => null) as any;
    const text = j?.choices?.[0]?.message?.content ?? "";
    return typeof text === "string" ? text.trim().replace(/^"|"$/g, "") : "";
  } catch (e) {
    console.error("[ai-generate] threw:", (e as Error)?.message);
    return "";
  }
}

// Returns true if ANY AI provider is configured (xAI, Gemini, or Lovable).
export function hasAnyAiKey(): boolean {
  return !!(
    Deno.env.get("XAI_API_KEY") ||
    Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("LOVABLE_API_KEY")
  );
}