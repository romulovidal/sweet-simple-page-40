import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AtisEngine } from '../_shared/atis-automation-engine.ts';
import { brNow } from '../_shared/atis-v2-helpers.ts';
import { aiGenerateText } from '../_shared/ai-fetch.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const engine = new AtisEngine(admin, 'atis-daily-verse-dm');
  const { dateKey } = brNow();

  const { data: config } = await admin
    .from('atis_notification_configs')
    .select('id, enabled')
    .eq('source_key', 'system:daily_verse')
    .maybeSingle();

  if (!config?.enabled) return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });

  const { data: qv } = await admin
    .from('daily_verse_queue')
    .select('verse_text, verse_ref')
    .eq('scheduled_date', dateKey)
    .maybeSingle();

  if (!qv) return new Response(JSON.stringify({ skipped: true, reason: 'no-verse' }), { headers: corsHeaders });

  // O motor V2 resolve targets (perfis/contatos) e envia
  await engine.runConfig(config.id, `${dateKey}Tdailyverse`);

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
