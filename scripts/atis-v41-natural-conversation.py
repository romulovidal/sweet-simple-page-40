from pathlib import Path

ASSISTANT = Path('supabase/functions/_shared/atis/assistant.ts')
MIGRATION = Path('supabase/migrations/20260818093830_atis_natural_conversation_tone.sql')
TEST = Path('supabase/functions/_shared/atis/response-style_test.ts')

assistant = ASSISTANT.read_text()

concise = '- Seja conciso para WhatsApp, salvo quando o usuário pedir estudo aprofundado.'
if assistant.count(concise) != 1:
    raise SystemExit(f'concise style anchor count={assistant.count(concise)}')
assistant = assistant.replace(
    concise,
    '- Responda como uma conversa natural no WhatsApp, não como relatório, apostila ou formulário.',
    1,
)

structured = 'Em modo normal ou conciso, perguntas abertas devem ser respondidas diretamente em no máximo 2 parágrafos curtos, com no máximo 2 referências bíblicas de apoio. Não use tabelas, listas longas ou vários subtítulos salvo pedido explícito.'
if assistant.count(structured) != 1:
    raise SystemExit(f'structured style anchor count={assistant.count(structured)}')
natural_rules = '\\n'.join([
    'Não repita a pergunta do usuário como título ou abertura. Comece diretamente pela resposta.',
    'Para perguntas simples ou factuais, responda primeiro em uma frase clara e só complemente quando isso realmente ajudar.',
    'Em modo normal ou conciso, não use tabelas, títulos, subtítulos, listas de “principais textos” ou enumerações automáticas salvo quando o usuário pedir esse formato ou quando ele for realmente necessário.',
    'Quando referências bíblicas ajudarem, use no máximo 2 em respostas comuns e mencione-as naturalmente no texto.',
    'Não escreva “📖 Leia aqui:”, não simule link, não deixe cabeçalho bíblico vazio e não termine uma referência com traço esperando conteúdo. O backend monta o bloco bíblico confiável e o link curto.',
    'Emojis são opcionais: use no máximo 1 ou 2 quando combinarem naturalmente com a conversa; não os use como decoração obrigatória.',
    'Se a pergunta contiver uma conclusão doutrinária embutida, não a confirme automaticamente. Responda com a nuance que o conjunto das Escrituras exigir e diferencie com clareza Deus Pai, Jesus Cristo/o Cordeiro e o Espírito Santo quando isso for relevante.',
])
assistant = assistant.replace(structured, natural_rules, 1)

anchor = '''async function enrichBibleReferences(
  value: string,
  supabase: any,
  config: any,
  bible: BibleBook[] | null,
  contextReference: BibleReference | null = null,
) {
'''
helper = r'''export function cleanGeneratedBibleScaffolding(value: string) {
  const lines = String(value ?? "").split(/\r?\n/);
  const cleaned = lines.filter((line) => {
    // The model must never manufacture the share UI. A verified link is added
    // later by trustedBibleBlock/create-verse-share.
    if (/^\s*📖\s*Leia aqui\s*:\s*$/iu.test(line)) return false;

    // Remove dangling Bible headers such as:
    //   📖 *Gênesis 29:6 (ARC)* –
    // They are artifacts of the model trying to imitate the backend formatter.
    if (/^\s*📖\s*\*[^*\n]+\*\s*[-–—:]\s*$/u.test(line)) return false;

    // Remove list items that contain only a Bible reference followed by an
    // empty dash/colon. The reference was already extracted before this cleanup
    // and the canonical block will be built from the app Bible.
    if (/^\s*[-•]\s*\*{0,2}[^*\n]*\d{1,3}\s*:\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\*{0,2}\s*[-–—:]\s*$/u.test(line)) return false;

    return true;
  });
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

'''
if assistant.count(anchor) != 1:
    raise SystemExit(f'enrich anchor count={assistant.count(anchor)}')
assistant = assistant.replace(anchor, helper + anchor, 1)

old = '''  let output = cleanBibleGuardPlaceholders(value, bible, contextReference);
  const candidates = extractBibleReferences(output, bible);
  if (contextReference?.verseStart) candidates.unshift(contextReference);'''
new = '''  let output = cleanBibleGuardPlaceholders(value, bible, contextReference);
  // Extract references before removing presentation artifacts, so the backend
  // can still resolve the real verse even if the model emitted an empty header.
  const candidates = extractBibleReferences(output, bible);
  output = cleanGeneratedBibleScaffolding(output);
  if (contextReference?.verseStart) candidates.unshift(contextReference);'''
if assistant.count(old) != 1:
    raise SystemExit(f'cleanup insertion anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)
ASSISTANT.write_text(assistant)

TEST.write_text('''import { assertEquals } from "jsr:@std/assert";\nimport { cleanGeneratedBibleScaffolding } from "./assistant.ts";\n\nDeno.test("ATIS removes empty Bible/share scaffolding produced by AI", () => {\n  const input = `O sogro de Jacó era **Lábân**, pai de Lia e Raquel.\n\n📖 *Gênesis 29:6 (ARC)* –\n\n📖 Leia aqui:`;\n  assertEquals(\n    cleanGeneratedBibleScaffolding(input),\n    "O sogro de Jacó era **Lábân**, pai de Lia e Raquel.",\n  );\n});\n\nDeno.test("ATIS removes dangling reference list items but preserves natural prose", () => {\n  const input = `A Bíblia apresenta Deus e o Cordeiro recebendo honra e glória. Veja Apocalipse 5:12-13.\n\n- **1 Timóteo 1:17** –\n- **Apocalipse 4:11** –`;\n  assertEquals(\n    cleanGeneratedBibleScaffolding(input),\n    "A Bíblia apresenta Deus e o Cordeiro recebendo honra e glória. Veja Apocalipse 5:12-13.",\n  );\n});\n''')

MIGRATION.write_text('''-- ATIS v41: make the persisted assistant personality conversational instead of decorative/template-heavy.\nupdate public.atis_settings\nset value = jsonb_set(\n      value,\n      '{system_prompt}',\n      to_jsonb(\n        replace(\n          value->>'system_prompt',\n          '- Use emojis de forma frequente, mas sem prejudicar a clareza.',\n          '- Use emojis com moderação e somente quando combinarem naturalmente com a resposta; não os use como decoração obrigatória.'\n        )\n      ),\n      false\n    ),\n    updated_at = now()\nwhere key = 'assistant'\n  and value->>'system_prompt' like '%Use emojis de forma frequente, mas sem prejudicar a clareza.%';\n''')

assert 'cleanGeneratedBibleScaffolding' in ASSISTANT.read_text()
assert 'não como relatório' in ASSISTANT.read_text()
assert MIGRATION.exists()
assert TEST.exists()
