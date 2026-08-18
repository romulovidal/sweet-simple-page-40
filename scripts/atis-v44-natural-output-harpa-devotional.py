from pathlib import Path

ASSISTANT = Path('supabase/functions/_shared/atis/assistant.ts')
ROUTING_TEST = Path('supabase/functions/_shared/atis/context-routing_test.ts')
STYLE_TEST = Path('supabase/functions/_shared/atis/response-style_test.ts')
HARPA = Path('supabase/functions/atis-harpa-study/index.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'anchor not found: {label}')
    return text.replace(old, new, 1)


assistant = ASSISTANT.read_text()

# 1) Deterministic final presentation for ordinary Bible chat + devotional echo guard.
marker = 'async function fetchJsonCached(url: string, kind: "bible" | "harpa") {'
helpers = r'''export function normalizeCommonBibleAnswer(
  value: string,
  route: AtisAssistantRoute,
  conversationMode: "normal" | "study" | "concise",
) {
  const cleaned = stripBrokenBibleGuardLines(value);
  if (route !== "ask_bible" || conversationMode === "study") return cleaned;

  const paragraphs: string[] = [];
  let listBuffer: string[] = [];
  const flushList = () => {
    if (!listBuffer.length) return;
    paragraphs.push(listBuffer.join(" ").replace(/\s+/g, " ").trim());
    listBuffer = [];
  };

  for (const rawLine of cleaned.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) continue;

    const listMatch = line.match(/^(?:[-•*]\s+|\d+[.)]\s+)(.+)$/);
    if (listMatch) {
      line = listMatch[1].trim()
        .replace(/^\*\*([^*]+)\*\*\s*[–—-]\s*/u, "$1: ")
        .replace(/\*\*/g, "")
        .trim();
      if (line && !/[.!?]$/u.test(line)) line += ".";
      if (line) listBuffer.push(line);
      continue;
    }

    flushList();
    paragraphs.push(line);
  }
  flushList();

  return paragraphs
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function stripDevotionalBibleEcho(
  value: string,
  bibleContext: { label: string; text: string },
) {
  const normalizedReference = normalizedQuote(bibleContext.label);
  const normalizedBible = normalizedQuote(bibleContext.text);
  const fingerprint = normalizedBible.slice(0, Math.min(80, normalizedBible.length));

  return String(value ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => {
      if (!paragraph || paragraph.includes(BIBLE_GUARD_PLACEHOLDER)) return false;
      const normalized = normalizedQuote(paragraph);
      if (fingerprint.length >= 24 && normalized.includes(fingerprint)) return false;
      if (normalized === normalizedReference) return false;
      if (/^📖\s*/u.test(paragraph) && normalized.includes(normalizedReference)) return false;
      if (/^\*{0,2}[^\n]{1,80}\d{1,3}:\d{1,3}/u.test(paragraph) && normalized.includes(normalizedReference)) return false;
      return true;
    })
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchJsonCached(url: string, kind: "bible" | "harpa") {'''
assistant = replace_once(assistant, marker, helpers, 'assistant helpers insertion')

# 2) Harpa analytical follow-ups must route to study instead of repeating lyrics.
old_harpa_intent = 'const studyCue = /\\b(tema|explique|explicacao|significado|mensagem|estudo|teolog|aplicacao|relacione|relacao|conex|passagens|biblic)\\b/.test(q);'
new_harpa_intent = 'const studyCue = /\\b(?:tema|explique|explicacao|significado|mensagem|estudo|teolog\\w*|aplicacao|relacione|relacao|conex\\w*|passagens?|referencias?|versiculos?|biblic\\w*|doutrin\\w*|tipo|categoria|classifica\\w*|genero|estilo)\\b/.test(q);'
assistant = replace_once(assistant, old_harpa_intent, new_harpa_intent, 'Harpa study intent cues')

# 3) Devotional: the AI writes only reflection/prayer; the backend owns the verse block once.
old_rule = '  const devotionalRule = route === "devotional"\n    ? "\\n- REFLEXÃO DEVOCIONAL DO ATIS: o único texto-base permitido é o versículo diário atual recuperado da Bíblia do Atalaia e fornecido em CONTEXTO BÍBLICO RECUPERADO DO APP. Exiba a referência e o texto completo recebido UMA ÚNICA VEZ no início, sem alterá-lo, e construa a reflexão somente a partir dele. Depois escreva exatamente 2 parágrafos de reflexão. Finalize com **Oração:** e uma oração ORIGINAL dirigida a Deus, de 2 a 4 frases curtas, baseada no ensinamento da passagem. A oração NÃO pode repetir a referência, NÃO pode copiar/transcrever o texto bíblico e NÃO pode usar o próprio versículo como oração. Termine a oração com Amém. Não escolha outro versículo, não troque o tema e não omita o texto bíblico. Esta experiência deve refletir o botão Reflexão Devocional do app."\n    : "";\n  const userMessage = route === "devotional" && bibleContext\n    ? `**${bibleContext.label}**\\n\\n"${bibleContext.text}"`\n    : message;'
new_rule = '  const devotionalRule = route === "devotional"\n    ? "\\n- REFLEXÃO DEVOCIONAL DO ATIS: use exclusivamente a passagem fornecida em CONTEXTO BÍBLICO RECUPERADO DO APP como base, mas NÃO reproduza a referência nem o texto bíblico na sua saída; o backend exibirá esse bloco uma única vez. Escreva exatamente 2 parágrafos naturais de reflexão e finalize com **Oração:** seguida de uma oração ORIGINAL dirigida a Deus, de 2 a 4 frases curtas. A oração não pode citar a referência, copiar o versículo nem transformar o versículo em oração. Termine com Amém."\n    : "";\n  const userMessage = route === "devotional" && bibleContext\n    ? "Escreva somente a reflexão e a oração baseadas na passagem fornecida no contexto. Não repita a referência nem o texto bíblico."\n    : message;'
assistant = replace_once(assistant, old_rule, new_rule, 'devotional generation contract')

old_guard = '  let guarded = guardUngroundedBibleQuotes(stripGeneratedUrls(text), bibleContext?.text ?? null);'
new_guard = '  let guarded = guardUngroundedBibleQuotes(stripGeneratedUrls(text), route === "devotional" ? null : (bibleContext?.text ?? null));'
assistant = replace_once(assistant, old_guard, new_guard, 'devotional quote guard context')

# Apply deterministic normalization after the optional AI repair too.
old_final_guard = '  guarded = stripBrokenBibleGuardLines(guarded);\n  const contextReference = bibleContext && bible ? parseBibleReference(bibleContext.label, bible) : null;'
new_final_guard = '  guarded = normalizeCommonBibleAnswer(guarded, route, conversationMode);\n  const contextReference = bibleContext && bible ? parseBibleReference(bibleContext.label, bible) : null;'
assistant = replace_once(assistant, old_final_guard, new_final_guard, 'final common Bible normalization')

# Replace the entire devotional post-processing block with single-owner verse rendering.
start = assistant.index('  if (route === "devotional" && bibleContext) {')
end = assistant.index('  return clampText(await enrichBibleReferences(guarded, supabase, config, bible, contextReference, automaticBibleBlocks));', start)
new_devotional = r'''  if (route === "devotional" && bibleContext) {
    const prayerHeading = /(?:^|\n)\s*(?:\*\*)?Ora[cç][aã]o(?:\*\*)?\s*:\s*/i;
    let devotional = stripDevotionalBibleEcho(guarded, bibleContext);

    const prayerMatch = /(?:^|\n)\s*(?:\*\*)?Ora[cç][aã]o(?:\*\*)?\s*:\s*([\s\S]*)$/i.exec(devotional);
    const prayerBody = firstString(prayerMatch?.[1]) ?? "";
    const normalizedPrayer = normalizedQuote(prayerBody);
    const normalizedBible = normalizedQuote(bibleContext.text);
    const normalizedReference = normalizedQuote(bibleContext.label);
    const fingerprint = normalizedBible.slice(0, Math.min(120, normalizedBible.length));
    const prayerRepeatsBible = Boolean(fingerprint.length >= 32 && normalizedPrayer.includes(fingerprint));
    const prayerRepeatsReference = Boolean(normalizedReference.length >= 4 && normalizedPrayer.includes(normalizedReference));
    const malformedPrayer = !prayerBody
      || prayerBody.length < 24
      || prayerRepeatsBible
      || prayerRepeatsReference
      || prayerBody.includes("📖");

    if (malformedPrayer) {
      const repairResponse = await aiChatFetchWithProviders({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Escreva SOMENTE uma oração cristã curta em português brasileiro, dirigida diretamente a Deus. Use 2 a 4 frases naturais. Baseie a oração no ensinamento da passagem fornecida, mas NÃO cite a referência, NÃO copie nem transcreva nenhum trecho bíblico, NÃO use aspas e NÃO escreva comentários antes ou depois. Comece com Senhor ou Pai e termine com Amém.",
          },
          {
            role: "user",
            content: `Passagem-base: ${bibleContext.label}\nTexto bíblico do app: ${bibleContext.text}\n\nEscreva somente a oração baseada no significado dessa passagem.`,
          },
        ],
        temperature: 0.45,
        max_tokens: 260,
      }, ["groq", "gemini"]);

      let repairedPrayer = "";
      if (repairResponse.ok) {
        const repairBody = await repairResponse.json().catch(() => null) as any;
        repairedPrayer = firstString(repairBody?.choices?.[0]?.message?.content) ?? "";
        repairedPrayer = repairedPrayer
          .replace(/^\s*(?:\*\*)?Ora[cç][aã]o(?:\*\*)?\s*:\s*/i, "")
          .trim();
      }

      const repairedNormalized = normalizedQuote(repairedPrayer);
      const repairedStillRepeatsBible = Boolean(fingerprint.length >= 32 && repairedNormalized.includes(fingerprint));
      const repairedStillRepeatsReference = Boolean(normalizedReference.length >= 4 && repairedNormalized.includes(normalizedReference));
      if (!repairedPrayer || repairedStillRepeatsBible || repairedStillRepeatsReference || repairedPrayer.includes("📖")) {
        repairedPrayer = "Senhor, ajuda-nos a receber a Tua Palavra com humildade e a viver o que ela nos ensina. Dá-nos sabedoria, fé e um coração disposto a seguir a Tua vontade em cada escolha. Amém. 🙏";
      } else if (!/am[eé]m[.!]?\s*(?:🙏)?\s*$/i.test(repairedPrayer)) {
        repairedPrayer = `${repairedPrayer.replace(/\s+$/g, "")} Amém. 🙏`;
      }

      const prayerReplacement = `\n\n**Oração:** ${repairedPrayer}`;
      if (prayerMatch?.index !== undefined) {
        devotional = `${devotional.slice(0, prayerMatch.index)}${prayerReplacement}`;
      } else {
        devotional = `${devotional.trimEnd()}${prayerReplacement}`;
      }
    }

    devotional = stripDevotionalBibleEcho(devotional, bibleContext);
    let trustedDailyVerse = `📖 *${bibleContext.label} (${config.bibleVersion})*\n\n“${bibleContext.text}”`;
    if (contextReference) {
      try {
        trustedDailyVerse = await trustedBibleBlock(supabase, config, contextReference) ?? trustedDailyVerse;
      } catch (error) {
        console.error("[atis-assistant] devotional trusted verse block failed", error instanceof Error ? error.message : error);
      }
    }

    return clampText(`${trustedDailyVerse}\n\n${devotional}`);
  }
'''
assistant = assistant[:start] + new_devotional + assistant[end:]

# Harpa study answer enrichment must not auto-dump passages unless explicitly requested/study mode.
old_harpa_enrich = '      answerText = clampText(await enrichBibleReferences(answerText, supabase, config, harpaBible, null));'
new_harpa_enrich = '      const harpaAutomaticBlocks = (options.conversationMode ?? "normal") === "study" || /\\b(mostre|cite|passagens?|versiculos?|textos?)\\b/.test(normalize(effectiveInput)) ? 2 : 0;\n      answerText = clampText(await enrichBibleReferences(answerText, supabase, config, harpaBible, null, harpaAutomaticBlocks));'
assistant = replace_once(assistant, old_harpa_enrich, new_harpa_enrich, 'Harpa automatic Bible block limit')

ASSISTANT.write_text(assistant)

# Permanent routing regressions for Harpa analytical follow-ups.
routing = ROUTING_TEST.read_text()
anchor = '  assertEquals(deterministicIntent("Explique esse hino", harpaHistory), "harpa_study");\n});'
replacement = '  assertEquals(deterministicIntent("Explique esse hino", harpaHistory), "harpa_study");\n  assertEquals(deterministicIntent("É bíblico? Que tipo de hino é esse?", harpaHistory), "harpa_study");\n  assertEquals(deterministicIntent("Qual o tipo desse hino?", harpaHistory), "harpa_study");\n  assertEquals(deterministicIntent("Qual a categoria e a mensagem desse hino?", harpaHistory), "harpa_study");\n});'
routing = replace_once(routing, anchor, replacement, 'Harpa routing tests')
ROUTING_TEST.write_text(routing)

# Permanent presentation/devotional regressions.
style = STYLE_TEST.read_text()
old_import = 'import { automaticBibleBlockLimit, cleanGeneratedBibleScaffolding, needsNaturalBibleAnswerRepair, stripBrokenBibleGuardLines } from "./assistant.ts";'
new_import = 'import { automaticBibleBlockLimit, cleanGeneratedBibleScaffolding, needsNaturalBibleAnswerRepair, normalizeCommonBibleAnswer, stripBrokenBibleGuardLines, stripDevotionalBibleEcho } from "./assistant.ts";'
style = replace_once(style, old_import, new_import, 'style test import')
style += r'''

Deno.test("ATIS deterministically flattens a repaired common Bible mini-study", () => {
  const structured = `Na última ceia, Jesus reuniu os discípulos.\n\n### Pontos principais\n- **Serviço** – Jesus lavou os pés dos discípulos.\n- **Memória** – A ceia aponta para sua entrega.\n\nIsso revela amor e humildade.`;
  assertEquals(
    normalizeCommonBibleAnswer(structured, "ask_bible", "normal"),
    `Na última ceia, Jesus reuniu os discípulos.\n\nServiço: Jesus lavou os pés dos discípulos. Memória: A ceia aponta para sua entrega.\n\nIsso revela amor e humildade.`,
  );
});

Deno.test("ATIS devotional removes model-owned duplicate Bible block before backend rendering", () => {
  const context = {
    label: "Isaías 55:6-9",
    text: "6 Buscai o SENHOR enquanto se pode achar, invocai-o enquanto está perto. 7 Deixe o perverso o seu caminho e converta-se ao SENHOR.",
  };
  const generated = `📖 *Isaías 55:6-9*\n\n${context.text}\n\nDeus nos chama a buscá-lo com sinceridade.\n\n**Oração:** Senhor, guia-nos em teus caminhos. Amém.`;
  assertEquals(
    stripDevotionalBibleEcho(generated, context),
    `Deus nos chama a buscá-lo com sinceridade.\n\n**Oração:** Senhor, guia-nos em teus caminhos. Amém.`,
  );
});
'''
STYLE_TEST.write_text(style)

# Harpa study: structured internals, conversational rendering, no user-visible placeholders.
harpa = HARPA.read_text()
old_prompt = 'content: `Você é Atis, assistente ministerial da Bíblia do Atalaia. Analise SOMENTE a letra da Harpa fornecida como fonte primária. Não invente autoria, data, origem histórica, intenção do compositor ou fatos externos. Não transcreva texto bíblico. Sugira apenas referências bíblicas específicas (livro capítulo:versículo) que sejam claramente coerentes com o conteúdo do hino; essas referências serão verificadas pelo backend antes de aparecer ao usuário. Responda SOMENTE JSON válido no formato {"theme":"...","explanation":"...","application":"...","references":["João 3:16"]}. Use português brasileiro. ${conversationMode === "study" ? "A explicação pode ser mais aprofundada." : conversationMode === "concise" ? "Seja muito conciso." : "Seja claro e pastoral."}`,'
new_prompt = 'content: `Você é Atis, assistente ministerial da Bíblia do Atalaia. Analise SOMENTE a letra da Harpa fornecida como fonte primária. Não invente autoria, data, origem histórica, intenção do compositor ou fatos externos. Não copie nem cite literalmente a letra; explique por paráfrase. Não transcreva texto bíblico. Sugira apenas referências bíblicas específicas (livro capítulo:versículo) claramente coerentes com o conteúdo do hino; o backend verificará cada uma. Responda SOMENTE JSON válido no formato {"theme":"frase curta","explanation":"explicação natural","application":"aplicação opcional","hymn_type":"classificação curta do tipo de hino","biblical_assessment":"avaliação direta e equilibrada sobre a coerência bíblica da mensagem","references":["João 3:16"]}. Os campos devem ser texto corrido, sem markdown, listas, aspas de letra ou placeholders. Use português brasileiro. ${conversationMode === "study" ? "A explicação pode ser mais aprofundada." : conversationMode === "concise" ? "Seja muito conciso." : "Seja claro, pastoral e conversacional."}`,'
harpa = replace_once(harpa, old_prompt, new_prompt, 'Harpa AI structured prompt')

old_raw = '    const rawApplication = compactField(analysis.application, "Use a mensagem do hino como convite à reflexão e à prática da fé cristã.", 700);\n\n    const rawReferences = Array.isArray(analysis.references) ? analysis.references.filter((item: unknown) => typeof item === "string").slice(0, 6) : [];'
new_raw = '    const rawApplication = compactField(analysis.application, "Use a mensagem do hino como convite à reflexão e à prática da fé cristã.", 700);\n    const rawHymnType = compactField(analysis.hymn_type, "hino cristocêntrico de fé e confiança", 240);\n    const rawBiblicalAssessment = compactField(analysis.biblical_assessment, "A mensagem deve ser avaliada pelas afirmações da própria letra e pelas conexões bíblicas verificadas.", 500);\n\n    const rawReferences = Array.isArray(analysis.references) ? analysis.references.filter((item: unknown) => typeof item === "string").slice(0, 6) : [];'
harpa = replace_once(harpa, old_raw, new_raw, 'Harpa structured fields')

render_start = harpa.index('    const verifiedKeys = new Set(verified.map((item) => normalize(item.label)));')
render_end = harpa.index('\n\n    return json({', render_start)
new_render = r'''    const verifiedKeys = new Set(verified.map((item) => normalize(item.label)));
    const sanitizeNarrative = (value: string) => {
      const withoutLongQuotes = value
        .replace(/“[^”\n]{24,}”/g, "")
        .replace(/"[^"\n]{24,}"/g, "");
      return withoutLongQuotes
        .replace(/\b(?:[1-3]\s+)?[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,3}\s+\d{1,3}:\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?/gu, (candidate) => {
          const reference = resolveBibleReference(candidate, bible);
          if (!reference) return "";
          const canonical = bibleExcerpt(reference).label;
          return verifiedKeys.has(normalize(canonical)) ? canonical : "";
        })
        .replace(/\(\s*\)/g, "")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
    };

    const theme = sanitizeNarrative(rawTheme);
    const explanation = sanitizeNarrative(rawExplanation);
    const application = sanitizeNarrative(rawApplication);
    const hymnType = sanitizeNarrative(rawHymnType);
    const biblicalAssessment = sanitizeNarrative(rawBiblicalAssessment);
    const q = normalize(message);
    const asksType = /\b(?:tipo|categoria|classifica\w*|genero|estilo)\b/.test(q);
    const asksBiblical = /\b(?:biblic\w*|doutrin\w*|teolog\w*)\b/.test(q);
    const asksApplication = /\b(?:aplica\w*|pratica|como viver|como aplicar)\b/.test(q);
    const asksConnections = /\b(?:conex\w*|passagens?|referencias?|versiculos?|textos?)\b/.test(q);
    const wantsLiteralConnections = conversationMode === "study" || /\b(?:mostre|mostrar|cite|citar|passagens?|versiculos?|textos?)\b/.test(q);
    const referencesInline = verified.length
      ? `As conexões bíblicas mais diretas são ${verified.map((item) => item.label).join(", ")}.`
      : "";

    let answer = "";
    if (conversationMode === "study") {
      const studyConnections = verified.length
        ? `\n\n*Conexões bíblicas:* ${verified.map((item) => item.label).join(", ")}.`
        : "";
      answer = `🎵 *Harpa Cristã ${hymn.numero} — ${title}*\n\n*Tema:* ${theme}\n\n${explanation}\n\n*Aplicação:* ${application}${studyConnections}`;
    } else {
      const paragraphs: string[] = [];
      if (asksBiblical && biblicalAssessment) paragraphs.push(biblicalAssessment);
      if (asksType && hymnType) paragraphs.push(`Quanto ao tipo, este é ${hymnType.replace(/[.!?]+$/u, "")}.`);
      if (!asksBiblical && !asksType) paragraphs.push(`O hino ${hymn.numero}, “${title}”, tem como tema ${theme.replace(/[.!?]+$/u, "")}.`);
      if (explanation) paragraphs.push(explanation);
      if (asksApplication && application) paragraphs.push(application);
      if ((asksBiblical || asksConnections) && referencesInline) paragraphs.push(referencesInline);
      answer = paragraphs.filter(Boolean).join("\n\n");
    }

    if (wantsLiteralConnections && verified.length) {
      const literalBlocks = verified.slice(0, 2).map((item) => `📖 *${item.label}*\n${item.text}`).join("\n\n");
      answer = `${answer.trimEnd()}\n\n${literalBlocks}`;
    }

    answer = clampText(answer
      .replace(/trecho literal omitido[^)]*\)?/gi, "")
      .replace(/uma passagem bíblica relacionada(?:-\d+)?/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim());'''
harpa = harpa[:render_start] + new_render + harpa[render_end:]
HARPA.write_text(harpa)

print('ATIS v44 patch applied')
