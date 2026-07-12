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

  // Prefer Gemini directly when the user provided their own key.
  if (GEMINI_API_KEY) {
    const geminiBody = { ...body, model: toGeminiModel(String(body.model ?? "google/gemini-2.5-flash")) };
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiBody),
    });

    // If Gemini rate-limits, exhausts quota, or rejects the key (403 leaked/permission),
    // log the real reason and try Lovable AI as a fallback when available.
    if ((res.status === 429 || res.status === 402 || res.status === 403) && LOVABLE_API_KEY) {
      try {
        const cloned = res.clone();
        const errText = await cloned.text();
        console.error(`[ai-fetch] Gemini ${res.status}, falling back to Lovable. Body:`, errText.slice(0, 500));
      } catch { /* ignore */ }
      return await fetch(LOVABLE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    }

    if (!res.ok) {
      try {
        const cloned = res.clone();
        const errText = await cloned.text();
        console.error(`[ai-fetch] Gemini ${res.status}:`, errText.slice(0, 500));
      } catch { /* ignore */ }
    }

    return res;
  }

  // Fallback to Lovable if no Gemini key.
  if (LOVABLE_API_KEY) {
    const res = await fetch(LOVABLE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return res;
  }

  return new Response(JSON.stringify({ error: "No AI provider available" }), { status: 402 });
}