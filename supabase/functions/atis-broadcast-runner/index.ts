import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AtisEngine } from '../_shared/atis-automation-engine.ts';
import { brNow } from '../_shared/atis-v2-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const engine = new AtisEngine(admin, 'atis-broadcast-runner');

  const { data: bcasts } = await admin
    .from('atis_broadcasts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString());

  for (const b of bcasts || []) {
    // Orquestra via V2 para aproveitar segurança e logs
    // Na FASE 2, o motor cuidará da expansão de targets de broadcast
    await engine.runConfig(null, b.id); // TODO: Adaptar para orquestração manual
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
