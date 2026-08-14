import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AtisEngine } from '../_shared/atis-automation-engine.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const engine = new AtisEngine(admin, 'atis-welcome-runner');

  const { data: config } = await admin
    .from('atis_notification_configs')
    .select('id, enabled')
    .eq('source_key', 'system:welcome')
    .maybeSingle();

  if (!config?.enabled) return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });

  // Busca novos usuários/contatos ainda não notificados
  const { data: profs } = await admin.from('profiles').select('user_id, phone').is('atis_welcomed_at', null).not('phone', 'is', null);
  const { data: contacts } = await admin.from('atis_contacts').select('id, phone').is('welcomed_at', null);

  const targets = [...(profs || []), ...(contacts || [])];
  
  for (const t of targets) {
    const res = await engine.processRecipient(config, {
      recipientType: 'individual',
      recipientKey: t.phone.includes('@') ? t.phone : `${t.phone.replace(/\D/g, '')}@s.whatsapp.net`
    }, `welcome:${t.user_id || t.id}`);
    
    if (res.ok) {
      const now = new Date().toISOString();
      if ((t as any).user_id) {
        await admin.from('profiles').update({ atis_welcomed_at: now }).eq('user_id', (t as any).user_id);
      } else {
        await admin.from('atis_contacts').update({ welcomed_at: now }).eq('id', t.id);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: targets.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
