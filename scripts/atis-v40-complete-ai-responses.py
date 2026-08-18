from pathlib import Path

AI_FETCH = Path('supabase/functions/_shared/ai-fetch.ts')
ASSISTANT = Path('supabase/functions/_shared/atis/assistant.ts')

ai = AI_FETCH.read_text()

old = '''async function tryGemini(body: Record<string, unknown>, key: string): Promise<Response> {\n  // Gemini 3.x deprecates sampling parameters used by older chat callers.\n  // Strip them only for the Gemini fallback; Groq keeps the caller payload.\n  const { temperature: _temperature, top_p: _topP, top_k: _topK, ...rest } = body as Record<string, unknown>;\n  const geminiBody = { ...rest, model: toGeminiModel(String(body.model ?? "gemini-3.6-flash")) };'''
new = '''async function tryGemini(body: Record<string, unknown>, key: string): Promise<Response> {\n  // Gemini 3.x deprecates sampling parameters used by older chat callers and\n  // does not use Groq GPT-OSS reasoning controls. Strip provider-specific\n  // fields before falling back so Groq tuning cannot break Gemini.\n  const {\n    temperature: _temperature,\n    top_p: _topP,\n    top_k: _topK,\n    reasoning_effort: _reasoningEffort,\n    reasoning_format: _reasoningFormat,\n    ...rest\n  } = body as Record<string, unknown>;\n  const geminiBody = { ...rest, model: toGeminiModel(String(body.model ?? "gemini-3.6-flash")) };'''
if ai.count(old) != 1:
    raise SystemExit(f'gemini anchor count={ai.count(old)}')
ai = ai.replace(old, new, 1)

old = '''async function tryGroq(body: Record<string, unknown>, key: string): Promise<Response> {\n  const groqBody = { ...body, model: toGroqModel(String(body.model ?? "")) };\n  return await fetch(GROQ_URL, {'''
new = '''async function tryGroq(body: Record<string, unknown>, key: string): Promise<Response> {\n  const mappedModel = toGroqModel(String(body.model ?? ""));\n  const { max_tokens: legacyMaxTokens, ...rest } = body as Record<string, unknown>;\n  const groqBody = {\n    ...rest,\n    model: mappedModel,\n    ...(legacyMaxTokens != null && rest.max_completion_tokens == null\n      ? { max_completion_tokens: legacyMaxTokens }\n      : {}),\n  };\n  return await fetch(GROQ_URL, {'''
if ai.count(old) != 1:
    raise SystemExit(f'groq anchor count={ai.count(old)}')
ai = ai.replace(old, new, 1)

old = '''        const res = await provider.run();\n        if (res.ok) {\n          console.info(`[ai-fetch] success ${provider.name}/${modelFor(provider.name)} a${attempt + 1} ${Date.now() - startedAt}ms`);\n          return res;\n        }\n        lastRes = res;'''
new = '''        const res = await provider.run();\n        if (res.ok) {\n          const providerModel = modelFor(provider.name);\n          let finishReason = "";\n          if (body.stream !== true) {\n            const successBody = await res.clone().json().catch(() => null) as any;\n            finishReason = String(successBody?.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();\n          }\n\n          // A provider can return HTTP 200 while the model stopped because the\n          // completion budget ended. Never deliver that partial answer. Try the\n          // next configured provider instead; if every provider truncates,\n          // surface a controlled failure rather than broken WhatsApp text.\n          if (finishReason === "length" || finishReason === "max_tokens") {\n            attempts.push({\n              provider: provider.name,\n              model: providerModel,\n              attempt: attempt + 1,\n              status: 200,\n              ms: Date.now() - startedAt,\n              remaining_tokens: res.headers.get('x-ratelimit-remaining-tokens') ?? undefined,\n              reset_tokens: res.headers.get('x-ratelimit-reset-tokens') ?? undefined,\n              remaining_requests: res.headers.get('x-ratelimit-remaining-requests') ?? undefined,\n              detail: `finish_reason=${finishReason}`,\n            });\n            const headers = new Headers(res.headers);\n            headers.set('Content-Type', 'application/json');\n            headers.set('x-atis-ai-diagnostic', compactDiagnostics());\n            headers.set('x-atis-ai-provider', provider.name);\n            headers.set('x-atis-ai-model', providerModel);\n            headers.set('x-atis-ai-finish-reason', finishReason);\n            const truncatedResponse = new Response(JSON.stringify({ error: 'AI_TRUNCATED_RESPONSE' }), { status: 502, headers });\n            lastRes = truncatedResponse;\n            if (i < providers.length - 1) {\n              console.error(`[ai-fetch] ${labels[provider.name]} returned a truncated completion; trying next fallback.`);\n              break;\n            }\n            return truncatedResponse;\n          }\n\n          const headers = new Headers(res.headers);\n          headers.set('x-atis-ai-provider', provider.name);\n          headers.set('x-atis-ai-model', providerModel);\n          if (finishReason) headers.set('x-atis-ai-finish-reason', finishReason);\n          console.info(`[ai-fetch] success ${provider.name}/${providerModel} a${attempt + 1} ${Date.now() - startedAt}ms finish=${finishReason || 'unknown'}`);\n          return new Response(res.body, { status: res.status, statusText: res.statusText, headers });\n        }\n        lastRes = res;'''
if ai.count(old) != 1:
    raise SystemExit(f'success anchor count={ai.count(old)}')
