from pathlib import Path

ASSISTANT = Path('supabase/functions/_shared/atis/assistant.ts')
TEST = Path('supabase/functions/_shared/atis/response-style_test.ts')

assistant = ASSISTANT.read_text()

old = '''function guardUngroundedBibleQuotes(value: string, bibleContext: string | null) {
  const source = bibleContext ? normalizedQuote(bibleContext) : "";
  const replacement = "📖 *(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app)*";
  const protect = (full: string, quoted: string) => {
    if (quoted.trim().length < 24) return full;
    if (source && source.includes(normalizedQuote(quoted))) return full;
    return replacement;
  };
  return value
    .replace(/“([^”\\n]{24,})”/g, protect)
    .replace(/"([^"\\n]{24,})"/g, protect);
}
'''
new = '''const BIBLE_GUARD_PLACEHOLDER = "📖 *(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app)*";

function guardUngroundedBibleQuotes(value: string, bibleContext: string | null) {
  const source = bibleContext ? normalizedQuote(bibleContext) : "";
  const protect = (full: string, quoted: string) => {
    if (quoted.trim().length < 24) return full;
    if (source && source.includes(normalizedQuote(quoted))) return full;
    return BIBLE_GUARD_PLACEHOLDER;
  };
  return value
    .replace(/“([^”\\n]{24,})”/g, protect)
    .replace(/"([^"\\n]{24,})"/g, protect);
}

export function needsNaturalBibleAnswerRepair(
  value: string,
  route: AtisAssistantRoute,
  conversationMode: "normal" | "study" | "concise",
) {
  if (route !== "ask_bible" || conversationMode === "study") return false;
  if (value.includes(BIBLE_GUARD_PLACEHOLDER)) return true;
  const lines = String(value ?? "").split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.some((line) => /^#{1,6}\\s+/.test(line))) return true;
  const listItems = lines.filter((line) => /^(?:[-•*]\\s+|\\d+[.)]\\s+)/.test(line)).length;
  return listItems >= 2;
}

export function stripBrokenBibleGuardLines(value: string) {
  const lines = String(value ?? "").split(/\\r?\\n/).filter((line) => {
    if (line.includes(BIBLE_GUARD_PLACEHOLDER)) return false;
    // A bare canonical-looking header emitted by the model is not useful by
    // itself. The backend owns real ARC blocks and their verified share links.
    if (/^\\s*📖\\s*\\*[^*\\n]+\\([^)]{2,12}\\)\\*\\s*$/u.test(line)) return false;
    return true;
  });
  return lines.join("\\n").replace(/\\n{3,}/g, "\\n\\n").trim();
}
'''
if assistant.count(old) != 1:
    raise SystemExit(f'guard anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)

old = '''  const text = firstString(body?.choices?.[0]?.message?.content);
  if (!text) throw new Error("AI_EMPTY_RESPONSE");
  const guarded = guardUngroundedBibleQuotes(stripGeneratedUrls(text), bibleContext?.text ?? null);
  const contextReference = bibleContext && bible ? parseBibleReference(bibleContext.label, bible) : null;
'''
new = '''  let text = firstString(body?.choices?.[0]?.message?.content);
  if (!text) throw new Error("AI_EMPTY_RESPONSE");
  let guarded = guardUngroundedBibleQuotes(stripGeneratedUrls(text), bibleContext?.text ?? null);

  // A common Bible answer must never be sent after the quote guard has cut
  // pieces out of sentences, nor as an unsolicited mini-study. If the first
  // generation violates either rule, regenerate once from the original user
  // request with a stricter conversational contract. We intentionally do not
  // feed the malformed draft back to the model.
  if (needsNaturalBibleAnswerRepair(guarded, route, conversationMode)) {
    console.warn("[atis-assistant] repairing common Bible answer presentation");
    const repairResponse = await aiChatFetchWithProviders({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `${system}\\n\\nREPARO OBRIGATÓRIO PARA ESTA RESPOSTA\\n- Responda novamente do zero à pergunta do usuário.\\n- Use apenas 1 a 3 parágrafos corridos e naturais.\\n- Não use títulos, subtítulos, listas, enumerações ou tabela.\\n- Não transcreva nenhum versículo literalmente e não use aspas para texto bíblico; cite apenas referências entre parênteses quando ajudarem.\\n- Não deixe frases dependentes de um texto bíblico que não será mostrado.\\n- Entregue uma resposta completa, fluida e terminada em ponto final.`,
        },
        ...history,
        { role: "user", content: userMessage },
      ],
      temperature: 0.45,
      reasoning_effort: "low",
      reasoning_format: "hidden",
      max_tokens: conversationMode === "concise" ? 500 : 900,
    }, ["groq", "gemini"]);

    if (repairResponse.ok) {
      const repairBody = await repairResponse.json().catch(() => null) as any;
      const repairFinish = firstString(repairBody?.choices?.[0]?.finish_reason)?.toLowerCase() ?? "";
      const repairText = firstString(repairBody?.choices?.[0]?.message?.content);
      if (repairText && repairFinish !== "length" && repairFinish !== "max_tokens") {
        text = repairText;
        guarded = guardUngroundedBibleQuotes(stripGeneratedUrls(text), bibleContext?.text ?? null);
      }
    }
  }

  // Last-resort safety: never preserve a line that the Bible quote guard had to
  // censor. This avoids outputs such as "crescia em 📖 Lucas 2:40" or orphan
  // Bible headers if a provider ignores the repair instruction too.
  guarded = stripBrokenBibleGuardLines(guarded);
  const contextReference = bibleContext && bible ? parseBibleReference(bibleContext.label, bible) : null;
'''
if assistant.count(old) != 1:
    raise SystemExit(f'generation anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)
ASSISTANT.write_text(assistant)

existing = TEST.read_text()
old_import = 'import { automaticBibleBlockLimit, cleanGeneratedBibleScaffolding } from "./assistant.ts";'
new_import = 'import { automaticBibleBlockLimit, cleanGeneratedBibleScaffolding, needsNaturalBibleAnswerRepair, stripBrokenBibleGuardLines } from "./assistant.ts";'
if old_import in existing:
    existing = existing.replace(old_import, new_import, 1)
elif 'needsNaturalBibleAnswerRepair' not in existing:
    raise SystemExit('response-style import anchor missing')

if 'ATIS repairs common answers when quote guard would mutilate prose' not in existing:
    existing += '''\n\nDeno.test("ATIS repairs common answers when quote guard would mutilate prose", () => {\n  const broken = `Jesus crescia em 📖 *(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app)* (Lucas 2:40).`;\n  assertEquals(needsNaturalBibleAnswerRepair(broken, "ask_bible", "normal"), true);\n});\n\nDeno.test("ATIS repairs unsolicited mini-study formatting in normal Bible chat", () => {\n  const structured = `### Como entender\\n- Primeiro ponto\\n- Segundo ponto`;\n  assertEquals(needsNaturalBibleAnswerRepair(structured, "ask_bible", "normal"), true);\n  assertEquals(needsNaturalBibleAnswerRepair(structured, "ask_bible", "study"), false);\n});\n\nDeno.test("ATIS strips mutilated guard lines and orphan Bible headers", () => {\n  const broken = `Jesus foi um menino obediente e cheio de sabedoria.\\n\\n- Crescia em 📖 *(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app)*.\\n\\n📖 *Lucas 2:40 (ARC)*\\n\\nA Bíblia registra poucos detalhes da infância de Jesus.`;\n  assertEquals(\n    stripBrokenBibleGuardLines(broken),\n    `Jesus foi um menino obediente e cheio de sabedoria.\\n\\nA Bíblia registra poucos detalhes da infância de Jesus.`,\n  );\n});\n\nDeno.test("ATIS accepts a natural paragraph answer without repair", () => {\n  const natural = `A Bíblia registra poucos detalhes da infância de Jesus. Lucas mostra que ele crescia em sabedoria e graça, e aos doze anos já demonstrava profunda consciência das coisas de seu Pai (Lucas 2:40-52).`;\n  assertEquals(needsNaturalBibleAnswerRepair(natural, "ask_bible", "normal"), false);\n});\n'''
TEST.write_text(existing)

assert 'repairing common Bible answer presentation' in ASSISTANT.read_text()
assert 'stripBrokenBibleGuardLines' in ASSISTANT.read_text()
