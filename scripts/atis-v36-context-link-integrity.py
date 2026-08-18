from pathlib import Path

ASSISTANT = Path("supabase/functions/_shared/atis/assistant.ts")
RUNTIME = Path("supabase/functions/_shared/atis/conversation-runtime.ts")
LINK_TEST = Path("supabase/functions/_shared/atis/link-policy_test.ts")
ROUTING_TEST = Path("supabase/functions/_shared/atis/context-routing_test.ts")


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, got {count}")
    return text.replace(old, new, 1)


assistant = ASSISTANT.read_text()

normalize_anchor = '''function normalize(value: string) {
  return value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[.,;!?()[\\]{}]/g, " ").replace(/\\s+/g, " ").trim();
}
'''
normalize_new = normalize_anchor + r'''

export function hasExplicitBibleReferenceCue(message: string) {
  if (!/\d/.test(message)) return false;
  const q = ` ${normalize(message)} `;
  for (const canonical of CANONICAL_BOOKS) {
    const aliases = [canonical, ...(EXTRA_ALIASES[canonical] ?? [])];
    for (const alias of aliases) {
      const token = normalize(alias);
      if (!token) continue;
      const marker = ` ${token} `;
      const index = q.indexOf(marker);
      if (index < 0) continue;
      const tail = q.slice(index + marker.length).trimStart();
      if (/^\d{1,3}(?:\s*:\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?)?\b/.test(tail)) return true;
    }
  }
  return false;
}

export function stripGeneratedUrls(value: string) {
  let output = value.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_full, label) => String(label));
  output = output.replace(/https?:\/\/[^\s<>"')\]]+/gi, "");
  return output.replace(/\n{3,}/g, "\n\n").trim();
}
'''
assistant = once(assistant, normalize_anchor, normalize_new, "Bible reference and URL helpers")

old_intent = '''function deterministicIntent(message: string, history: AtisConversationMessage[] = []): AtisAssistantRoute | null {
  const q = normalize(message);
  if (isHarpaStudyIntent(message, history)) return "harpa_study";'''
new_intent = '''export function deterministicIntent(message: string, history: AtisConversationMessage[] = []): AtisAssistantRoute | null {
  const q = normalize(message);
  const explicitBibleReference = hasExplicitBibleReferenceCue(message);
  if (explicitBibleReference) {
    if (/significado original|etimolog|hebraic|grego|aramaic|raiz da palavra/.test(q)) return "word_meaning";
    if (/conex(ao|oes)|referenc(ia|ias) cruzad|profecia.*cumpr|cumprimento.*profecia|interligad/.test(q)) return "connections";
    if (/linha do tempo|contexto histor|cronolog|imperio|costume da epoca|periodo histor/.test(q)) return "timeline";
    if (/\\b(resumo|resuma|sintese|sintetize|pontos[- ]?chave)\\b/.test(q)) return "chapter_summary";
    if (/\\b(exegese|exeget|estudo aprofundado|analise teologica|teologia profunda)\\b/.test(q)) return "exegetai";
    if (/\\b(devocional|reflexao devocional)\\b/.test(q)) return "devotional";
    if (/\\b(mostre|leia|texto de|o que diz|qual diz|versiculo|o que esta escrito)\\b/.test(q)) return "bible_lookup";
    return "ask_bible";
  }
  if (isHarpaStudyIntent(message, history)) return "harpa_study";'''
assistant = once(assistant, old_intent, new_intent, "explicit Bible routing priority")

assistant = once(
    assistant,
    '  const guarded = guardUngroundedBibleQuotes(text, bibleContext?.text ?? null);',
    '  const guarded = guardUngroundedBibleQuotes(stripGeneratedUrls(text), bibleContext?.text ?? null);',
    "specialist generated URL stripping",
)
assistant = once(
    assistant,
    '    let answerText = clampText(result.answer);',
    '    let answerText = clampText(stripGeneratedUrls(result.answer));',
    "Harpa generated URL stripping",
)
assistant = once(
    assistant,
    '      guardUngroundedBibleQuotes(generated, ministryBibleContext?.text ?? null),',
    '      guardUngroundedBibleQuotes(stripGeneratedUrls(generated), ministryBibleContext?.text ?? null),',
    "ministry generated URL stripping",
)

old_dedupe = '''    if (output.includes(canonical.text)) {
      if (linkLine && !output.includes(linkMatch![0])) output = output.replace(canonical.text, `${canonical.text}\\n\\n${linkLine}`);
      continue;
    }'''