ai = ai.replace(old, new, 1)
AI_FETCH.write_text(ai)

assistant = ASSISTANT.read_text()

old = '''  const system = `${config.systemPrompt}\\n\\nFERRAMENTA ESPECIALIZADA SELECIONADA\\n${specialist}\\n\\nREGRAS DE SAÍDA DO ATIS\\n- Sua identidade pública continua sendo Atis; não diga que você é ExegettAI ou outro motor.\\n- Não mencione roteamento, provider ou ferramenta interna.\\n- Não invente texto bíblico. Quando houver CONTEXTO BÍBLICO RECUPERADO DO APP, trate-o como fonte do texto citado.\\n- Fora do CONTEXTO BÍBLICO RECUPERADO DO APP, cite apenas a referência bíblica, nunca o texto literal.\\n- Não inclua links ou URLs. O backend acrescenta exclusivamente links curtos de versículos verificados no formato /v/.\\n- Na parte explicativa, prefira citar a referência sem transcrever o versículo; o backend acrescentará o texto bíblico real recuperado do app.\\n- Seja conciso para WhatsApp, salvo quando o usuário pedir estudo aprofundado.${continuityRule}${modeRule}${destinationRule}${devotionalRule}${context}`;'''
new = '''  const system = `${config.systemPrompt}\\n\\nFERRAMENTA ESPECIALIZADA SELECIONADA\\n${specialist}\\n\\nREGRAS DE SAÍDA DO ATIS\\n- Sua identidade pública continua sendo Atis; não diga que você é ExegettAI ou outro motor.\\n- Não mencione roteamento, provider ou ferramenta interna.\\n- Não invente texto bíblico. Quando houver CONTEXTO BÍBLICO RECUPERADO DO APP, trate-o como fonte do texto citado.\\n- Fora do CONTEXTO BÍBLICO RECUPERADO DO APP, cite apenas a referência bíblica, nunca o texto literal.\\n- Não inclua links ou URLs. O backend acrescenta exclusivamente links curtos de versículos verificados no formato /v/.\\n- Na parte explicativa, prefira citar a referência sem transcrever o versículo; o backend acrescentará o texto bíblico real recuperado do app.\\n- Seja conciso para WhatsApp, salvo quando o usuário pedir estudo aprofundado.\\n- Em modo normal ou conciso, perguntas abertas devem ser respondidas diretamente em no máximo 2 parágrafos curtos, com no máximo 2 referências bíblicas de apoio. Não use tabelas, listas longas ou vários subtítulos salvo pedido explícito.\\n- Sempre conclua a última frase. Nunca entregue uma resposta interrompida ou um fragmento.${continuityRule}${modeRule}${destinationRule}${devotionalRule}${context}`;'''
if assistant.count(old) != 1:
    raise SystemExit(f'system anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)

old = '''    temperature: 0.55,\n    // WhatsApp output is clamped to ~3.8k characters later, so reserving\n    // 1.8k-2.8k output tokens only wastes TPM. Keep enough room for a useful\n    // answer while staying compatible with Groq's Free/Developer token budget.\n    max_tokens: conversationMode === "study" ? 1200 : conversationMode === "concise" ? 450 : route === "exegetai" ? 1400 : 900,'''
new = '''    temperature: 0.55,\n    // GPT-OSS defaults to medium reasoning on Groq. Normal WhatsApp answers do\n    // not need that overhead; low reasoning leaves more of the TPM/completion\n    // budget for the visible answer while preserving a safe output ceiling.\n    reasoning_effort: "low",\n    reasoning_format: "hidden",\n    max_tokens: conversationMode === "study" ? 1800 : conversationMode === "concise" ? 650 : route === "exegetai" ? 1800 : 1400,'''
if assistant.count(old) != 1:
    raise SystemExit(f'budget anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)

old = '''  const body = await response.json().catch(() => null) as any;\n  const text = firstString(body?.choices?.[0]?.message?.content);\n  if (!text) throw new Error("AI_EMPTY_RESPONSE");'''
new = '''  const body = await response.json().catch(() => null) as any;\n  const finishReason = firstString(body?.choices?.[0]?.finish_reason)?.toLowerCase() ?? "";\n  if (finishReason === "length" || finishReason === "max_tokens") {\n    throw new Error(`AI_PROVIDER_UNAVAILABLE|finish_reason=${finishReason}`);\n  }\n  const text = firstString(body?.choices?.[0]?.message?.content);\n  if (!text) throw new Error("AI_EMPTY_RESPONSE");'''
if assistant.count(old) != 1:
    raise SystemExit(f'finish anchor count={assistant.count(old)}')
assistant = assistant.replace(old, new, 1)
ASSISTANT.write_text(assistant)

assert 'reasoning_effort: "low"' in ASSISTANT.read_text()
assert 'finish_reason=${finishReason}' in ASSISTANT.read_text()
assert 'truncated completion' in AI_FETCH.read_text()
assert 'max_completion_tokens' in AI_FETCH.read_text()
