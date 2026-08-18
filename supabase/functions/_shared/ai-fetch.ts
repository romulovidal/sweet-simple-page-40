// Shared AI chat completions fetch.
// Default app chain: Groq → xAI → Gemini.
// ATIS can explicitly restrict the chain to Groq → Gemini without changing
// the behavior of the rest of the application.
// TTS (audio) is NOT handled here — see tts-verse function.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const XAI_URL = "https://api.x.ai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export type AiProviderName = "groq" | "xai" | "gemini";

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function shouldTryFallback(status: number): boolean {
  // Invalid/retired models, auth/quota errors and transient provider failures
  // should never prevent the next configured provider from being attempted.
  return status === 400 || status === 401 || status === 402 || status === 403 || isTransientStatus(status);
}

function retryDelayMs(attempt: number) {
  return Math.min(750, 180 * (attempt + 1));
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function toGroqModel(model: string): string {
  const m = String(model || "").toLowerCase();
  if (m.startsWith("groq/")) return m.slice("groq/".length);

  // Groq shut down Llama 3.1/3.3 for Free/Developer on 2026-08-16.
  // Use their documented production replacements so ATIS does not depend on
  // an enterprise-only compatibility path.
  if (m === "llama-3.3-70b-versatile") return "openai/gpt-oss-120b";
  if (m === "llama-3.1-8b-instant") return "openai/gpt-oss-20b";
  if (m.startsWith("openai/gpt-oss-") || m.startsWith("qwen/qwen3.6-")) return m;
  if (m.startsWith("mixtral-") || m.startsWith("gemma") || m.startsWith("deepseek-") || m.startsWith("qwen/")) return m;
  return "openai/gpt-oss-120b";
}

function toGrokModel(model: string): string {
  const m = String(model || "").toLowerCase();
  if (m.startsWith("x-ai/") || m.startsWith("grok")) {
    return m.startsWith("x-ai/") ? m.slice("x-ai/".length) : m;
  }
  if (m.includes("pro") || m.includes("gpt-5.5") || m.includes("gpt-5.4") || m.includes("gpt-5.2") || m.includes("o1") || m.includes("thinking")) {
    return "grok-4-fast-reasoning";
  }
  return "grok-4-fast-non-reasoning";
}

function toGeminiModel(model: string): string {
  const raw = String(model || "").toLowerCase();
  const m = raw.startsWith("google/") ? raw.slice("google/".length) : raw;
  if (m.startsWith("gemini-3.6-flash") || m.startsWith("gemini-3.5-flash") || m.startsWith("gemini-3.5-flash-lite")) return m;
  return "gemini-3.6-flash";
}

async function tryGemini(body: Record<string, unknown>, key: string): Promise<Response> {
  // Gemini 3.x deprecates sampling parameters used by older chat callers.
  // Strip them only for the Gemini fallback; Groq keeps the caller payload.
  const { temperature: _temperature, top_p: _topP, top_k: _topK, ...rest } = body as Record<string, unknown>;
  const geminiBody = { ...rest, model: toGeminiModel(String(body.model ?? "gemini-3.6-flash")) };
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

export async function aiChatFetchWithProviders(
  body: Record<string, unknown>,
  providerOrder: AiProviderName[] = ["groq", "xai", "gemini"],
): Promise<Response> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  const available: Record<AiProviderName, (() => Promise<Response>) | null> = {
    groq: GROQ_API_KEY ? () => tryGroq(body, GROQ_API_KEY) : null,
    xai: XAI_API_KEY ? () => tryXai(body, XAI_API_KEY) : null,
    gemini: GEMINI_API_KEY ? () => tryGemini(body, GEMINI_API_KEY) : null,
  };

  const labels: Record<AiProviderName, string> = { groq: "Groq", xai: "xAI", gemini: "Gemini" };
  const uniqueOrder = [...new Set(providerOrder)].filter((name): name is AiProviderName => name in available);
  const providers = uniqueOrder
    .map((name) => ({ name, run: available[name] }))
    .filter((provider): provider is { name: AiProviderName; run: () => Promise<Response> } => typeof provider.run === "function");

  let lastRes: Response | null = null;
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await provider.run();
        if (res.ok) return res;
        lastRes = res;

        const retrySameProvider = attempt + 1 < maxAttempts && isTransientStatus(res.status);
        if (retrySameProvider) {
          try {
            const errText = await res.clone().text();
            console.error(`[ai-fetch] ${labels[provider.name]} ${res.status}, retrying once. Body:`, errText.slice(0, 400));
          } catch { /* ignore */ }
          await wait(retryDelayMs(attempt));
          continue;
        }

        const isLastProvider = i === providers.length - 1;
        if (!isLastProvider && shouldTryFallback(res.status)) {
          try {
            const errText = await res.clone().text();
            console.error(`[ai-fetch] ${labels[provider.name]} ${res.status}, trying next fallback. Body:`, errText.slice(0, 400));
          } catch { /* ignore */ }
          break;
        }

        try {
          const errText = await res.clone().text();
          console.error(`[ai-fetch] ${labels[provider.name]} ${res.status}:`, errText.slice(0, 400));
        } catch { /* ignore */ }
        return res;
      } catch (error) {
        console.error(`[ai-fetch] ${labels[provider.name]} threw:`, (error as Error)?.message);
        if (attempt + 1 < maxAttempts) {
          await wait(retryDelayMs(attempt));
          continue;
        }
        break;
      }
    }
  }

  if (lastRes) return lastRes;
  return new Response(JSON.stringify({ error: "No AI provider available" }), { status: 402 });
}

export async function aiChatFetch(body: Record<string, unknown>): Promise<Response> {
  return await aiChatFetchWithProviders(body, ["groq", "xai", "gemini"]);
}

// Backwards-compat helper retained for older imports.
async function _legacyGeminiOnly(body: Record<string, unknown>): Promise<Response> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (GEMINI_API_KEY) return await tryGemini(body, GEMINI_API_KEY);
  return new Response(JSON.stringify({ error: "No AI provider available" }), { status: 402 });
}

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
      model: opts.model ?? "openai/gpt-oss-120b",
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
    const body = await res.json().catch(() => null) as any;
    const text = body?.choices?.[0]?.message?.content ?? "";
    return typeof text === "string" ? text.trim().replace(/^"|"$/g, "") : "";
  } catch (error) {
    console.error("[ai-generate] threw:", (error as Error)?.message);
    return "";
  }
}

export function hasAnyAiKey(): boolean {
  return !!(
    Deno.env.get("GROQ_API_KEY") ||
    Deno.env.get("XAI_API_KEY") ||
    Deno.env.get("GEMINI_API_KEY")
  );
}
