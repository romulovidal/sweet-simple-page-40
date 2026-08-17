from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:220]!r}")
    p.write_text(text.replace(old, new, 1))

# Assistant accepts prior turns as conversation context.
path = "supabase/functions/_shared/atis/assistant.ts"
replace_once(
    path,
    '''export type AtisAssistantOptions = {\n  allowedAiRoutes?: string[] | null;\n};''',
    '''export type AtisConversationMessage = { role: "user" | "assistant"; content: string };\n\nexport type AtisAssistantOptions = {\n  allowedAiRoutes?: string[] | null;\n  conversationHistory?: AtisConversationMessage[];\n};''',
)

replace_once(
    path,
    '''async function classifyWithAi(systemPrompt: string, message: string): Promise<AtisAssistantRoute> {''',
    '''async function classifyWithAi(systemPrompt: string, message: string, history: AtisConversationMessage[] = []): Promise<AtisAssistantRoute> {''',
)
replace_once(
    path,
    '''    messages: [\n      { role: "system", content: `${systemPrompt}\\n\\nVocê está apenas classificando intenção. Retorne SOMENTE um identificador desta lista: ${allowed.join(", ")}. Não responda a pergunta.` },\n      { role: "user", content: message },\n    ],''',
    '''    messages: [\n      { role: "system", content: `${systemPrompt}\\n\\nVocê está apenas classificando intenção. Use o histórico somente para entender referências e continuidade. Retorne SOMENTE um identificador desta lista: ${allowed.join(", ")}. Não responda a pergunta.` },\n      ...history.slice(-8),\n      { role: "user", content: message },\n    ],''',
)

replace_once(
    path,
    '''  message: string,\n  bibleContext: { label: string; text: string } | null,\n) {''',
    '''  message: string,\n  bibleContext: { label: string; text: string } | null,\n  history: AtisConversationMessage[] = [],\n) {''',
)
replace_once(
    path,
    '''  const system = `${config.systemPrompt}\\n\\nFERRAMENTA ESPECIALIZADA SELECIONADA\\n${specialist}\\n\\nREGRAS DE SAÍDA DO ATIS\\n- Sua identidade pública continua sendo Atis; não diga que você é ExegettAI ou outro motor.\\n- Não mencione roteamento, provider ou ferramenta interna.\\n- Não invente texto bíblico. Quando houver CONTEXTO BÍBLICO RECUPERADO DO APP, trate-o como fonte do texto citado.\\n- Fora do CONTEXTO BÍBLICO RECUPERADO DO APP, cite apenas a referência bíblica, nunca o texto literal.\\n- Seja conciso para WhatsApp, salvo quando o usuário pedir estudo aprofundado.${context}`;''',
    '''  const continuityRule = history.length\n    ? "\\n- Há histórico desta conversa abaixo. Continue naturalmente do ponto em que ela está; não se apresente novamente, não repita boas-vindas e não trate o usuário como se fosse a primeira mensagem. Use pronomes e referências anteriores quando forem claras."\n    : "\\n- Esta conversa não possui histórico anterior disponível. Mesmo assim, não faça uma apresentação institucional longa; responda diretamente ao pedido do usuário.";\n  const system = `${config.systemPrompt}\\n\\nFERRAMENTA ESPECIALIZADA SELECIONADA\\n${specialist}\\n\\nREGRAS DE SAÍDA DO ATIS\\n- Sua identidade pública continua sendo Atis; não diga que você é ExegettAI ou outro motor.\\n- Não mencione roteamento, provider ou ferramenta interna.\\n- Não invente texto bíblico. Quando houver CONTEXTO BÍBLICO RECUPERADO DO APP, trate-o como fonte do texto citado.\\n- Fora do CONTEXTO BÍBLICO RECUPERADO DO APP, cite apenas a referência bíblica, nunca o texto literal.\\n- Seja conciso para WhatsApp, salvo quando o usuário pedir estudo aprofundado.${continuityRule}${context}`;''',
)
replace_once(
    path,
    '''    messages: [\n      { role: "system", content: system },\n      { role: "user", content: message },\n    ],''',
    '''    messages: [\n      { role: "system", content: system },\n      ...history,\n      { role: "user", content: message },\n    ],''',
)

