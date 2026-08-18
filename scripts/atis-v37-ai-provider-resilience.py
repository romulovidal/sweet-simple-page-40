from pathlib import Path

PATH = Path("supabase/functions/_shared/ai-fetch.ts")
text = PATH.read_text()

old_status = '''function shouldTryFallback(status: number): boolean {
  // A provider may return 400 for a retired/unsupported model even when the
  // request is otherwise valid. In that case the next configured provider
  // must still get a chance to answer.
  return status === 400 || status === 401 || status === 402 || status === 403 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}
'''
new_status = '''function isTransientStatus(status: number): boolean {
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
'''
if text.count(old_status) != 1:
    raise SystemExit("status helper anchor not found exactly once")
text = text.replace(old_status, new_status, 1)

start = text.index('function toGroqModel(model: string): string {')
end = text.index('\nfunction toGrokModel', start)
old_groq = text[start:end]
new_groq = '''function toGroqModel(model: string): string {
  const m = String(model || "").toLowerCase();
  if (m.startsWith("groq/")) return m.slice("groq/".length);

  // Preserve model IDs that Groq currently documents as production models.
  // Do not silently rewrite a valid caller choice to a different model family.
  if (m === "llama-3.3-70b-versatile" || m === "llama-3.1-8b-instant") return m;
  if (m.startsWith("openai/gpt-oss-") || m.startsWith("qwen/qwen3.6-")) return m;
  if (m.startsWith("mixtral-") || m.startsWith("gemma") || m.startsWith("deepseek-") || m.startsWith("qwen/")) return m;

  return "llama-3.3-70b-versatile";
}
'''
text = text[:start] + new_groq + text[end:]

old_loop = '''  let lastRes: Response | null = null;
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    try {
      const res = await provider.run();
      if (res.ok) return res;
      lastRes = res;
      const isLast = i === providers.length - 1;
      if (!isLast && shouldTryFallback(res.status)) {
        try {
          const errText = await res.clone().text();
          console.error(`[ai-fetch] ${labels[provider.name]} ${res.status}, trying next fallback. Body:`, errText.slice(0, 400));
        } catch { /* ignore */ }
        continue;
      }
      try {
        const errText = await res.clone().text();
        console.error(`[ai-fetch] ${labels[provider.name]} ${res.status}:`, errText.slice(0, 400));
      } catch { /* ignore */ }
      return res;
    } catch (error) {
      console.error(`[ai-fetch] ${labels[provider.name]} threw:`, (error as Error)?.message);
    }
  }
'''
new_loop = '''  let lastRes: Response | null = null;
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
'''
if text.count(old_loop) != 1:
    raise SystemExit("provider loop anchor not found exactly once")
text = text.replace(old_loop, new_loop, 1)

# Restore the default helper model to the documented Groq production model.
text = text.replace('model: opts.model ?? "openai/gpt-oss-120b",', 'model: opts.model ?? "llama-3.3-70b-versatile",')

PATH.write_text(text)

patched = PATH.read_text()
assert 'return "llama-3.3-70b-versatile";' in patched
assert 'retrying once' in patched
assert 'const maxAttempts = 2;' in patched
assert 'if (m === "llama-3.3-70b-versatile"' in patched
