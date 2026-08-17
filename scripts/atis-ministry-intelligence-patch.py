from pathlib import Path

# ministry-intelligence: accept remembered song-list OR culto context.
p = Path("supabase/functions/_shared/atis/ministry-intelligence.ts")
text = p.read_text()
start = text.index("export function ministryRelationContextFromHistory(")
end = text.index("\nfunction selectionItems", start)
replacement = '''export function ministryRelationContextFromHistory(history: ConversationMessage[]): MinistryMarker | null {
  for (const item of [...history].reverse()) {
    if (item.role !== "user") continue;
    const songs = item.content.match(/\\[ATIS_SONG_LIST=(\\d{4}-\\d{2}-\\d{2}|-)\\|([hc]\\d+(?:,[hc]\\d+)*)(?:\\|s=([hc]\\d+))?\\]/);
    if (songs) {
      const items = songs[2].split(",").map(parseSongToken).filter(Boolean) as SongRef[];
      if (items.length) {
        const selectedCandidate = songs[3] ? parseSongToken(songs[3]) : null;
        const selected = selectedCandidate && items.some((row) => row.kind === selectedCandidate.kind && row.number === selectedCandidate.number)
          ? selectedCandidate
          : null;
        return { date: songs[1] === "-" ? null : songs[1], items, selected };
      }
    }
    const culto = item.content.match(/\\[ATIS_CULTO_DATE=(\\d{4}-\\d{2}-\\d{2})\\]/);
    if (culto) return { date: culto[1], items: [], selected: null };
  }
  return null;
}
'''
p.write_text(text[:start] + replacement + text[end:])

# ministry-context: route grounded relation questions using existing memory markers.
p = Path("supabase/functions/_shared/atis/ministry-context.ts")
text = p.read_text()
import_anchor = 'import type { AtisConversationMessage, AtisAssistantRoute } from "./assistant.ts";\n'
relation_import = 'import { isMinistryRelationIntent } from "./ministry-intelligence.ts";\n'
if relation_import not in text:
    if import_anchor not in text:
        raise SystemExit("ministry-context import anchor missing")
    text = text.replace(import_anchor, import_anchor + relation_import, 1)

old = '    if (!cultoSongsFollowup(q) && !cultoDetailFollowup(q)) return null;'
new = '    if (!cultoSongsFollowup(q) && !cultoDetailFollowup(q) && !isMinistryRelationIntent(q)) return null;'
if old not in text:
    raise SystemExit("culto context condition missing")
text = text.replace(old, new, 1)

old = '  if ((!position || position > parsed.items.length) && !(parsed.selected && selectedSongFollowup(q))) return null;'
new = '  if (!isMinistryRelationIntent(q) && ((!position || position > parsed.items.length) && !(parsed.selected && selectedSongFollowup(q)))) return null;'
if old not in text:
    raise SystemExit("song context condition missing")
text = text.replace(old, new, 1)

resolve_start = text.index("export function resolveMinistryFollowup")
culto_start = text.index('  if (marker.kind === "culto") {', resolve_start)
culto_insert = culto_start + len('  if (marker.kind === "culto") {')
relation_for_culto = '''
    if (isMinistryRelationIntent(q)) {
      return {
        route: "ministry_relation",
        message,
        carryReference: encodeCultoReference(marker.date),
      };
    }'''
text = text[:culto_insert] + relation_for_culto + text[culto_insert:]

# Insert relation handling for song-list context immediately after the culto block.
# Locate the first ordinal declaration after resolveMinistryFollowup; that point is
# after the marker.kind === culto early-return block.
position_anchor = "  const position = ordinalPosition(message);\n"
pos = text.index(position_anchor, resolve_start)
relation_for_songs = '''  if (isMinistryRelationIntent(q)) {
    return {
      route: "ministry_relation",
      message,
      carryReference: encodeSongsReference(marker.date, marker.items, marker.selected ?? null),
    };
  }

'''
text = text[:pos] + relation_for_songs + text[pos:]
p.write_text(text)

