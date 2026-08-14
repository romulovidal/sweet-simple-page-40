import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AtisEngine } from '../_shared/atis-automation-engine.ts';
import { brNow } from '../_shared/atis-v2-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const engine = new AtisEngine(admin, 'atis-series-runner');
  const { dateKey, timeKey } = brNow();

  const { data: config } = await admin
    .from('atis_notification_configs')
    .select('id, enabled')
    .eq('source_key', 'system:series')
    .maybeSingle();

  if (!config?.enabled) return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });

  // Séries para indivíduos
  const { data: subs } = await admin
    .from('atis_series_subscribers')
    .select('*, atis_series(send_time)')
    .eq('active', true)
    .neq('last_sent_date', dateKey);

  for (const sub of subs || []) {
    const seriesTime = (sub.atis_series as any)?.send_time || '07:00';
    if (seriesTime !== timeKey) continue;

    await engine.processRecipient(config, {
      recipientType: 'individual',
      recipientKey: sub.phone.includes('@') ? sub.phone : `${sub.phone.replace(/\D/g, '')}@s.whatsapp.net`
    }, `${dateKey}Tseries:${sub.id}`);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
