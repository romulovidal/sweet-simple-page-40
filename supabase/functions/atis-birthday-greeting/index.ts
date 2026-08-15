import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { aiGenerateText, hasAnyAiKey } from '../_shared/ai-fetch.ts'
import { AtisEngine } from '../_shared/atis-automation-engine.ts'
import { brNow } from '../_shared/atis-v2-helpers.ts'

async function generateGreeting(names: string[], template: string | null, period: string): Promise<string> {
  const greeting = period === 'manhã' ? 'Bom dia' : period === 'tarde' ? 'Boa tarde' : period === 'noite' ? 'Boa noite' : 'Paz do Senhor'
  const list = names.map((n) => `• ${n}`).join('\n')

  if (template && template.trim()) {
    return template
      .replaceAll('{nomes}', names.join(', '))
      .replaceAll('{lista}', list)
      .replaceAll('{saudacao}', greeting)
  }
  
  if (!hasAnyAiKey()) {
    return `🎉✨ ${greeting}, amada família Atalaias de Betel! ✨🎉\n\nHoje o céu se alegra e a nossa igreja também, porque Deus nos presenteou com mais um ano de vida de pessoas muito especiais:\n\n${list}\n\n"O Senhor te abençoe e te guarde..." (Números 6:24)\n\nNós te amamos! 🎂🙏🕊️\n\n— Igreja Atalaias de Betel`
  }

  const systemPrompt = `Você é Atis, assistente da Igreja Atalaias de Betel. Escreva uma mensagem de aniversário celebrativa e pastoral para o GRUPO. Tom caloroso. Mencionando a lista de nomes: ${list}. Máximo 1400 caracteres.`
  return await aiGenerateText({ system: systemPrompt, user: 'Gere a mensagem do grupo.', temperature: 1.1 })
}

async function generatePersonalGreeting(name: string, period: string): Promise<string> {
  const saud = period === 'manhã' ? 'Bom dia' : period === 'tarde' ? 'Boa tarde' : period === 'noite' ? 'Boa noite' : 'Paz do Senhor'
  const system = `Você é Atis. Escreva uma mensagem pessoal de aniversário para ${name}. Tom próximo e bíblico. Máximo 800 caracteres.`
  return await aiGenerateText({ system, user: 'Gere a mensagem pessoal.', temperature: 1.1 })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const engine = new AtisEngine(admin, 'atis-birthday-greeting')
  const { mmdd, dateKey, period } = brNow()

  const { data: config } = await admin
    .from('atis_notification_configs')
    .select('id, enabled, message_template')
    .eq('source_key', 'legacy:atis_birthday_greeting')
    .maybeSingle()

  if (!config?.enabled) return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), { headers: corsHeaders })

  const { data: bdays } = await admin.from('atis_birthdays').select('name, birth_date, active, phone')
  const todays = (bdays ?? []).filter((b: any) => b.active !== false && String(b.birth_date ?? '').slice(5, 10) === mmdd)
  
  if (!todays.length) return new Response(JSON.stringify({ ok: true, reason: 'no-birthdays' }), { headers: corsHeaders })

  const names = todays.map((b: any) => b.name)
  const groupText = await generateGreeting(names, config.message_template, period)

  // Envia para os targets configurados (Geralmente grupos)
  await engine.runConfig(config.id, `${dateKey}Tbirthday`);

  // Envio de DMs individuais
  for (const b of todays) {
    if (b.phone) {
      const personalText = await generatePersonalGreeting(b.name, period);
      await engine.processRecipient(config, {
        recipientType: 'individual',
        recipientKey: b.phone.includes('@') ? b.phone : `${b.phone.replace(/\D/g, '')}@s.whatsapp.net`
      }, `${dateKey}TbirthdayDM:${b.phone}`, personalText);
    }
  }

  return new Response(JSON.stringify({ ok: true, todays: todays.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
