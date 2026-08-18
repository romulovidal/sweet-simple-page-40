from pathlib import Path

ASSISTANT = Path("supabase/functions/_shared/atis/assistant.ts")
RUNTIME = Path("supabase/functions/_shared/atis/conversation-runtime.ts")
WEBHOOK = Path("supabase/functions/atis-webhook/index.ts")
PROFILE = Path("src/components/admin/atis/AtisConversationProfile.tsx")
TEST = Path("supabase/functions/_shared/atis/link-policy_test.ts")


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, got {count}")
    return text.replace(old, new, 1)


assistant = ASSISTANT.read_text()
assistant = once(
    assistant,
    'let bibleCache: { url: string; data: BibleBook[] } | null = null;\nlet harpaCache: { url: string; data: any } | null = null;',
    'const VERSE_SHARE_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";\nlet bibleCache: { url: string; data: BibleBook[] } | null = null;\nlet harpaCache: { url: string; data: any } | null = null;',
    "share alphabet",
)

anchor = '''function bibleText(reference: BibleReference, wholeChapter = false) {\n  const verses = reference.book.chapters[reference.chapter - 1] ?? [];\n  const start = wholeChapter || !reference.verseStart ? 1 : reference.verseStart;\n  const end = wholeChapter || !reference.verseStart ? verses.length : Math.min(reference.verseEnd ?? reference.verseStart, verses.length);\n  const lines = [];\n  for (let verse = start; verse <= end; verse++) lines.push(`${verse}. ${verses[verse - 1]}`);\n  const label = reference.verseStart\n    ? `${reference.bookName} ${reference.chapter}:${reference.verseStart}${end !== reference.verseStart ? `-${end}` : ""}`\n    : `${reference.bookName} ${reference.chapter}`;\n  return { label, text: lines.join("\\n") };\n}\n'''
helpers = anchor + r'''

function verseNumbers(reference: BibleReference) {
  if (!reference.verseStart) return [] as number[];
  const verses = reference.book.chapters[reference.chapter - 1] ?? [];
  const end = Math.min(reference.verseEnd ?? reference.verseStart, verses.length);
  const numbers: number[] = [];
  for (let verse = reference.verseStart; verse <= end; verse++) numbers.push(verse);
  return numbers;
}

function verseShareText(reference: BibleReference) {
  const verses = reference.book.chapters[reference.chapter - 1] ?? [];
  if (!reference.verseStart) return null;
  const end = Math.min(reference.verseEnd ?? reference.verseStart, verses.length);
  const lines: string[] = [];
  for (let verse = reference.verseStart; verse <= end; verse++) lines.push(`${verse} ${verses[verse - 1]}`);
  const label = `${reference.bookName} ${reference.chapter}:${reference.verseStart}${end !== reference.verseStart ? `-${end}` : ""}`;
  return { label, text: lines.join(" ") };
}

function randomVerseShareSlug(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let slug = "";
  for (let index = 0; index < length; index++) slug += VERSE_SHARE_ALPHABET[bytes[index] % VERSE_SHARE_ALPHABET.length];
  return slug;
}

async function createShortVerseLink(supabase: any, config: any, reference: BibleReference, textSnippet: string) {
  const verses = verseNumbers(reference);
  if (!verses.length || verses.length > 50) return null;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("verse_shares")
    .select("slug")
    .eq("book_abbrev", reference.book.abbrev)
    .eq("chapter", reference.chapter)
    .eq("verses", verses)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (firstString(existing?.slug)) return `${config.baseUrl}/v/${existing.slug}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = randomVerseShareSlug();
    const { error } = await supabase.from("verse_shares").insert({
      slug,
      book_abbrev: reference.book.abbrev,
      chapter: reference.chapter,
      verses,
      text_snippet: textSnippet.slice(0, 600),
      book_name: reference.bookName,
      version: config.bibleVersion,
    });
    if (!error) return `${config.baseUrl}/v/${slug}`;
    if (!String(error.message ?? "").toLowerCase().includes("duplicate key")) throw error;
  }
  return null;
}

async function trustedBibleBlock(supabase: any, config: any, reference: BibleReference) {
  const share = verseShareText(reference);
  if (!share) return null;
  let link: string | null = null;
  try {
    link = await createShortVerseLink(supabase, config, reference, share.text);
  } catch (error) {
    console.error("[atis-assistant] verse share link failed", error instanceof Error ? error.message : error);
  }
  return `📖 *${share.label} (${config.bibleVersion})*\n\n"${share.text}"${link ? `\n\n📖 Leia aqui: ${link}` : ""}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function referenceKey(reference: BibleReference) {
  return `${normalize(reference.book.abbrev)}:${reference.chapter}:${reference.verseStart ?? 0}:${reference.verseEnd ?? reference.verseStart ?? 0}`;
}

function referenceCovers(parent: BibleReference, child: BibleReference) {
  if (normalize(parent.book.abbrev) !== normalize(child.book.abbrev) || parent.chapter !== child.chapter || !parent.verseStart || !child.verseStart) return false;
  const parentEnd = parent.verseEnd ?? parent.verseStart;
  const childEnd = child.verseEnd ?? child.verseStart;
  return child.verseStart >= parent.verseStart && childEnd <= parentEnd;
}

function extractBibleReferences(value: string, bible: BibleBook[]) {
  const bookPattern = [...CANONICAL_BOOKS].sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
  const matcher = new RegExp(`(?:${bookPattern})\\s+\\d{1,3}\\s*:\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?`, "giu");
  const found: BibleReference[] = [];
  for (const match of value.matchAll(matcher)) {
    const reference = parseBibleReference(match[0], bible);
    if (reference?.verseStart) found.push(reference);
  }
  return found;
}

export function cleanBibleGuardPlaceholders(value: string, bible: BibleBook[], contextReference: BibleReference | null = null) {
  const markerSource = String.raw`📖\s*\*\(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app\)\*`;
  let output = value;
  if (contextReference?.verseStart) {
    output = output.replace(new RegExp(`${markerSource}\\s*\\(v\\.?\\s*(\\d{1,3})\\)`, "giu"), (_full, rawVerse) => {
      const verse = Number(rawVerse);
      const chapterVerses = contextReference.book.chapters[contextReference.chapter - 1] ?? [];
      if (verse < 1 || verse > chapterVerses.length) return `📖 *${bibleText(contextReference, false).label}*`;
      return `📖 *${contextReference.bookName} ${contextReference.chapter}:${verse}*`;
    });
  }
  output = output.replace(new RegExp(`${markerSource}\\s*\\(([^)]+)\\)`, "giu"), (_full, candidate) => {
    const reference = parseBibleReference(String(candidate), bible);
    return reference?.verseStart ? `📖 *${bibleText(reference, false).label}*` : String(candidate);
  });
  output = output.replace(new RegExp(markerSource, "giu"), contextReference?.verseStart ? `📖 *${bibleText(contextReference, false).label}*` : "");
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

async function enrichBibleReferences(
  value: string,
  supabase: any,
  config: any,
  bible: BibleBook[] | null,
  contextReference: BibleReference | null = null,
) {
  if (!bible?.length) return value.trim();
  let output = cleanBibleGuardPlaceholders(value, bible, contextReference);
  const candidates = extractBibleReferences(output, bible);
  if (contextReference?.verseStart) candidates.unshift(contextReference);

  const references: BibleReference[] = [];
  const seen = new Set<string>();
  for (const reference of candidates) {
    if (!reference.verseStart) continue;
    if (contextReference?.verseStart && reference !== contextReference && referenceCovers(contextReference, reference)) continue;
    const key = referenceKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    references.push(reference);
  }

  for (const reference of references.slice(0, 6)) {
    const canonical = bibleText(reference, false);
    const block = await trustedBibleBlock(supabase, config, reference);
    if (!block) continue;
    const linkMatch = block.match(/https:\/\/biblia\.atalaias\.online\/v\/[A-Za-z0-9_-]+/i);
    const linkLine = linkMatch ? `📖 Leia aqui: ${linkMatch[0]}` : null;
    if (output.includes(canonical.text)) {
      if (linkLine && !output.includes(linkMatch![0])) output = output.replace(canonical.text, `${canonical.text}\n\n${linkLine}`);
      continue;
    }
    output = `${output.trimEnd()}\n\n${block}`;
  }
  return output.trim();
}
'''
assistant = once(assistant, anchor, helpers, "Bible helpers")

