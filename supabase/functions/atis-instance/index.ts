import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const EVO_URL = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '')
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? ''
const INSTANCE = 'atis'

async function evo(path: string, init: RequestInit = {}) {
  console.log(`[EVO] Requesting: ${path}`);
  if (!EVO_URL || !EVO_KEY) {
    console.error("[EVO] Configuration missing: URL or KEY is empty.");
    return { ok: false, status: 503, json: { error: 'evolution-not-configured', details: { url: !!EVO_URL, key: !!EVO_KEY } } }
  }
  
  const url = `${EVO_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: EVO_KEY,
        ...(init.headers ?? {}),
      },
    })
    const text = await res.text()
    console.log(`[EVO] Response ${res.status} for ${path}: ${text.substring(0, 200)}`);
    
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
    return { ok: res.ok, status: res.status, json }
  } catch (err) {
    console.error(`[EVO] Fetch error for ${url}:`, err);
    return { ok: false, status: 500, json: { error: 'fetch-failed', message: err.message } }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'NO_AUTH' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'INVALID_TOKEN' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Role check: supports hierarchy via public.has_role (security definer)
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden', code: 'NOT_ADMIN' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const action = body.action ?? 'status'
    
    // Webhook URL in current project
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const functionsUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
    const webhookUrl = `${functionsUrl}/atis-webhook`;
    const webhookSecret = Deno.env.get('ATIS_WEBHOOK_SECRET') ?? ''

    console.log(`[atis-instance] Action: ${action} for user: ${user.email}`);

    if (action === 'create') {
      const payload = {
        instanceName: INSTANCE,
        token: '', // Evolution API generated
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: webhookUrl,
          byEvents: false,
          base64: false,
          headers: { 'x-webhook-secret': webhookSecret },
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      };
      
      console.log(`[atis-instance] Creating instance with payload:`, JSON.stringify(payload));
      
      const created = await evo(`/instance/create`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      
      // If 409, it already exists, that's fine
      if (!created.ok && created.status !== 409) {
        return new Response(JSON.stringify({ 
          success: false, 
          code: 'EVO_CREATE_ERROR', 
          status: created.status, 
          details: created.json 
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Fetch QR
      const conn = await evo(`/instance/connect/${INSTANCE}`)
      return new Response(JSON.stringify({
        success: true,
        created: created.ok,
        qr: conn.json?.base64 ?? conn.json?.qrcode?.base64 ?? null,
        code: conn.json?.code ?? conn.json?.qrcode?.code ?? null,
        webhookUrl,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'qr') {
      const conn = await evo(`/instance/connect/${INSTANCE}`)
      return new Response(JSON.stringify({
        success: true,
        qr: conn.json?.base64 ?? conn.json?.qrcode?.base64 ?? null,
        code: conn.json?.code ?? conn.json?.qrcode?.code ?? null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'logout') {
      const out = await evo(`/instance/logout/${INSTANCE}`, { method: 'DELETE' })
      return new Response(JSON.stringify({ success: out.ok, details: out.json }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const out = await evo(`/instance/delete/${INSTANCE}`, { method: 'DELETE' })
      return new Response(JSON.stringify({ success: out.ok, details: out.json }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'listGroups') {
      const out = await evo(`/group/fetchAllGroups/${INSTANCE}?getParticipants=false`)
      const raw = out.json
      const arr: any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.groups) ? raw.groups : [])
      const groups = arr.map((g: any) => ({
        wa_group_id: g?.id ?? g?.remoteJid ?? g?.groupJid ?? null,
        name: g?.subject ?? g?.name ?? g?.groupMetadata?.subject ?? '(sem nome)',
        size: g?.size ?? g?.participantsCount ?? g?.groupMetadata?.size ?? null,
      })).filter((g: any) => g.wa_group_id && String(g.wa_group_id).endsWith('@g.us'))
      
      return new Response(JSON.stringify({ success: out.ok, groups, count: groups.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'status') {
      const st = await evo(`/instance/connectionState/${INSTANCE}`)
      return new Response(JSON.stringify({
        success: true,
        state: st.json?.instance?.state ?? st.json?.state ?? 'disconnected',
        exists: st.ok || st.status === 409,
        webhookUrl,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(`[atis-instance] Critical error:`, e);
    return new Response(JSON.stringify({ 
      success: false, 
      error: String(e?.message ?? e) 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
