import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AtisEngine } from '../_shared/atis-automation-engine.ts';
import { brNow } from '../_shared/atis-v2-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const engine = new AtisEngine(admin, 'smart-notifications');
  const { dateKey } = brNow();

  const { data: config } = await admin
    .from('atis_notification_configs')
    .select('id, enabled')
    .eq('source_key', 'system:smart_notifications')
    .maybeSingle();

  if (!config?.enabled) return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });

  // Smart Notifications geralmente são push notifications, mas o motor V2
  // pode ser usado para espelhar avisos importantes no WhatsApp se configurado.
  await engine.runConfig(config.id, `${dateKey}Tsmart`);

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