assistant = once(
    assistant,
    'async function dailyVerseLookup(supabase: any) {\n  const daily = await currentDailyVerse(supabase);\n  if (!daily) return "📖 O versículo do dia ainda não está disponível no app.";\n  return `📖 *${daily.reference}*\\n“${daily.text}”`;\n}',
    '''async function dailyVerseLookup(supabase: any, config: any) {\n  const daily = await currentDailyVerse(supabase);\n  if (!daily) return "📖 O versículo do dia ainda não está disponível no app.";\n  try {\n    const bible = await loadBible(config);\n    const reference = parseBibleReference(daily.reference, bible);\n    if (reference?.verseStart) {\n      const block = await trustedBibleBlock(supabase, config, reference);\n      if (block) return block;\n    }\n  } catch (error) {\n    console.error("[atis-assistant] daily verse share formatting failed", error instanceof Error ? error.message : error);\n  }\n  return `📖 *${daily.reference} (${config.bibleVersion})*\\n\\n"${daily.text}"`;\n}''',
    "daily verse share",
)

assistant = once(
    assistant,
    'async function generateSpecialistAnswer(\n  route: AtisAssistantRoute,\n  config: any,',
    'async function generateSpecialistAnswer(\n  supabase: any,\n  route: AtisAssistantRoute,\n  config: any,',
    "specialist supabase param",
)
assistant = once(
    assistant,
    '  bibleContext: { label: string; text: string } | null,\n  history: AtisConversationMessage[] = [],',
    '  bibleContext: { label: string; text: string } | null,\n  bible: BibleBook[] | null,\n  history: AtisConversationMessage[] = [],',
    "specialist Bible asset param",
)
assistant = once(
    assistant,
    '- Fora do CONTEXTO BÍBLICO RECUPERADO DO APP, cite apenas a referência bíblica, nunca o texto literal.\\n- Seja conciso para WhatsApp, salvo quando o usuário pedir estudo aprofundado.',
    '- Fora do CONTEXTO BÍBLICO RECUPERADO DO APP, cite apenas a referência bíblica, nunca o texto literal.\\n- Não inclua links ou URLs. O backend acrescenta exclusivamente links curtos de versículos verificados no formato /v/.\\n- Na parte explicativa, prefira citar a referência sem transcrever o versículo; o backend acrescentará o texto bíblico real recuperado do app.\\n- Seja conciso para WhatsApp, salvo quando o usuário pedir estudo aprofundado.',
    "AI link/output policy",
)
assistant = once(
    assistant,
    '  const guarded = guardUngroundedBibleQuotes(text, bibleContext?.text ?? null);\n  if (route === "devotional" && bibleContext) {',
    '  const guarded = guardUngroundedBibleQuotes(text, bibleContext?.text ?? null);\n  const contextReference = bibleContext && bible ? parseBibleReference(bibleContext.label, bible) : null;\n  if (route === "devotional" && bibleContext) {',
    "context reference",
)
assistant = once(
    assistant,
    '    return clampText(devotional);\n  }\n  return clampText(guarded);',
    '    return clampText(await enrichBibleReferences(devotional, supabase, config, bible, contextReference));\n  }\n  return clampText(await enrichBibleReferences(guarded, supabase, config, bible, contextReference));',
    "specialist enrichment",
)
assistant = once(
    assistant,
    '    return { text: await dailyVerseLookup(supabase), route, source: "database" };',
    '    return { text: await dailyVerseLookup(supabase, config), route, source: "database" };',
    "daily verse call",
)
assistant = once(
    assistant,
    '''    return {\n      text: clampText(result.answer),\n      route,\n      source: "ai",\n      reference: ministryFollowup?.carryReference ?? firstString(result.reference),\n    };''',
    '''    let answerText = clampText(result.answer);\n    try {\n      const harpaBible = await loadBible(config);\n      answerText = clampText(await enrichBibleReferences(answerText, supabase, config, harpaBible, null));\n    } catch (error) {\n      console.error("[atis-assistant] Harpa study Bible link enrichment failed", error instanceof Error ? error.message : error);\n    }\n    return {\n      text: answerText,\n      route,\n      source: "ai",\n      reference: ministryFollowup?.carryReference ?? firstString(result.reference),\n    };''',
    "Harpa study enrichment",
)
assistant = once(
    assistant,
    '    let ministryBibleContext: { label: string; text: string } | null = null;\n    if (grounding.culto.scriptureReference) {\n      try {\n        const ministryBible = await loadBible(config);',
    '    let ministryBibleContext: { label: string; text: string } | null = null;\n    let ministryBible: BibleBook[] | null = null;\n    if (grounding.culto.scriptureReference) {\n      try {\n        ministryBible = await loadBible(config);',
    "ministry Bible variable",
)
assistant = once(
    assistant,
    '        if (ministryBibleReference) ministryBibleContext = bibleText(ministryBibleReference, false);',
    '        if (ministryBibleReference) ministryBibleContext = bibleText(ministryBibleReference, false);',
    "ministry reference unchanged",
)
assistant = once(
    assistant,
    '''    return {\n      text: clampText(guardUngroundedBibleQuotes(generated, ministryBibleContext?.text ?? null)),\n      route,\n      source: "ai",\n      reference: ministryFollowup?.carryReference ?? grounding.reference,\n    };''',
    '''    const ministryReference = ministryBibleContext && ministryBible ? parseBibleReference(ministryBibleContext.label, ministryBible) : null;\n    const ministryText = await enrichBibleReferences(\n      guardUngroundedBibleQuotes(generated, ministryBibleContext?.text ?? null),\n      supabase,\n      config,\n      ministryBible,\n      ministryReference,\n    );\n    return {\n      text: clampText(ministryText),\n      route,\n      source: "ai",\n      reference: ministryFollowup?.carryReference ?? grounding.reference,\n    };''',
    "ministry enrichment",
)
assistant = once(
    assistant,
    '    const content = bibleText(reference, !reference.verseStart);\n    return { text: clampText(`📖 *${content.label} — ${config.bibleVersion}*\\n${content.text}`), route, source: "app", reference: content.label };',
    '''    const content = bibleText(reference, !reference.verseStart);\n    if (reference.verseStart) {\n      const block = await trustedBibleBlock(supabase, config, reference);\n      if (block) return { text: clampText(block), route, source: "app", reference: content.label };\n    }\n    return { text: clampText(`📖 *${content.label} (${config.bibleVersion})*\\n\\n${content.text}`), route, source: "app", reference: content.label };''',
    "Bible lookup share",
)
assistant = once(
    assistant,
    '  const text = await generateSpecialistAnswer(route, config, prompts, input, context, history, options.conversationMode ?? "normal", firstString(options.destinationInstruction));',
    '  const text = await generateSpecialistAnswer(supabase, route, config, prompts, input, context, bible, history, options.conversationMode ?? "normal", firstString(options.destinationInstruction));',
    "specialist call",
)
ASSISTANT.write_text(assistant)