# assistant: register, gate, and execute ministry_relation.
p = Path("supabase/functions/_shared/atis/assistant.ts")
text = p.read_text()
import_anchor = 'import { captureCultoReference, captureSongListReference, resolveMinistryFollowup } from "./ministry-context.ts";\n'
intelligence_import = 'import { generateMinistryRelationAnswer, isMinistryRelationIntent, loadMinistryRelationGrounding } from "./ministry-intelligence.ts";\n'
if intelligence_import not in text:
    if import_anchor not in text:
        raise SystemExit("assistant import anchor missing")
    text = text.replace(import_anchor, import_anchor + intelligence_import, 1)

route_anchor = '  | "canticos_info";'
if route_anchor not in text:
    raise SystemExit("assistant route union anchor missing")
text = text.replace(route_anchor, '  | "canticos_info"\n  | "ministry_relation";', 1)

old = 'const AI_ROUTES = new Set<AtisAssistantRoute>(["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional"]);'
new = 'const AI_ROUTES = new Set<AtisAssistantRoute>(["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional", "ministry_relation"]);'
if old not in text:
    raise SystemExit("assistant AI route set anchor missing")
text = text.replace(old, new, 1)

intent_anchor = '  if (isCanticosIntent(message)) return "canticos_info";'
if intent_anchor not in text:
    raise SystemExit("assistant deterministic intent anchor missing")
text = text.replace(intent_anchor, '  if (isMinistryRelationIntent(message)) return "ministry_relation";\n' + intent_anchor, 1)

classifier_old = '"harpa_lookup", "culto_info", "canticos_info"]'
if classifier_old not in text:
    raise SystemExit("assistant classifier list anchor missing")
text = text.replace(classifier_old, '"harpa_lookup", "culto_info", "canticos_info", "ministry_relation"]', 1)

# Insert relation execution between Harpa handling and generic Bible/AI flow.
run_start = text.index("export async function runAtisAssistant")
harpa_start = text.index('  if (route === "harpa_lookup") {', run_start)
after_harpa = text.index("\n  }", harpa_start) + len("\n  }")
relation_exec = '''
  if (route === "ministry_relation") {
    const grounding = await loadMinistryRelationGrounding(supabase, config.baseUrl, history);
    if (!grounding) {
      return {
        text: "🎶 Para relacionar culto, Bíblia e louvor, preciso de um culto lembrado com uma seleção de louvor ativa no app. Consulte primeiro o culto ou os cânticos desse culto.",
        route,
        source: "database",
        reference: ministryFollowup?.carryReference ?? null,
      };
    }
    let ministryBibleContext: { label: string; text: string } | null = null;
    if (grounding.culto.scriptureReference) {
      try {
        const ministryBible = await loadBible(config);
        const ministryBibleReference = parseBibleReference(grounding.culto.scriptureReference, ministryBible);
        if (ministryBibleReference) ministryBibleContext = bibleText(ministryBibleReference, false);
      } catch (error) {
        console.error("[atis-assistant] ministry Bible grounding failed", error instanceof Error ? error.message : error);
      }
    }
    const generated = await generateMinistryRelationAnswer(
      config.systemPrompt,
      input,
      grounding,
      ministryBibleContext,
      options.conversationMode ?? "normal",
    );
    return {
      text: clampText(guardUngroundedBibleQuotes(generated, ministryBibleContext?.text ?? null)),
      route,
      source: "ai",
      reference: ministryFollowup?.carryReference ?? grounding.reference,
    };
  }'''
text = text[:after_harpa] + relation_exec + text[after_harpa:]
p.write_text(text)

# webhook: make the new AI route follow existing per-destination policy.
p = Path("supabase/functions/atis-webhook/index.ts")
text = p.read_text()
old = 'const AI_FEATURE_KEYS = ["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional"];'
new = 'const AI_FEATURE_KEYS = ["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional", "ministry_relation"];'
if old not in text:
    raise SystemExit("webhook AI feature anchor missing")
p.write_text(text.replace(old, new, 1))
