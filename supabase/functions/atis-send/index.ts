import { createClient } from 'npm:@supabase/supabase-js@2';
import { AtisEngine } from '../_shared/atis-automation-engine.ts';
import { runAtisAutomations } from "../_shared/atis-v2-runner.ts";
import { requireAdmin } from '../_shared/atis-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Ponto de entrada unificado para o Cron Job e Gatilho Manual
 * Chama o runner V2 que orquestra as automações agendadas.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  const body = await req.json().catch(() => ({}));
  const configId = body?.config_id;

  // Se for um gatilho manual (configId presente), exige autenticação de Admin
  if (configId) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    console.log(`[AtisSend] Manual trigger for config: ${configId} by user ${auth.userId}`);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const engine = new AtisEngine(admin, 'manual-trigger');
    const result = await engine.runConfig(configId, `manual-${Date.now()}`);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Gatilho via Cron (sem configId, geralmente chamado internamente)
  // Nota: Idealmente, validar se é a Service Role ou IP autorizado
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader.includes(serviceKey)) {
    console.warn("[AtisSend] Unauthorized cron attempt detected.");
    // return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  console.log("[AtisSend] Execution started via Global Runner.");
  const result = await runAtisAutomations("cron-atis-send");
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