runtime = RUNTIME.read_text()
runtime = once(runtime, '    continue_in_app: true,', '    continue_in_app: false,', "default continue disabled")
old_append = '''export function appendContinueInApp(text: string, route: string, enabled: boolean, reference?: string | null) {\n  if (!enabled || /https?:\\/\\/biblia\\.atalaias\\.online/i.test(text)) return text;\n  const link = continueInAppLink(route, reference);\n  return `${text.trim()}\\n\\n📱 *Continue no app:*\\n${link}`;\n}'''
new_append = r'''export function sanitizeAtisLinks(text: string) {
  const allowed = (url: string) => /^https:\/\/biblia\.atalaias\.online\/v\/[A-Za-z0-9_-]+$/i.test(url);
  let output = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_full, label, url) => allowed(url) ? `[${label}](${url})` : String(label));
  output = output.replace(/https?:\/\/[^\s<>"')\]]+/gi, (url) => allowed(url) ? url : "");
  output = output.replace(/^\s*📱\s*\*?Continue no app:?\*?\s*$/gim, "");
  output = output.replace(/\n{3,}/g, "\n\n").trim();
  return output;
}

export function appendContinueInApp(text: string, _route: string, _enabled: boolean, _reference?: string | null) {
  return sanitizeAtisLinks(text);
}'''
runtime = once(runtime, old_append, new_append, "append link sanitizer")
runtime = once(
    runtime,
    '''    return [\n      { id: "atis:mode:study", text: "📚 Modo Estudo" },\n      { id: "atis:devotional", text: "🌿 Devocional" },\n      { id: "atis:app", text: "📱 Abrir app" },\n    ];''',
    '''    return [\n      { id: "atis:mode:study", text: "📚 Modo Estudo" },\n      { id: "atis:devotional", text: "🌿 Devocional" },\n    ];''',
    "Bible buttons",
)
runtime = once(
    runtime,
    '''    return [\n      { id: "atis:app", text: "📱 Abrir app" },\n      { id: "atis:mode:study", text: "📚 Modo Estudo" },\n    ];''',
    '''    return [\n      { id: "atis:mode:study", text: "📚 Modo Estudo" },\n    ];''',
    "Harpa buttons",
)
runtime = once(
    runtime,
    '''  return [\n    { id: "atis:mode:study", text: "📚 Modo Estudo" },\n    { id: "atis:app", text: "📱 Abrir app" },\n  ];''',
    '''  return [\n    { id: "atis:mode:study", text: "📚 Modo Estudo" },\n  ];''',
    "default buttons",
)
RUNTIME.write_text(runtime)

