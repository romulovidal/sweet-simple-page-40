from pathlib import Path

path = Path("supabase/functions/_shared/atis/assistant.ts")
text = path.read_text()


def replace_once(old: str, new: str):
    global text
    if old not in text:
        raise SystemExit(f"Expected assistant block not found: {old[:180]!r}")
    text = text.replace(old, new, 1)

# ATIS is an extension of the app, not a parallel content source.
replace_once(
    '- Dados que já existem no aplicativo devem vir das fontes do aplicativo/banco; não invente versículos, hinos, aniversariantes ou programação.\n- Texto bíblico literal só pode ser transcrito quando recuperado do acervo bíblico do app nesta solicitação.',
    '- O ATIS é uma extensão da Bíblia do Atalaia. Quando existir um recurso ou conteúdo equivalente no app, use a mesma fonte de dados e a mesma realidade do app; não crie uma versão paralela.\n- Dados que já existem no aplicativo devem vir das fontes do aplicativo/banco; não invente versículos, hinos, aniversariantes ou programação.\n- Texto bíblico literal só pode ser transcrito quando recuperado do acervo bíblico do app nesta solicitação.',
)

# Keep the same default devotional instruction as the app's Reflexão Devocional button.
marker = 'const DEFAULT_ATIS_PROMPT = "Você é Atis, assistente virtual ministerial. Responda em português brasileiro, de forma acolhedora, concisa e fiel às Escrituras. Nunca invente dados que devam ser consultados no aplicativo.";\n'
if marker not in text:
    raise SystemExit("DEFAULT_ATIS_PROMPT marker not found")
text = text.replace(
    marker,
    marker + 'const DEFAULT_DEVOTIONAL_PROMPT = "Você é um pastor e escritor devocional. A partir do versículo bíblico fornecido, escreva uma REFLEXÃO DEVOCIONAL curta (2 parágrafos) que:\\n1) Conecte o texto ao cotidiano do leitor\\n2) Traga uma aplicação prática e encorajadora\\nSeja caloroso e inspirador. Use markdown. Responda em português brasileiro.";\n',
    1,
)

old_daily = '''async function dailyVerseLookup(supabase: any) {
  const { data, error } = await supabase.from("current_daily_verse").select("verse_text,verse_ref,scheduled_date").maybeSingle();
  if (error) throw error;
  if (!data?.verse_text) return "📖 O versículo do dia ainda não está disponível no app.";
  return `📖 *${data.verse_ref ?? "Versículo do dia"}*\\n“${data.verse_text}”`;
}
'''
new_daily = '''type CurrentDailyVerse = { text: string; reference: string; scheduledDate: string | null };

async function currentDailyVerse(supabase: any): Promise<CurrentDailyVerse | null> {
  const { data, error } = await supabase
    .from("current_daily_verse")
    .select("verse_text,verse_ref,scheduled_date")
    .maybeSingle();
  if (error) throw error;
  const verseText = firstString(data?.verse_text);
  if (!verseText) return null;
  return {
    text: verseText,
    reference: firstString(data?.verse_ref) ?? "Versículo do dia",
    scheduledDate: firstString(data?.scheduled_date),
  };
}

async function dailyVerseLookup(supabase: any) {
  const daily = await currentDailyVerse(supabase);
  if (!daily) return "📖 O versículo do dia ainda não está disponível no app.";
  return `📖 *${daily.reference}*\\n“${daily.text}”`;
}
'''
replace_once(old_daily, new_daily)

old_specialist = '''  const map: Partial<Record<AtisAssistantRoute, string>> = {
    chapter_summary: "summary",
    word_meaning: "word-meaning",
    connections: "connections",
    timeline: "timeline",
    devotional: "devotional",
  };
  const key = map[route];
  return key ? firstString(prompts.tools?.[key]) : null;
'''
new_specialist = '''  if (route === "devotional") {
    return firstString(prompts.tools?.devotional) ?? DEFAULT_DEVOTIONAL_PROMPT;
  }
  const map: Partial<Record<AtisAssistantRoute, string>> = {
    chapter_summary: "summary",
    word_meaning: "word-meaning",
    connections: "connections",
    timeline: "timeline",
  };
  const key = map[route];
  return key ? firstString(prompts.tools?.[key]) : null;
'''
replace_once(old_specialist, new_specialist)

old_continuity = '''  const continuityRule = history.length
    ? "\\n- Há histórico desta conversa abaixo. Continue naturalmente do ponto em que ela está; não se apresente novamente, não repita boas-vindas e não trate o usuário como se fosse a primeira mensagem. Use pronomes e referências anteriores quando forem claras."
    : "\\n- Esta conversa não possui histórico anterior disponível. Mesmo assim, não faça uma apresentação institucional longa; responda diretamente ao pedido do usuário.";
'''
new_continuity = old_continuity + '''  const devotionalRule = route === "devotional"
    ? "\\n- REFLEXÃO DEVOCIONAL DO ATIS: o único texto-base permitido é o versículo diário atual recuperado da Bíblia do Atalaia e fornecido em CONTEXTO BÍBLICO RECUPERADO DO APP. Exiba a referência e o texto completo recebido, sem alterá-lo, e construa a reflexão somente a partir dele. Não escolha outro versículo, não troque o tema e não omita o texto bíblico. Esta experiência deve refletir o botão Reflexão Devocional do app."
    : "";
  const userMessage = route === "devotional" && bibleContext
    ? `**${bibleContext.label}**\\n\\n"${bibleContext.text}"`
    : message;
'''
replace_once(old_continuity, new_continuity)
replace_once('${continuityRule}${context}`;', '${continuityRule}${devotionalRule}${context}`;')
replace_once('{ role: "user", content: message },', '{ role: "user", content: userMessage },')

old_context = '''  const prompts = await loadSpecialistPrompts(supabase);
  let context: { label: string; text: string } | null = null;
  if (reference) {
    const wholeChapter = route === "chapter_summary" || route === "exegetai" || route === "timeline";
    context = bibleText(reference, wholeChapter && !reference.verseStart);
  }
'''
new_context = '''  const prompts = await loadSpecialistPrompts(supabase);
  let context: { label: string; text: string } | null = null;
  if (route === "devotional") {
    const daily = await currentDailyVerse(supabase);
    if (!daily) {
      return {
        text: "🌿 A reflexão devocional acompanha o versículo diário da Bíblia do Atalaia, mas o versículo de hoje ainda não está disponível no app.",
        route,
        source: "database",
      };
    }
    context = { label: daily.reference, text: daily.text };
  } else if (reference) {
    const wholeChapter = route === "chapter_summary" || route === "exegetai" || route === "timeline";
    context = bibleText(reference, wholeChapter && !reference.verseStart);
  }
'''
replace_once(old_context, new_context)

path.write_text(text)
print("ATIS daily devotional patch applied")