new_dedupe = '''    const rawCanonicalPresent = output.includes(canonical.text);
    const normalizedCanonicalPresent = normalizedQuote(output).includes(normalizedQuote(canonical.text));
    if (rawCanonicalPresent || normalizedCanonicalPresent) {
      if (linkLine && !output.includes(linkMatch![0])) {
        output = rawCanonicalPresent
          ? output.replace(canonical.text, `${canonical.text}\\n\\n${linkLine}`)
          : `${output.trimEnd()}\\n\\n${linkLine}`;
      }
      continue;
    }'''
assistant = once(assistant, old_dedupe, new_dedupe, "normalized Bible duplicate suppression")
ASSISTANT.write_text(assistant)

runtime = RUNTIME.read_text()
old_sanitizer = '''export function sanitizeAtisLinks(text: string) {
  const allowed = (url: string) => /^https:\\/\\/biblia\\.atalaias\\.online\\/v\\/[A-Za-z0-9_-]+$/i.test(url);
  let output = text.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)\\s]+)\\)/gi, (_full, label, url) => allowed(url) ? `[${label}](${url})` : String(label));
  output = output.replace(/https?:\\/\\/[^\\s<>"')\\]]+/gi, (url) => allowed(url) ? url : "");
  output = output.replace(/^\\s*📱\\s*\\*?Continue no app:?\\*?\\s*$/gim, "");
  output = output.replace(/\\n{3,}/g, "\\n\\n").trim();
  return output;
}'''
new_sanitizer = '''export function sanitizeAtisLinks(text: string) {
  const canonicalVerseLine = /^\\s*📖\\s*Leia aqui:\\s*(https:\\/\\/biblia\\.atalaias\\.online\\/v\\/[A-Za-z0-9_-]+)\\s*$/i;
  let output = text.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)\\s]+)\\)/gi, (_full, label) => String(label));
  output = output.split("\\n").map((line) => {
    const trusted = line.match(canonicalVerseLine);
    if (trusted) return `📖 Leia aqui: ${trusted[1]}`;
    return line.replace(/https?:\\/\\/[^\\s<>"')\\]]+/gi, "");
  }).join("\\n");
  output = output.replace(/^\\s*📱\\s*\\*?Continue no app:?\\*?\\s*$/gim, "");
  output = output.replace(/\\n{3,}/g, "\\n\\n").trim();
  return output;
}'''
runtime = once(runtime, old_sanitizer, new_sanitizer, "canonical verse link egress only")
RUNTIME.write_text(runtime)

link_test = LINK_TEST.read_text()
old_link_test = '''  assertEquals(sanitizeAtisLinks(`📖 Leia aqui: ${short}`), `📖 Leia aqui: ${short}`);
  assertEquals(sanitizeAtisLinks("Veja https://example.com e https://biblia.atalaias.online/biblia"), "Veja  e");'''
new_link_test = '''  assertEquals(sanitizeAtisLinks(`📖 Leia aqui: ${short}`), `📖 Leia aqui: ${short}`);
  assertEquals(sanitizeAtisLinks(`Link solto ${short}`), "Link solto");
  assertEquals(sanitizeAtisLinks("Veja https://example.com e https://biblia.atalaias.online/biblia"), "Veja  e");'''
link_test = once(link_test, old_link_test, new_link_test, "naked verse link regression")
LINK_TEST.write_text(link_test)

ROUTING_TEST.write_text('''import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";\nimport { deterministicIntent, stripGeneratedUrls } from "./assistant.ts";\n\nconst harpaHistory = [\n  { role: "assistant" as const, content: "🎵 Harpa Cristã 198 — JESUS, O BOM AMIGO" },\n];\n\nDeno.test("explicit Bible reference overrides stale Harpa context", () => {\n  assertEquals(deterministicIntent("Explique Lucas 21:20", harpaHistory), "ask_bible");\n  assertEquals(deterministicIntent("Mostre Mateus 26:1-6", harpaHistory), "bible_lookup");\n  assertEquals(deterministicIntent("Explique esse hino", harpaHistory), "harpa_study");\n});\n\nDeno.test("AI generated URLs are stripped before trusted Bible enrichment", () => {\n  assertEquals(\n    stripGeneratedUrls("Texto\\nhttps://biblia.atalaias.online/v/3Rrudc\\nhttps://example.com/x"),\n    "Texto",\n  );\n});\n''')
