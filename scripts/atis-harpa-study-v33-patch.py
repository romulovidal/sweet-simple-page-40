from pathlib import Path

ASSISTANT = Path("supabase/functions/_shared/atis/assistant.ts")
WEBHOOK = Path("supabase/functions/atis-webhook/index.ts")
SETTINGS = Path("supabase/functions/atis-destination-settings/index.ts")
TEST = Path("supabase/functions/_shared/atis/harpa-study-routing_test.ts")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


assistant = ASSISTANT.read_text()
assistant = replace_once(
    assistant,
    '  | "harpa_lookup"\n',
    '  | "harpa_lookup"\n  | "harpa_study"\n',
    "assistant route type",
)
assistant = replace_once(
    assistant,
    'const AI_ROUTES = new Set<AtisAssistantRoute>(["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional", "ministry_relation"]);',
    'const AI_ROUTES = new Set<AtisAssistantRoute>(["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional", "harpa_study", "ministry_relation"]);',
    "AI routes",
)
assistant = replace_once(
    assistant,
    'function deterministicIntent(message: string): AtisAssistantRoute | null {\n  const q = normalize(message);\n  if (isMinistryRelationIntent(message)) return "ministry_relation";',
    '''export function isHarpaStudyIntent(message: string, history: AtisConversationMessage[] = []) {\n  const q = normalize(message);\n  const studyCue = /\\b(tema|explique|explicacao|significado|mensagem|estudo|teolog|aplicacao|relacione|relacao|conex|passagens|biblic)\\b/.test(q);\n  if (!studyCue) return false;\n  if (/\\b(harpa|hino)\\b/.test(q)) return true;\n  return [...history].reverse().some((item) => item.role === "assistant" && /Harpa Cristã\\s+\\d{1,3}\\s+—/i.test(item.content));\n}\n\nfunction deterministicIntent(message: string, history: AtisConversationMessage[] = []): AtisAssistantRoute | null {\n  const q = normalize(message);\n  if (isHarpaStudyIntent(message, history)) return "harpa_study";\n  if (isMinistryRelationIntent(message)) return "ministry_relation";''',
    "Harpa study intent",
)
assistant = replace_once(
    assistant,
    'const allowed: AtisAssistantRoute[] = ["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional", "daily_verse", "birthdays", "bible_lookup", "harpa_lookup", "culto_info", "canticos_info", "ministry_relation"];',
    'const allowed: AtisAssistantRoute[] = ["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional", "daily_verse", "birthdays", "bible_lookup", "harpa_lookup", "harpa_study", "culto_info", "canticos_info", "ministry_relation"];',
    "classifier routes",
)
assistant = replace_once(
    assistant,
    '  let route = ministryFollowup?.route ?? deterministicIntent(effectiveInput);',
    '  let route = ministryFollowup?.route ?? deterministicIntent(effectiveInput, history);',
    "deterministic call",
)
assistant = replace_once(
    assistant,
    '''  if (route === "harpa_lookup") {\n    const result = await harpaLookup(supabase, config, effectiveInput, history);\n    return { text: result.text, route, source: "app", reference: ministryFollowup?.carryReference ?? result.reference };\n  }\n''',
    '''  if (route === "harpa_study") {\n    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();\n    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();\n    if (!supabaseUrl || !serviceKey) throw new Error("HARPA_STUDY_SERVER_CONFIG_MISSING");\n    const response = await fetch(`${supabaseUrl}/functions/v1/atis-harpa-study`, {\n      method: "POST",\n      headers: {\n        "Content-Type": "application/json",\n        apikey: serviceKey,\n        Authorization: `Bearer ${serviceKey}`,\n      },\n      body: JSON.stringify({\n        message: effectiveInput,\n        history,\n        conversation_mode: options.conversationMode ?? "normal",\n      }),\n    });\n    const result = await response.json().catch(() => null) as any;\n    if (!response.ok || !firstString(result?.answer)) {\n      const code = firstString(result?.error) ?? "HARPA_STUDY_UNAVAILABLE";\n      throw new Error(code);\n    }\n    return {\n      text: clampText(result.answer),\n      route,\n      source: "ai",\n      reference: ministryFollowup?.carryReference ?? firstString(result.reference),\n    };\n  }\n  if (route === "harpa_lookup") {\n    const result = await harpaLookup(supabase, config, effectiveInput, history);\n    return { text: result.text, route, source: "app", reference: ministryFollowup?.carryReference ?? result.reference };\n  }\n''',
    "Harpa study route handler",
)
ASSISTANT.write_text(assistant)

webhook = WEBHOOK.read_text()
webhook = replace_once(
    webhook,
    'const AI_FEATURE_KEYS = ["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional", "ministry_relation"];',
    'const AI_FEATURE_KEYS = ["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional", "harpa_study", "ministry_relation"];',
    "webhook AI feature keys",
)
webhook = replace_once(
    webhook,
    '  const defaultEnabled = true;\n  const allowedAiRoutes = AI_FEATURE_KEYS.filter((key) => stored.has(key) ? stored.get(key) === true : defaultEnabled);',
    '  const allowedAiRoutes = AI_FEATURE_KEYS.filter((key) => {\n    if (stored.has(key)) return stored.get(key) === true;\n    if (key === "harpa_study") return type !== "group";\n    return true;\n  });',
    "Harpa study default permission",
)
WEBHOOK.write_text(webhook)

settings = SETTINGS.read_text()
settings = replace_once(
    settings,
    '  { kind: "ai", key: "devotional", label: "Devocional", description: "Reflexões devocionais fundamentadas no conteúdo do app." },\n];',
    '  { kind: "ai", key: "devotional", label: "Devocional", description: "Reflexões devocionais fundamentadas no conteúdo do app." },\n  { kind: "ai", key: "harpa_study", label: "Estudo contextual da Harpa", description: "Interpreta a letra real da Harpa e mostra conexões bíblicas somente depois de validá-las no acervo do app." },\n];',
    "Harpa study catalog",
)
SETTINGS.write_text(settings)

TEST.write_text('''import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";\nimport { isHarpaStudyIntent } from "./assistant.ts";\n\nDeno.test("Harpa study detects explicit thematic request", () => {\n  assertEquals(isHarpaStudyIntent("Qual o tema do hino 15?"), true);\n});\n\nDeno.test("Harpa lookup remains non-AI for plain lookup", () => {\n  assertEquals(isHarpaStudyIntent("Harpa 15"), false);\n});\n\nDeno.test("Harpa study resolves contextual follow-up from history", () => {\n  assertEquals(isHarpaStudyIntent("Explique esse hino", [\n    { role: "assistant", content: "🎵 *Harpa Cristã 15 — CONVERSÃO*\\n\\n1ª estrofe..." },\n  ]), true);\n});\n\nDeno.test("Harpa study does not hijack unrelated Bible explanation", () => {\n  assertEquals(isHarpaStudyIntent("Explique João 3:16"), false);\n});\n''')

print("ATIS Harpa study v33 patch applied")
