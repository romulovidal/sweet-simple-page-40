import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { runAtisAutomations } from "../_shared/atis-v2-runner.ts";

/**
 * Ponto de entrada unificado para o Cron Job
 * Chama o runner V2 que orquestra as automações agendadas.
 */
serve(async (req) => {
  console.log("[AtisSend] Execution started.");
  const result = await runAtisAutomations("cron-atis-send");
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
