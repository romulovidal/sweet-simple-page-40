from pathlib import Path

ROOT = Path('.')

def replace_once(path: str, old: str, new: str):
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

assistant = 'supabase/functions/_shared/atis/assistant.ts'

replace_once(
    assistant,
    'import { generateMinistryRelationAnswer, isMinistryRelationIntent, loadMinistryRelationGrounding } from "./ministry-intelligence.ts";\n',
    'import { generateMinistryRelationAnswer, isMinistryRelationIntent, loadMinistryRelationGrounding } from "./ministry-intelligence.ts";\nimport { canonicalEvidenceContext, generateCanonicalConnectionsAnswer, retrieveCanonicalEvidence } from "./canonical-bible.ts";\n',
)

replace_once(
    assistant,
    '  destinationInstruction?: string | null;\n};',
    '  destinationInstruction?: string | null;\n  memoryBibleReference?: string | null;\n};',
)

replace_once(
    assistant,
    '  return null;\n}\n\nfunction bibleText(reference: BibleReference, wholeChapter = false) {',
    '''  return null;\n}\n\nfunction shouldUseMemoryBibleReference(\n  message: string,\n  route: AtisAssistantRoute,\n  reference: BibleReference,\n) {\n  if (["connections", "exegetai", "chapter_summary", "word_meaning", "timeline"].includes(route)) return true;\n  if (route !== "ask_bible") return false;\n\n  const q = normalize(message);\n  if (/\\b(esse|essa|deste|dessa|desse|texto|passagem|trecho|capitulo|versiculo|explique|explica|significa|contexto)\\b/.test(q)) return true;\n\n  const ignored = new Set(["qual", "quais", "porque", "como", "onde", "quando", "levou", "deus", "senhor", "biblia", "biblico", "texto", "passagem"]);\n  const terms = q.split(" ").filter((token) => token.length >= 4 && !ignored.has(token));\n  if (!terms.length) return false;\n  const source = ` ${normalize(bibleText(reference, !reference.verseStart).text)} `;\n  return terms.some((term) => source.includes(` ${term} `));\n}\n\nfunction bibleText(reference: BibleReference, wholeChapter = false) {''',
)

replace_once(
    assistant,
    '  destinationInstruction: string | null = null,\n) {',
    '  destinationInstruction: string | null = null,\n  canonicalGrounding: string | null = null,\n) {',
)

replace_once(
    assistant,
    '${continuityRule}${modeRule}${destinationRule}${devotionalRule}${context}`;',
    '${continuityRule}${modeRule}${destinationRule}${devotionalRule}${context}${canonicalGrounding ?? ""}`;',
)

replace_once(
    assistant,
    '''    const directReference = parseBibleReference(input, bible);\n    const followupReference = directReference ? null : parseBibleFollowupReference(input, bible, history);\n    reference = directReference ?? followupReference;''',
    '''    const directReference = parseBibleReference(input, bible);\n    const followupReference = directReference ? null : parseBibleFollowupReference(input, bible, history);\n    const rememberedReference = !directReference && !followupReference && firstString(options.memoryBibleReference)\n      ? parseBibleReference(firstString(options.memoryBibleReference)!, bible)\n      : null;\n    const contextualRememberedReference = rememberedReference && shouldUseMemoryBibleReference(input, route, rememberedReference)\n      ? rememberedReference\n      : null;\n    reference = directReference ?? followupReference ?? contextualRememberedReference;''',
)

replace_once(
    assistant,
    '''  } else if (reference) {\n    const wholeChapter = route === "chapter_summary" || route === "exegetai" || route === "timeline";\n    context = bibleText(reference, wholeChapter && !reference.verseStart);\n  }\n  const text = await generateSpecialistAnswer(supabase, route, config, prompts, input, context, bible, history, options.conversationMode ?? "normal", firstString(options.destinationInstruction));\n  return { text, route, source: "ai", reference: context?.label ?? null };''',
    '''  } else if (reference) {\n    const wholeChapter = route === "chapter_summary" || route === "exegetai" || route === "timeline";\n    context = bibleText(reference, wholeChapter && !reference.verseStart);\n  }\n\n  const canonicalEvidence = context && bible && ["connections", "ask_bible", "exegetai"].includes(route)\n    ? retrieveCanonicalEvidence(context.label, context.text, input, bible, route === "connections" ? 12 : 6)\n    : [];\n\n  if (route === "connections") {\n    if (!context || !bible) {\n      return {\n        text: "Para buscar conexões bíblicas com segurança, preciso saber qual passagem está em estudo. Envie a referência, por exemplo: *Gênesis 4:1-10*.",\n        route,\n        source: "app",\n      };\n    }\n    const answer = await generateCanonicalConnectionsAnswer({\n      systemPrompt: config.systemPrompt,\n      sourceLabel: context.label,\n      sourceText: context.text,\n      userMessage: input,\n      evidence: canonicalEvidence,\n      conversationMode: options.conversationMode ?? "normal",\n    });\n    return { text: clampText(answer), route, source: "ai", reference: context.label };\n  }\n\n  const grounding = canonicalEvidenceContext(canonicalEvidence, route === "exegetai" ? 8 : 6);\n  const text = await generateSpecialistAnswer(\n    supabase, route, config, prompts, input, context, bible, history,\n    options.conversationMode ?? "normal", firstString(options.destinationInstruction), grounding || null,\n  );\n  return { text, route, source: "ai", reference: context?.label ?? null };''',
)

