import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { runAtisAutomations } from "../_shared/atis-v2-runner.ts";

/**
 * Ponto de entrada unificado para o Cron Job
 * Chama o runner V2 que orquestra as automações agendadas.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': '*' } })
  
  console.log("[AtisSend] Execution started.");
  const body = await req.json().catch(() => ({}));
  const configId = body?.config_id;

  if (configId) {
    console.log(`[AtisSend] Manual trigger for config: ${configId}`);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const engine = new AtisEngine(admin, 'manual-trigger');
    const result = await engine.runConfig(configId, `manual-${Date.now()}`);
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' } });
  }

  const result = await runAtisAutomations("cron-atis-send");
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' } });
});