replace_once(
    path,
    '''  let route = deterministicIntent(input);\n  if (!route) route = await classifyWithAi(config.systemPrompt, input);''',
    '''  const history = Array.isArray(options.conversationHistory)\n    ? options.conversationHistory\n        .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())\n        .slice(-40)\n    : [];\n\n  let route = deterministicIntent(input);\n  if (!route) route = await classifyWithAi(config.systemPrompt, input, history);''',
)
replace_once(
    path,
    '''  const text = await generateSpecialistAnswer(route, config, prompts, input, context);''',
    '''  const text = await generateSpecialistAnswer(route, config, prompts, input, context, history);''',
)

# Webhook loads the previous 20 answered interactions from the exact same conversation.
path = "supabase/functions/atis-webhook/index.ts"
replace_once(
    path,
    '''    autoReplyGroups: data?.value?.auto_reply_groups === true,\n    maxInboundChars: Math.max(100, Math.min(10000, Number(data?.value?.max_inbound_chars ?? 5000))),''',
    '''    autoReplyGroups: data?.value?.auto_reply_groups === true,\n    maxInboundChars: Math.max(100, Math.min(10000, Number(data?.value?.max_inbound_chars ?? 5000))),\n    historyInteractions: Math.max(20, Math.min(50, Number(data?.value?.history_messages ?? 20))),''',
)

replace_once(
    path,
    '''async function resolveDestinationAiPolicy(supabase: any, instance: any, remoteJid: string) {''',
    '''async function loadConversationHistory(supabase: any, instanceId: string, remoteJid: string, limit: number) {\n  const { data, error } = await supabase\n    .from("atis_inbound_messages")\n    .select("message_text,response_text,received_at")\n    .eq("instance_id", instanceId)\n    .eq("remote_jid", remoteJid)\n    .eq("status", "replied")\n    .not("response_text", "is", null)\n    .order("received_at", { ascending: false })\n    .limit(limit);\n  if (error) throw error;\n\n  const history: Array<{ role: "user" | "assistant"; content: string }> = [];\n  for (const row of [...(data ?? [])].reverse()) {\n    const userText = firstString(row.message_text);\n    const assistantText = firstString(row.response_text);\n    if (userText) history.push({ role: "user", content: userText.slice(0, 1800) });\n    if (assistantText) history.push({ role: "assistant", content: assistantText.slice(0, 2200) });\n  }\n  return history;\n}\n\nasync function resolveDestinationAiPolicy(supabase: any, instance: any, remoteJid: string) {''',
)

replace_once(
    path,
    '''      await supabase.from("atis_inbound_messages").update({ status: "processing" }).eq("id", inbound.id);\n      const answer = await runAtisAssistant(supabase, limitedText, { allowedAiRoutes: policy.allowedAiRoutes });''',
    '''      await supabase.from("atis_inbound_messages").update({ status: "processing" }).eq("id", inbound.id);\n      const conversationHistory = await loadConversationHistory(supabase, instance.id, remoteJid, runtime.historyInteractions);\n      const answer = await runAtisAssistant(supabase, limitedText, {\n        allowedAiRoutes: policy.allowedAiRoutes,\n        conversationHistory,\n      });''',
)
replace_once(
    path,
    '''          ai_policy_applied: Array.isArray(policy.allowedAiRoutes),''',
    '''          ai_policy_applied: Array.isArray(policy.allowedAiRoutes),\n          history_interactions_used: Math.floor(conversationHistory.length / 2),\n          history_messages_used: conversationHistory.length,''',
)

# Keep the migration in source control. It was applied to production before this script runs.
Path("supabase/migrations/20260817031000_atis_conversation_history_context.sql").write_text(r'''create index if not exists atis_inbound_messages_conversation_history_idx
on public.atis_inbound_messages(instance_id, remote_jid, received_at desc)
where status = 'replied';

update public.atis_settings
set value = jsonb_set(
  coalesce(value, '{}'::jsonb),
  '{history_messages}',
  '20'::jsonb,
  true
)
where key = 'assistant';
''')

Path(__file__).unlink()
