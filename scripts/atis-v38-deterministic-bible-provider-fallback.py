from pathlib import Path

ASSISTANT = Path("supabase/functions/_shared/atis/assistant.ts")
AI = Path("supabase/functions/_shared/ai-fetch.ts")
TEST = Path("supabase/functions/_shared/atis/context-routing_test.ts")

assistant = ASSISTANT.read_text()
old = '''    if (/\\b(mostre|leia|texto de|o que diz|qual diz|versiculo|o que esta escrito)\\b/.test(q)) return "bible_lookup";\n    return "ask_bible";'''
new = '''    // A bare/explicit Bible reference is a direct app lookup and must not depend on AI.\n    // Only explanatory language promotes it to the conversational Bible route.\n    if (/\\b(explique|explicacao|significa|significado|comente|comentario|entenda|interprete|interpretacao|ensina|quer dizer|por que|porque)\\b|\\bfale sobre\\b/.test(q)) return "ask_bible";\n    return "bible_lookup";'''
if assistant.count(old) != 1:
    raise SystemExit(f"assistant explicit-reference anchor count={assistant.count(old)}")
assistant = assistant.replace(old, new, 1)
ASSISTANT.write_text(assistant)

ai = AI.read_text()
start = ai.index('function toGroqModel(model: string): string {')
end = ai.index('\nfunction toGrokModel', start)
ai = ai[:start] + '''function toGroqModel(model: string): string {\n  const m = String(model || "").toLowerCase();\n  if (m.startsWith("groq/")) return m.slice("groq/".length);\n\n  // Groq shut down Llama 3.1/3.3 for Free/Developer on 2026-08-16.\n  // Use their documented production replacements so ATIS does not depend on\n  // an enterprise-only compatibility path.\n  if (m === "llama-3.3-70b-versatile") return "openai/gpt-oss-120b";\n  if (m === "llama-3.1-8b-instant") return "openai/gpt-oss-20b";\n  if (m.startsWith("openai/gpt-oss-") || m.startsWith("qwen/qwen3.6-")) return m;\n  if (m.startsWith("mixtral-") || m.startsWith("gemma") || m.startsWith("deepseek-") || m.startsWith("qwen/")) return m;\n  return "openai/gpt-oss-120b";\n}\n''' + ai[end:]

start = ai.index('function toGeminiModel(model: string): string {')
end = ai.index('\nasync function tryGemini', start)
ai = ai[:start] + '''function toGeminiModel(model: string): string {\n  const raw = String(model || "").toLowerCase();\n  const m = raw.startsWith("google/") ? raw.slice("google/".length) : raw;\n  if (m.startsWith("gemini-3.6-flash") || m.startsWith("gemini-3.5-flash") || m.startsWith("gemini-3.5-flash-lite")) return m;\n  return "gemini-3.6-flash";\n}\n''' + ai[end:]

old_try = '''async function tryGemini(body: Record<string, unknown>, key: string): Promise<Response> {\n  const geminiBody = { ...body, model: toGeminiModel(String(body.model ?? "google/gemini-2.5-flash")) };\n  return await fetch(GEMINI_URL, {\n    method: "POST",\n    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },\n    body: JSON.stringify(geminiBody),\n  });\n}\n'''
new_try = '''async function tryGemini(body: Record<string, unknown>, key: string): Promise<Response> {\n  // Gemini 3.x deprecates sampling parameters used by older chat callers.\n  // Strip them only for the Gemini fallback; Groq keeps the caller payload.\n  const { temperature: _temperature, top_p: _topP, top_k: _topK, ...rest } = body as Record<string, unknown>;\n  const geminiBody = { ...rest, model: toGeminiModel(String(body.model ?? "gemini-3.6-flash")) };\n  return await fetch(GEMINI_URL, {\n    method: "POST",\n    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },\n    body: JSON.stringify(geminiBody),\n  });\n}\n'''
if ai.count(old_try) != 1:
    raise SystemExit(f"Gemini helper anchor count={ai.count(old_try)}")
ai = ai.replace(old_try, new_try, 1)
ai = ai.replace('model: opts.model ?? "llama-3.3-70b-versatile",', 'model: opts.model ?? "openai/gpt-oss-120b",')
AI.write_text(ai)

test = TEST.read_text()
needle = '''Deno.test("explicit Bible reference overrides stale Harpa context", () => {\n  assertEquals(deterministicIntent("Explique Lucas 21:20", harpaHistory), "ask_bible");\n  assertEquals(deterministicIntent("Mostre Mateus 26:1-6", harpaHistory), "bible_lookup");\n  assertEquals(deterministicIntent("Explique esse hino", harpaHistory), "harpa_study");\n});'''
replacement = '''Deno.test("explicit Bible reference overrides stale Harpa context", () => {\n  assertEquals(deterministicIntent("João 3:17", harpaHistory), "bible_lookup");\n  assertEquals(deterministicIntent("Mostre Mateus 26:1-6", harpaHistory), "bible_lookup");\n  assertEquals(deterministicIntent("Explique Lucas 21:20", harpaHistory), "ask_bible");\n  assertEquals(deterministicIntent("O que significa João 3:17?", harpaHistory), "ask_bible");\n  assertEquals(deterministicIntent("Explique esse hino", harpaHistory), "harpa_study");\n});'''
if test.count(needle) != 1:
    raise SystemExit("context routing test anchor not found")
TEST.write_text(test.replace(needle, replacement, 1))

patched = ASSISTANT.read_text()
assert 'deterministicIntent("João 3:17"' not in patched
assert 'return "bible_lookup";' in patched
assert 'fale sobre' in patched
ai2 = AI.read_text()
assert 'return "openai/gpt-oss-120b";' in ai2
assert 'return "gemini-3.6-flash";' in ai2
assert 'temperature: _temperature' in ai2
