import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AtisEngine } from '../_shared/atis-automation-engine.ts';
import { requireAdmin } from '../_shared/atis-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const isManual = body?.is_manual === true || body?.force === true;

  if (isManual) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const engine = new AtisEngine(admin, 'atis-broadcast-runner');

  const { data: bcasts } = await admin
    .from('atis_broadcasts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString());

  for (const b of bcasts || []) {
    // Orquestra via V2 para aproveitar segurança e logs
    await engine.runConfig(null, b.id);
  }

  return new Response(JSON.stringify({ ok: true, processed: bcasts?.length || 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
