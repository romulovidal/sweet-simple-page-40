import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { aiGenerateText, hasAnyAiKey } from '../_shared/ai-fetch.ts'
import { AtisEngine } from '../_shared/atis-automation-engine.ts'

import { brNow } from '../_shared/atis-v2-helpers.ts'


const DEFAULT_DEVOTIONAL_PROMPT =
  'Você é um pastor e escritor devocional. A partir do versículo bíblico fornecido, escreva uma REFLEXÃO DEVOCIONAL curta (2 parágrafos) que:\n' +
  '1) Conecte o texto ao cotidiano do leitor\n2) Traga uma aplicação prática e encorajadora\n' +
  'Seja caloroso e inspirador. Use markdown. Responda em português brasileiro.'

async function generateDevotional(admin: any, verseRef: string, verseText: string): Promise<string> {
  if (!hasAnyAiKey()) return ''
  let systemPrompt = DEFAULT_DEVOTIONAL_PROMPT
  try {
    const { data: promptsRow } = await admin.from('admin_settings').select('value').eq('key', 'ai_tool_prompts').maybeSingle()
    const prompts = (promptsRow?.value as Record<string, string>) || {}
    const custom = prompts?.devotional
    if (typeof custom === 'string' && custom.trim().length > 0) systemPrompt = custom
  } catch (_) { /* ignore */ }
  systemPrompt += '\n\nIMPORTANTE: NÃO repita nem cite o versículo nem a referência no início da resposta. Comece direto pela reflexão.'
  const userContent = `**${verseRef}**\n\n"${verseText}"`
  const text = await aiGenerateText({ system: systemPrompt, user: userContent, temperature: 0.9, maxTokens: 4096 })
  if (!text) return ''
  let cleaned = text.replace(new RegExp(`^\\s*\\*{1,2}${verseRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*{1,2}\\s*`, 'i'), '')
  cleaned = cleaned.replace(new RegExp(`^\\s*${verseRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '')
  cleaned = cleaned.replace(/^\s*["“][\s\S]*?["”]\s*/, '')
  return cleaned.replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/^\s*[-*]\s+/gm, '• ').trim()
}

function titleByPeriod(period: string): string {
  if (period === 'manhã') return '☀️ Bom dia! Devocional de hoje'
  if (period === 'tarde') return '🌤️ Boa tarde! Devocional de hoje'
  if (period === 'noite') return '🌙 Boa noite! Devocional de hoje'
  return '✨ Devocional de hoje'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const engine = new AtisEngine(admin, 'atis-daily-devotional')
  const { dateKey, period } = brNow()

  const { data: config } = await admin
    .from('atis_notification_configs')
    .select('id, enabled')
    .eq('source_key', 'legacy:atis_daily_devotional')
    .maybeSingle()

  if (!config?.enabled) return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), { headers: corsHeaders })

  const { data: queueVerse } = await admin.from('daily_verse_queue').select('verse_text, verse_ref').eq('scheduled_date', dateKey).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!queueVerse) return new Response(JSON.stringify({ skipped: true, reason: 'no-verse-scheduled' }), { headers: corsHeaders })

  const devotional = await generateDevotional(admin, queueVerse.verse_ref, queueVerse.verse_text)
  const text = `${titleByPeriod(period)}\n\n📖 *${queueVerse.verse_ref}*\n"${queueVerse.verse_text}"\n\n💜 *Reflexão Devocional*\n${devotional || '_Reflita hoje sobre este versículo._'}\n\n— Bíblia Atalaia`

  // O motor V2 cuida dos targets, idempotência e envio
  await engine.runConfig(config.id, `${dateKey}Tdevotional`)

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
