// Shared AI chat completions fetch.
// Primary: Groq (OpenAI-compatible) — generous free tier.
// Fallback 1: xAI (Grok) via OpenAI-compatible endpoint.
// Fallback 2: Google Gemini (user-provided key).
// Fallback 3: Removed (Lovable AI Gateway).
// TTS (audio) is NOT handled here — see tts-verse function.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const XAI_URL = "https://api.x.ai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";


function shouldTryFallback(status: number): boolean {
  return status === 401 || status === 402 || status === 403 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

// Map any legacy model id to a supported Groq model.
// Default: llama-3.3-70b-versatile — fast, high quality, great for chat/devotional.
// Reasoning-heavy tasks map to the same (Groq's llama-3.3-70b handles reasoning well).
function toGroqModel(model: string): string {
  const m = String(model || "").toLowerCase();
  if (m.startsWith("groq/")) return m.slice("groq/".length);
  // Pass through if it already looks like a Groq model id.
  if (m.startsWith("llama-") || m.startsWith("mixtral-") || m.startsWith("gemma") || m.startsWith("deepseek-") || m.startsWith("qwen")) {
    return m;
  }
  return "llama-3.3-70b-versatile";
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


async function tryGemini(body: Record<string, unknown>, key: string): Promise<Response> {
  const geminiBody = { ...body, model: toGeminiModel(String(body.model ?? "google/gemini-2.5-flash")) };
  return await fetch(GEMINI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  });
}

async function tryGroq(body: Record<string, unknown>, key: string): Promise<Response> {
  const groqBody = { ...body, model: toGroqModel(String(body.model ?? "")) };
  return await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(groqBody),
  });
}

async function tryXai(body: Record<string, unknown>, key: string): Promise<Response> {
  const grokBody = { ...body, model: toGrokModel(String(body.model ?? "grok-4-fast-non-reasoning")) };
  return await fetch(XAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(grokBody),
  });
}

export async function aiChatFetch(body: Record<string, unknown>): Promise<Response> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  

  // Ordered provider chain: Groq → xAI → Gemini.
  const providers: Array<{ name: string; run: () => Promise<Response> }> = [];
  if (GROQ_API_KEY) providers.push({ name: "Groq", run: () => tryGroq(body, GROQ_API_KEY) });
  if (XAI_API_KEY) providers.push({ name: "xAI", run: () => tryXai(body, XAI_API_KEY) });
  if (GEMINI_API_KEY) providers.push({ name: "Gemini", run: () => tryGemini(body, GEMINI_API_KEY) });

  let lastRes: Response | null = null;
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    try {
      const res = await p.run();
      if (res.ok) return res;
      lastRes = res;
      const isLast = i === providers.length - 1;
      if (!isLast && shouldTryFallback(res.status)) {
        try {
          const errText = await res.clone().text();
          console.error(`[ai-fetch] ${p.name} ${res.status}, trying next fallback. Body:`, errText.slice(0, 400));
        } catch { /* ignore */ }
        continue;
      }
      try {
        const errText = await res.clone().text();
        console.error(`[ai-fetch] ${p.name} ${res.status}:`, errText.slice(0, 400));
      } catch { /* ignore */ }
      return res;
    } catch (e) {
      console.error(`[ai-fetch] ${p.name} threw:`, (e as Error)?.message);
    }
  }
  if (lastRes) return lastRes;
  return new Response(JSON.stringify({ error: "No AI provider available" }), { status: 402 });
}

// Backwards-compat helpers used elsewhere in the code — untouched below.
async function _legacyGeminiOnly(body: Record<string, unknown>): Promise<Response> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (GEMINI_API_KEY) {
    return await tryGemini(body, GEMINI_API_KEY);
  }
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
      model: opts.model ?? "llama-3.3-70b-versatile",
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

// Returns true if ANY AI provider is configured (Groq, xAI, or Gemini).
export function hasAnyAiKey(): boolean {
  return !!(
    Deno.env.get("GROQ_API_KEY") ||
    Deno.env.get("XAI_API_KEY") ||
    Deno.env.get("GEMINI_API_KEY")
  );
}