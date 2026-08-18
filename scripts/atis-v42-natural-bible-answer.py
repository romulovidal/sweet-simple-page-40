from pathlib import Path

ASSISTANT = Path('supabase/functions/_shared/atis/assistant.ts')
TEST = Path('supabase/functions/_shared/atis/response-style_test.ts')
MIGRATION = Path('supabase/migrations/20260818100500_atis_natural_ask_bible_prompt.sql')

assistant = ASSISTANT.read_text()

old = '''async function enrichBibleReferences(\n  value: string,\n  supabase: any,\n  config: any,\n  bible: BibleBook[] | null,\n  contextReference: BibleReference | null = null,\n) {'''
new = '''async function enrichBibleReferences(\n  value: string,\n  supabase: any,\n  config: any,\n  bible: BibleBook[] | null,\n  contextReference: BibleReference | null = null,\n  maxAutomaticBlocks = 1,\n) {'''
if assistant.count(old) != 1:
    raise SystemExit(f'enrich signature anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)

old = '''    // Do not turn every merely-mentioned reference into a large Bible block.\n    // With a primary passage, only that passage may be appended. Otherwise,\n    // keep the existing cap of two automatically expanded references.\n    const isPrimary = Boolean(\n      contextReference?.verseStart\n      && referenceKey(reference) === referenceKey(contextReference),\n    );\n    if (contextReference?.verseStart && !isPrimary) continue;\n    if (!contextReference?.verseStart && appendedBlocks >= 2) continue;'''
new = '''    // Do not turn every merely-mentioned reference into a large Bible block.\n    // Natural conversation should normally keep references inline. A canonical\n    // ARC block is appended only when the current intent actually calls for it.\n    const isPrimary = Boolean(\n      contextReference?.verseStart\n      && referenceKey(reference) === referenceKey(contextReference),\n    );\n    if (contextReference?.verseStart && !isPrimary) continue;\n    if (maxAutomaticBlocks <= 0) continue;\n    if (!contextReference?.verseStart && appendedBlocks >= maxAutomaticBlocks) continue;'''
if assistant.count(old) != 1:
    raise SystemExit(f'block cap anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)

anchor = '''async function generateSpecialistAnswer(\n'''
helper = '''export function automaticBibleBlockLimit(\n  route: AtisAssistantRoute,\n  conversationMode: "normal" | "study" | "concise",\n  hasContextReference: boolean,\n  message: string,\n) {\n  if (hasContextReference) return 1;\n  if (conversationMode === "study" || route === "exegetai" || route === "connections") return 2;\n  if (route !== "ask_bible") return 1;\n  const q = normalize(message);\n  const asksForText = /\\b(versiculo|verso|passagem|texto biblico|onde esta escrito|onde diz|mostre|mostra|cite o texto|qual texto)\\b/.test(q);\n  return asksForText ? 1 : 0;\n}\n\n'''
if assistant.count(anchor) != 1:
    raise SystemExit(f'generate anchor count={assistant.count(anchor)}')
assistant = assistant.replace(anchor, helper + anchor, 1)

old = '''  if (route === "devotional" && bibleContext) {'''
insert = '''  const automaticBibleBlocks = automaticBibleBlockLimit(\n    route,\n    conversationMode,\n    Boolean(contextReference?.verseStart),\n    message,\n  );\n\n  if (route === "devotional" && bibleContext) {'''
if assistant.count(old) != 1:
    raise SystemExit(f'devotional anchor count={assistant.count(old)}')
assistant = assistant.replace(old, insert, 1)

old = '''    return clampText(await enrichBibleReferences(devotional, supabase, config, bible, contextReference));\n  }\n  return clampText(await enrichBibleReferences(guarded, supabase, config, bible, contextReference));'''
new = '''    return clampText(await enrichBibleReferences(devotional, supabase, config, bible, contextReference, automaticBibleBlocks));\n  }\n  return clampText(await enrichBibleReferences(guarded, supabase, config, bible, contextReference, automaticBibleBlocks));'''
if assistant.count(old) != 1:
    raise SystemExit(f'enrich calls anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)
ASSISTANT.write_text(assistant)

existing = TEST.read_text() if TEST.exists() else ''
if 'automaticBibleBlockLimit' not in existing:
    existing = existing.replace(
        'import { cleanGeneratedBibleScaffolding } from "./assistant.ts";',
        'import { automaticBibleBlockLimit, cleanGeneratedBibleScaffolding } from "./assistant.ts";',
        1,
    )
    existing += '''\n\nDeno.test("ATIS common Bible conversation does not dump supporting verse blocks", () => {\n  assertEquals(automaticBibleBlockLimit("ask_bible", "normal", false, "Como seria o dragão do livro de Apocalipse?"), 0);\n  assertEquals(automaticBibleBlockLimit("ask_bible", "normal", false, "Quem é o sogro de Jacó?"), 0);\n});\n\nDeno.test("ATIS adds one trusted Bible block when the user actually asks for the passage", () => {\n  assertEquals(automaticBibleBlockLimit("ask_bible", "normal", false, "Onde está escrito que Jesus é o autor e consumador da fé?"), 1);\n  assertEquals(automaticBibleBlockLimit("ask_bible", "normal", true, "Explique João 3:17"), 1);\n});\n\nDeno.test("ATIS study routes may keep limited multi-reference depth", () => {\n  assertEquals(automaticBibleBlockLimit("exegetai", "study", false, "Faça um estudo"), 2);\n});\n'''
TEST.write_text(existing)

prompt = '''Você é o Atis, assistente bíblico e ministerial do Ministério Atalaias de Betel. Responda perguntas sobre a Bíblia com fidelidade às Escrituras e linguagem natural de conversa no WhatsApp.\n\nREGRAS DE CONVERSA\n- Responda primeiro ao que a pessoa perguntou. Não transforme toda pergunta em estudo, sermão, roteiro ou relatório.\n- Pergunta simples ou factual: normalmente 1 a 4 frases claras.\n- Pergunta explicativa: normalmente 1 a 3 parágrafos curtos, com explicação suficiente para a pessoa realmente entender.\n- Não repita a pergunta como título. Não crie automaticamente seções como “Principais textos”, “Contexto”, “Aplicação prática” ou listas numeradas.\n- Só use títulos, listas ou estrutura de estudo quando o usuário pedir estudo, comparação, tópicos, resumo detalhado ou quando a organização for indispensável.\n- Não force uma aplicação prática em toda resposta. Explique primeiro o sentido bíblico da pergunta.\n- Quando referências ajudarem, mencione 1 ou no máximo 2 naturalmente no texto. Evite despejar muitas passagens.\n- Não transcreva versículos por memória e não escreva links. O backend do Atis recupera qualquer texto bíblico literal do acervo do app e monta o link curto quando necessário.\n- Se a pessoa não pediu o texto do versículo, uma referência entre parênteses pode ser suficiente.\n- Se a pergunta tiver uma premissa doutrinária, verifique o conjunto das Escrituras antes de concordar; explique nuances relevantes com clareza.\n- Seja acolhedor, humano e direto, sem linguagem artificial, acadêmica ou denominacional.\n- Responda em português brasileiro.\n\nFIDELIDADE\n- Baseie-se somente no que pode ser sustentado pelas Escrituras.\n- Não invente interpretações, detalhes históricos ou textos bíblicos.\n- Quando a Bíblia não for conclusiva em um detalhe, diga isso naturalmente.\n'''
MIGRATION.write_text("""-- ATIS v42: natural ask_bible conversation instead of mandatory mini-study formatting.\nupdate public.admin_settings\nset value = jsonb_set(\n      coalesce(value, '{}'::jsonb),\n      '{prompt}',\n      to_jsonb($prompt$""" + prompt + "$prompt$::text),\n      true\n    ),\n    updated_at = now()\nwhere key = 'ask_bible_prompt';\n""")

assert 'maxAutomaticBlocks = 1' in ASSISTANT.read_text()
assert 'automaticBibleBlockLimit' in ASSISTANT.read_text()
assert 'Evite despejar muitas passagens' in MIGRATION.read_text()