runtime = 'supabase/functions/_shared/atis/conversation-runtime.ts'
replace_once(
    runtime,
    '    cooldown_seconds: 4,\n    max_replies_per_10m: 8,',
    '    cooldown_seconds: type === "group" ? 4 : 1,\n    max_replies_per_10m: type === "group" ? 8 : 24,',
)

webhook = 'supabase/functions/atis-webhook/index.ts'
replace_once(
    webhook,
    '''      const budget = await consumeReplyBudget(supabase, instance.id, remoteJid, profile);\n      if (budget?.allowed !== true) {\n        await supabase.from("atis_inbound_messages").update({ status: "ignored", processed_at: new Date().toISOString(), metadata: { policy: String(budget?.reason ?? "rate_limit").toLowerCase(), retry_after_seconds: budget?.retry_after_seconds ?? null, destination_type: destinationType, destination_id: destinationId } }).eq("id", inbound.id);\n        counts.ignored++;\n        continue;\n      }''',
    '''      const budget = await consumeReplyBudget(supabase, instance.id, remoteJid, profile);\n      if (budget?.allowed !== true) {\n        const budgetReason = String(budget?.reason ?? "RATE_LIMIT").toUpperCase();\n        const retryAfter = Math.max(1, Number(budget?.retry_after_seconds ?? 1));\n        if (!isGroup && budgetReason === "RATE_LIMIT") {\n          const waitText = retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)} min` : `${retryAfter} s`;\n          const notice = `⏳ Esta conversa atingiu temporariamente o limite de proteção do ATIS. Não perdi o contexto. Tente novamente em cerca de ${waitText}.`;\n          try {\n            if (!evolution) { const config = getEvolutionConfigFromEnv(); evolution = new EvolutionProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey }); }\n            const sent = await evolution.sendText(providerInstanceName, directProviderTarget(remoteJid), notice);\n            await supabase.from("atis_inbound_messages").update({\n              status: "replied", response_text: notice, processed_at: new Date().toISOString(), error: null,\n              metadata: { policy: "rate_limit", retry_after_seconds: retryAfter, destination_type: destinationType, destination_id: destinationId, provider_response_message_id: sent.providerMessageId ?? null },\n            }).eq("id", inbound.id);\n            counts.replied++;\n          } catch (rateLimitDeliveryError) {\n            console.error("[atis-webhook] rate-limit notice delivery failed", rateLimitDeliveryError instanceof Error ? rateLimitDeliveryError.message : rateLimitDeliveryError);\n            await supabase.from("atis_inbound_messages").update({ status: "ignored", processed_at: new Date().toISOString(), metadata: { policy: "rate_limit", retry_after_seconds: retryAfter, destination_type: destinationType, destination_id: destinationId } }).eq("id", inbound.id);\n            counts.ignored++;\n          }\n          continue;\n        }\n        await supabase.from("atis_inbound_messages").update({ status: "ignored", processed_at: new Date().toISOString(), metadata: { policy: budgetReason.toLowerCase(), retry_after_seconds: retryAfter, destination_type: destinationType, destination_id: destinationId } }).eq("id", inbound.id);\n        counts.ignored++;\n        continue;\n      }''',
)

replace_once(
    webhook,
    '''        destinationInstruction: styleInstruction || null,\n      });''',
    '''        destinationInstruction: styleInstruction || null,\n        memoryBibleReference: structuredContext.reference,\n      });''',
)

provider = 'supabase/functions/_shared/atis/evolution-provider.ts'
replace_once(
    provider,
    '''  async sendText(instanceName: string, target: string, text: string, delay = 0) {\n    const finalText = target.endsWith("@g.us") ? await enrichGroupReply(text) : text;\n    const body: any = await this.request(`/message/sendText/${encodeURIComponent(instanceName)}`, {\n      method: "POST",\n      body: JSON.stringify({\n        number: target,\n        text: finalText,\n        ...(delay > 0 ? { delay } : {}),\n      }),\n    }, 30000);''',
    '''  async sendText(instanceName: string, target: string, text: string, delay = 0) {\n    const finalText = target.endsWith("@g.us") ? await enrichGroupReply(text) : text;\n    const send = () => this.request(`/message/sendText/${encodeURIComponent(instanceName)}`, {\n      method: "POST",\n      body: JSON.stringify({\n        number: target,\n        text: finalText,\n        ...(delay > 0 ? { delay } : {}),\n      }),\n    }, 30000);\n\n    let body: any;\n    try {\n      body = await send();\n    } catch (error) {\n      const retryable = error instanceof EvolutionProviderError && (\n        [400, 408, 409, 425, 429, 502, 503, 504].includes(error.status) || error.status >= 500\n      );\n      if (!retryable) throw error;\n      console.warn("[atis-evolution] retrying text delivery once", error.status, error.code);\n      await new Promise((resolve) => setTimeout(resolve, error.status === 429 ? 1200 : 650));\n      body = await send();\n    }''',
)

print('v45 patch applied')
