import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { aiChatFetch } from '../_shared/ai-fetch.ts'
import { evolutionSendText, evolutionSendPoll } from '../_shared/atis-evolution.ts'
import { safeSend } from '../_shared/atis-antiban.ts'
import { normalizeRecipient } from '../_shared/atis-recipient-resolver.ts'

const WEBHOOK_SECRET = Deno.env.get('ATIS_WEBHOOK_SECRET') ?? ''

// Funções utilitárias de Opt-out
function isOptOutMessage(text: string): boolean {
  const norm = text.trim().toLowerCase().replace(/[.!?]+$/, '')
  const OPT_OUT = ['sair', 'cancelar', 'parar', 'stop', 'descadastrar', 'unsubscribe', 'nao quero mais', 'não quero mais', 'remover me', 'remover-me']
  return OPT_OUT.includes(norm)
}

function isOptInMessage(text: string): boolean {
  const norm = text.trim().toLowerCase().replace(/[.!?]+$/, '')
  const OPT_IN = ['voltar', 'quero receber', 'ativar', 'start', 'rejoin']
  return OPT_IN.includes(norm)
}

/**
 * ATIS Webhook V2 - Reativo e Seguro
 * Processa mensagens recebidas, comandos e alertas de crise.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('ok')

  const providedSecret = req.headers.get('x-webhook-secret') ?? ''
  const secretOk = !WEBHOOK_SECRET || providedSecret === WEBHOOK_SECRET

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const payload = await req.json().catch(() => ({} as any))

  try {
    const event = payload?.event ?? payload?.type ?? 'unknown'
    console.log(`[AtisWebhook] Event received: ${event}`)

    // Sincronização de Estado de Conexão
    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const state = payload?.data?.state ?? payload?.state
      if (state) {
        console.log(`[AtisWebhook] Updating connection state to: ${state}`)
        await admin.from('atis_config').update({ 
          last_connection_state: state,
          updated_at: new Date().toISOString() 
        }).eq('id', 1)
      }
    }

    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
      const data = payload?.data ?? payload
      const messages = Array.isArray(data?.messages) ? data.messages : (data ? [data] : [])

      for (const msg of messages) {
        if (msg?.key?.fromMe) continue
        const jid: string = msg?.key?.remoteJid ?? ''
        const isGroup = jid.endsWith('@g.us')
        const text = (msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || '').trim()
        
        if (!jid || !text) continue

        // Log da mensagem recebida
        await admin.from('atis_messages_log').insert({
          direction: 'inbound',
          wa_from: jid,
          wa_group_id: isGroup ? jid : null,
          body: text,
          status: 'received',
          raw: { isGroup, secretOk, pushName: msg.pushName },
        })

        if (!secretOk) continue

        const { data: cfg } = await admin.from('atis_config').select('*').eq('id', 1).maybeSingle()
        if (!cfg?.active) continue

        // Lógica de Opt-out
        if (!isGroup && isOptOutMessage(text)) {
          const { key } = normalizeRecipient(jid)
          const phoneOnly = key.split('@')[0].replace(/\D/g, '')
          
          await Promise.all([
            admin.from('atis_contacts').update({ opt_in: false }).eq('phone', phoneOnly),
            admin.from('profiles').update({ whatsapp_opt_in: false }).eq('phone', phoneOnly),
            admin.from('atis_optouts').upsert({ phone: phoneOnly, source: 'whatsapp', reason: text }, { onConflict: 'phone' })
          ])
          
          const reply = '✅ Você foi removido da lista de envios automáticos. Se mudar de ideia, responda VOLTAR. 💜'
          await safeSend(admin, jid, reply, { kind: 'reply' })
          continue
        }

        // Lógica de Opt-in
        if (!isGroup && isOptInMessage(text)) {
          const { key } = normalizeRecipient(jid)
          const phoneOnly = key.split('@')[0].replace(/\D/g, '')
          
          await Promise.all([
            admin.from('atis_contacts').update({ opt_in: true }).eq('phone', phoneOnly),
            admin.from('profiles').update({ whatsapp_opt_in: true }).eq('phone', phoneOnly),
            admin.from('atis_optouts').delete().eq('phone', phoneOnly)
          ])
          
          const reply = '💜 Que bom te ter de volta! Você voltou a receber as mensagens do Atis.'
          await safeSend(admin, jid, reply, { kind: 'reply' })
          continue
        }
      }
    }
  } catch (e) {
    console.error('[AtisWebhookV2] Error:', e)
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})

