// Shared AI chat completions fetch with fallback to Google Gemini API (user-provided key)
// when Lovable AI Gateway returns 402 (credits exhausted) or 429 (rate limited).

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

function toGeminiModel(model: string): string {
  // Lovable ids look like "google/gemini-2.5-flash" or "openai/gpt-5".
  // Gemini OpenAI-compat endpoint accepts bare Gemini names like "gemini-2.5-flash".
  if (model.startsWith("google/")) {
    const name = model.slice("google/".length);
    // Preview/experimental Lovable ids may not exist on Google direct — map to stable.
    if (name.includes("preview") || name.includes("3-flash") || name.includes("3.1") || name.includes("3.5")) {
      return "gemini-2.5-flash";
    }
    return name;
  }
  // Non-Gemini model requested — best-effort fallback to Gemini flash.
  return "gemini-2.5-flash";
}

export async function aiChatFetch(body: Record<string, unknown>): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  // Try Lovable first if configured
  if (LOVABLE_API_KEY) {
    const res = await fetch(LOVABLE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // Fallback only for credit/rate errors
    if (res.ok || !GEMINI_API_KEY || (res.status !== 402 && res.status !== 429)) {
      return res;
    }
    // Drain body to free connection
    try { await res.text(); } catch { /* ignore */ }
  }

  if (!GEMINI_API_KEY) {
    // Return a synthetic 402 if we have nothing to try
    return new Response(JSON.stringify({ error: "No AI provider available" }), { status: 402 });
  }

  const geminiBody = { ...body, model: toGeminiModel(String(body.model ?? "google/gemini-2.5-flash")) };
  return await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(geminiBody),
  });
}