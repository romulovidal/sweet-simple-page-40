from pathlib import Path

ASSISTANT = Path('supabase/functions/_shared/atis/assistant.ts')
WEBHOOK = Path('supabase/functions/atis-webhook/index.ts')
AI_FETCH = Path('supabase/functions/_shared/ai-fetch.ts')

assistant = ASSISTANT.read_text()

old = '''  const history = Array.isArray(options.conversationHistory)\n    ? options.conversationHistory\n        .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())\n        .slice(-40)\n    : [];'''
new = '''  // Structured memory carries long-lived context. Keep only the most recent\n  // conversational turns in the AI prompt so Free/Developer provider TPM\n  // limits are not consumed by replaying the entire WhatsApp transcript.\n  const history = Array.isArray(options.conversationHistory)\n    ? options.conversationHistory\n        .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())\n        .slice(-8)\n    : [];'''
if assistant.count(old) != 1:
    raise SystemExit(f'assistant history anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)

old = '''  let route = ministryFollowup?.route ?? deterministicIntent(effectiveInput, history);\n  if (!route) route = await classifyWithAi(config.systemPrompt, effectiveInput, history);'''
new = '''  let route = ministryFollowup?.route ?? deterministicIntent(effectiveInput, history);\n  // All specialized ATIS capabilities already have deterministic cues. For an\n  // otherwise open conversational question, ask_bible is the safe default.\n  // This avoids spending a full provider request only to classify a message\n  // before immediately making a second provider request to answer it.\n  if (!route) route = "ask_bible";'''
if assistant.count(old) != 1:
    raise SystemExit(f'assistant route anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)

old = '''    max_tokens: conversationMode === "study" ? 2800 : conversationMode === "concise" ? 900 : route === "exegetai" ? 2600 : 1800,'''
new = '''    // WhatsApp output is clamped to ~3.8k characters later, so reserving\n    // 1.8k-2.8k output tokens only wastes TPM. Keep enough room for a useful\n    // answer while staying compatible with Groq's Free/Developer token budget.\n    max_tokens: conversationMode === "study" ? 1200 : conversationMode === "concise" ? 450 : route === "exegetai" ? 1400 : 900,'''
if assistant.count(old) != 1:
    raise SystemExit(f'assistant max_tokens anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)

old = '''  if (!response.ok) {\n    console.error("[atis-assistant] AI provider failed", response.status, (await response.text().catch(() => "")).slice(0, 300));\n    throw new Error("AI_PROVIDER_UNAVAILABLE");\n  }'''
new = '''  if (!response.ok) {\n    const diagnostic = response.headers.get("x-atis-ai-diagnostic")?.slice(0, 420) ?? "";\n    console.error("[atis-assistant] AI provider failed", response.status, diagnostic, (await response.text().catch(() => "")).slice(0, 300));\n    throw new Error(diagnostic ? `AI_PROVIDER_UNAVAILABLE|${diagnostic}` : "AI_PROVIDER_UNAVAILABLE");\n  }'''
if assistant.count(old) != 1:
    raise SystemExit(f'assistant failure anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)
ASSISTANT.write_text(assistant)

webhook = WEBHOOK.read_text()
old = '''      const conversationHistory = structuredContext.messages.length\n        ? [...history, ...structuredContext.messages]\n        : history;'''
new = '''      const conversationHistory = structuredContext.messages.length\n        ? [...history, ...structuredContext.messages]\n        : history;\n      // Keep deterministic/structured memory available while bounding what is\n      // actually handed to AI. Four recent turns are enough for natural\n      // continuity and dramatically reduce provider TPM pressure.\n      const assistantHistory = conversationHistory.slice(-8);'''
if webhook.count(old) != 1:
    raise SystemExit(f'webhook history anchor count={webhook.count(old)}')
webhook = webhook.replace(old, new, 1)
webhook = webhook.replace('''        conversationHistory,\n        conversationMode:''', '''        conversationHistory: assistantHistory,\n        conversationMode:''', 1)
webhook = webhook.replace('''          assistant_context_messages_used: conversationHistory.length,''', '''          assistant_context_messages_used: assistantHistory.length,''', 1)
WEBHOOK.write_text(webhook)

ai = AI_FETCH.read_text()
start = ai.index('export async function aiChatFetchWithProviders(')
end = ai.index('\nexport async function aiChatFetch(body:', start)
new_fn = r'''export async function aiChatFetchWithProviders(
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
  const modelFor = (name: AiProviderName) => {
    const requested = String(body.model ?? "");
    if (name === "groq") return toGroqModel(requested);
    if (name === "xai") return toGrokModel(requested);
    return toGeminiModel(requested);
  };
  const uniqueOrder = [...new Set(providerOrder)].filter((name): name is AiProviderName => name in available);
  const providers = uniqueOrder
    .map((name) => ({ name, run: available[name] }))
    .filter((provider): provider is { name: AiProviderName; run: () => Promise<Response> } => typeof provider.run === "function");

  type Attempt = {
    provider: AiProviderName;
    model: string;
    attempt: number;
    status: number | "throw";
    ms: number;
    retry_after?: string;
    remaining_tokens?: string;
    reset_tokens?: string;
    remaining_requests?: string;
    detail?: string;
  };
  const attempts: Attempt[] = [];
  const compactDiagnostics = () => attempts.map((item) => [
    `${item.provider}/${item.model}`,
    `a${item.attempt}`,
    String(item.status),
    item.remaining_tokens ? `tok=${item.remaining_tokens}` : null,
    item.reset_tokens ? `tokreset=${item.reset_tokens}` : null,
    item.remaining_requests ? `req=${item.remaining_requests}` : null,
    item.retry_after ? `retry=${item.retry_after}` : null,
    item.detail ? `msg=${item.detail}` : null,
  ].filter(Boolean).join(':')).join('|').slice(0, 1400);

  let lastRes: Response | null = null;
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const startedAt = Date.now();
      try {
        const res = await provider.run();
        if (res.ok) {
          console.info(`[ai-fetch] success ${provider.name}/${modelFor(provider.name)} a${attempt + 1} ${Date.now() - startedAt}ms`);
          return res;
        }
        lastRes = res;
        const errText = await res.clone().text().catch(() => "");
        const detail = errText.replace(/\s+/g, ' ').slice(0, 180);
        attempts.push({
          provider: provider.name,
          model: modelFor(provider.name),
          attempt: attempt + 1,
          status: res.status,
          ms: Date.now() - startedAt,
          retry_after: res.headers.get('retry-after') ?? undefined,
          remaining_tokens: res.headers.get('x-ratelimit-remaining-tokens') ?? undefined,
          reset_tokens: res.headers.get('x-ratelimit-reset-tokens') ?? undefined,
          remaining_requests: res.headers.get('x-ratelimit-remaining-requests') ?? undefined,
          detail: detail || undefined,
        });

        const retrySameProvider = attempt + 1 < maxAttempts && isTransientStatus(res.status);
        if (retrySameProvider) {
          console.error(`[ai-fetch] ${labels[provider.name]} ${res.status}, retrying once.`, detail);
          await wait(retryDelayMs(attempt));
          continue;
        }

        const isLastProvider = i === providers.length - 1;
        if (!isLastProvider && shouldTryFallback(res.status)) {
          console.error(`[ai-fetch] ${labels[provider.name]} ${res.status}, trying next fallback.`, detail);
          break;
        }

        console.error(`[ai-fetch] ${labels[provider.name]} ${res.status}:`, detail);
        const headers = new Headers(res.headers);
        headers.set('x-atis-ai-diagnostic', compactDiagnostics());
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
      } catch (error) {
        const detail = String((error as Error)?.message ?? error).replace(/\s+/g, ' ').slice(0, 180);
        attempts.push({
          provider: provider.name,
          model: modelFor(provider.name),
          attempt: attempt + 1,
          status: 'throw',
          ms: Date.now() - startedAt,
          detail,
        });
        console.error(`[ai-fetch] ${labels[provider.name]} threw:`, detail);
        if (attempt + 1 < maxAttempts) {
          await wait(retryDelayMs(attempt));
          continue;
        }
        break;
      }
    }
  }

  const diagnostic = compactDiagnostics();
  console.error('[ai-fetch] all configured providers exhausted', diagnostic);
  if (lastRes) {
    const headers = new Headers(lastRes.headers);
    headers.set('x-atis-ai-diagnostic', diagnostic);
    return new Response(lastRes.body, { status: lastRes.status, statusText: lastRes.statusText, headers });
  }
  return new Response(JSON.stringify({ error: "No AI provider available" }), {
    status: 503,
    headers: { "Content-Type": "application/json", "x-atis-ai-diagnostic": diagnostic || "no-configured-provider" },
  });
}
'''
ai = ai[:start] + new_fn + ai[end:]
AI_FETCH.write_text(ai)

# Safety assertions
assert '.slice(-8)' in ASSISTANT.read_text()
assert 'if (!route) route = "ask_bible";' in ASSISTANT.read_text()
assert 'max_tokens: conversationMode === "study" ? 1200' in ASSISTANT.read_text()
assert 'assistantHistory = conversationHistory.slice(-8)' in WEBHOOK.read_text()
assert 'x-atis-ai-diagnostic' in AI_FETCH.read_text()
