import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdmin } from '../_shared/atis-auth.ts'

const EVO_URL = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '')
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? ''
const INSTANCE = 'atis'

async function evo(path: string, init: RequestInit = {}) {
  if (!EVO_URL || !EVO_KEY) {
    return { ok: false, status: 503, json: { error: 'evolution-not-configured' } }
  }
  const res = await fetch(`${EVO_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: EVO_KEY,
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
  return { ok: res.ok, status: res.status, json }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAdmin(req)
    if (auth.error) return auth.error

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const action = body.action ?? 'status'

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')!.replace('.supabase.co', '.functions.supabase.co')}/atis-webhook`
    const webhookSecret = Deno.env.get('ATIS_WEBHOOK_SECRET') ?? ''

    if (action === 'create') {
      console.log(`[atis-instance] Action: create. Checking for existing instance...`);
      // Try to create; if exists, ignore
      const created = await evo(`/instance/create`, {
        method: 'POST',
        body: JSON.stringify({
          instanceName: INSTANCE,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: {
            url: webhookUrl,
            byEvents: false,
            base64: false,
            headers: { 'x-webhook-secret': webhookSecret },
            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
          },
        }),
      })
      
      console.log(`[atis-instance] Create attempt result:`, { ok: created.ok, status: created.status });

      // Fetch QR
      const conn = await evo(`/instance/connect/${INSTANCE}`)
      const raw = conn.json;
      const state = raw?.instance?.state ?? raw?.state;
      
      console.log(`[atis-instance] Current connection status after create attempt:`, state);

      return new Response(JSON.stringify({
        created: created.ok,
        createdStatus: created.status,
        state: state ?? 'unknown',
        qr: conn.json?.base64 ?? conn.json?.qrcode?.base64 ?? null,
        code: conn.json?.code ?? conn.json?.qrcode?.code ?? null,
        raw: conn.json,
        webhookUrl,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'qr') {
      const conn = await evo(`/instance/connect/${INSTANCE}`)
      return new Response(JSON.stringify({
        qr: conn.json?.base64 ?? conn.json?.qrcode?.base64 ?? null,
        code: conn.json?.code ?? conn.json?.qrcode?.code ?? null,
        raw: conn.json,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'logout') {
      const out = await evo(`/instance/logout/${INSTANCE}`, { method: 'DELETE' })
      return new Response(JSON.stringify(out.json ?? { ok: out.ok }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const out = await evo(`/instance/delete/${INSTANCE}`, { method: 'DELETE' })
      return new Response(JSON.stringify(out.json ?? { ok: out.ok }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'listGroups') {
      // Evolution API: GET /group/fetchAllGroups/{instance}?getParticipants=false
      const out = await evo(`/group/fetchAllGroups/${INSTANCE}?getParticipants=false`)
      const raw = out.json
      const arr: any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.groups) ? raw.groups : [])
      const groups = arr.map((g: any) => ({
        wa_group_id: g?.id ?? g?.remoteJid ?? g?.groupJid ?? null,
        name: g?.subject ?? g?.name ?? g?.groupMetadata?.subject ?? '(sem nome)',
        size: g?.size ?? g?.participantsCount ?? g?.groupMetadata?.size ?? null,
        owner: g?.owner ?? null,
      })).filter((g: any) => g.wa_group_id && String(g.wa_group_id).endsWith('@g.us'))
      return new Response(JSON.stringify({ ok: out.ok, groups, count: groups.length, raw: groups.length ? undefined : raw }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'importGroups') {
      const selected: Array<{ wa_group_id: string; name: string; forward_notifications?: boolean; respond_mode?: 'mention_only' | 'always' | 'off' }> =
        Array.isArray(body.groups) ? body.groups : []
      if (!selected.length) {
        return new Response(JSON.stringify({ error: 'groups required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const rows = selected
        .filter((g) => g.wa_group_id && g.wa_group_id.endsWith('@g.us'))
        .map((g) => ({
          wa_group_id: g.wa_group_id,
          name: (g.name ?? '').trim() || g.wa_group_id,
          respond_mode: g.respond_mode ?? 'mention_only',
          active: true,
          forward_notifications: !!g.forward_notifications,
        }))
      const { error, data } = await admin.from('atis_groups').upsert(rows, { onConflict: 'wa_group_id' }).select('id')
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ok: true, imported: data?.length ?? rows.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // default: status
    console.log(`[atis-instance] Action: status. Fetching from Evolution...`);
    const st = await evo(`/instance/connectionState/${INSTANCE}`)
    const rawState = st.json?.instance?.state ?? st.json?.state ?? 'unknown';
    console.log(`[atis-instance] Evolution raw state: ${rawState}`);
    
    return new Response(JSON.stringify({
      state: rawState,
      exists: st.ok,
      raw: st.json,
      webhookUrl,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})