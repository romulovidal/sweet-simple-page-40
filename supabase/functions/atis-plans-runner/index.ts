import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AtisEngine } from '../_shared/atis-automation-engine.ts';
import { brNow } from '../_shared/atis-v2-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const engine = new AtisEngine(admin, 'atis-plans-runner');
  const { dateKey, timeKey } = brNow();

  const { data: config } = await admin
    .from('atis_notification_configs')
    .select('id, enabled')
    .eq('source_key', 'system:plans')
    .maybeSingle();

  if (!config?.enabled) return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });

  const { data: subs } = await admin
    .from('atis_plan_subscribers')
    .select('*')
    .eq('active', true)
    .eq('send_time', timeKey)
    .neq('last_sent_date', dateKey);

  if (!subs?.length) return new Response(JSON.stringify({ ok: true, reason: 'no-due-subs' }), { headers: corsHeaders });

  for (const sub of subs) {
    // O motor V2 cuida do pacing, claim e envio
    const res = await engine.processRecipient(config, {
      recipientType: 'individual',
      recipientKey: sub.phone.includes('@') ? sub.phone : `${sub.phone.replace(/\D/g, '')}@s.whatsapp.net`
    }, `${dateKey}Tplan:${sub.id}`);

    if (res.ok) {
      await admin.from('atis_plan_subscribers').update({
        current_day: sub.current_day + 1,
        last_sent_date: dateKey
      }).eq('id', sub.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: subs.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