webhook = WEBHOOK.read_text()
webhook = once(
    webhook,
    '        specialReply = "📱 Continue na *Bíblia do Atalaia*:\\nhttps://biblia.atalaias.online";',
    '        specialReply = "📱 Os links gerais do app foram desativados no ATIS. Abra a *Bíblia do Atalaia* diretamente no seu dispositivo. Links enviados pelo ATIS ficam reservados aos textos bíblicos compartilháveis.";',
    "old open app button",
)
WEBHOOK.write_text(webhook)

profile = PROFILE.read_text()
profile = once(
    profile,
    'Perfil independente para esta pessoa ou grupo: profundidade, silêncio, antispam, botões, áudio e continuidade no app.',
    'Perfil independente para esta pessoa ou grupo: profundidade, silêncio, antispam, botões e áudio.',
    "profile description",
)
continue_row = '<div className="p-3"><Row icon={<ShieldCheck className="w-4 h-4" />} title="Link “Continue no app”" subtitle="Acrescenta um caminho contextual para a Bíblia do Atalaia"><Toggle checked={profile.continue_in_app} onChange={(value) => patch({ continue_in_app: value })} /></Row></div>'
profile = once(profile, continue_row, '', "remove continue toggle")
PROFILE.write_text(profile)

TEST.write_text(r'''import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { appendContinueInApp, assistantButtons, sanitizeAtisLinks } from "./conversation-runtime.ts";

Deno.test("ATIS removes ordinary app URLs", () => {
  assertEquals(
    appendContinueInApp("Resposta\n\n📱 *Continue no app:*\nhttps://biblia.atalaias.online/harpa", "harpa_lookup", true, "Harpa 15"),
    "Resposta",
  );
});

Deno.test("ATIS preserves only short verse share URLs", () => {
  const short = "https://biblia.atalaias.online/v/KXaUGU";
  assertEquals(sanitizeAtisLinks(`📖 Leia aqui: ${short}`), `📖 Leia aqui: ${short}`);
  assertEquals(sanitizeAtisLinks("Veja https://example.com e https://biblia.atalaias.online/biblia"), "Veja  e");
});

Deno.test("quick actions no longer offer generic app links", () => {
  assertEquals(assistantButtons("bible_lookup").map((button) => button.id), ["atis:mode:study", "atis:devotional"]);
  assertEquals(assistantButtons("harpa_study").map((button) => button.id), ["atis:mode:study"]);
});
''')

print("ATIS v35 Bible grounding and link policy patch applied")
