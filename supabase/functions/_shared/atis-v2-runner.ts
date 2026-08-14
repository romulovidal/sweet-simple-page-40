import { supabaseAdmin, brNow } from "./atis-v2-helpers.ts";
import { AtisEngine } from "./atis-automation_engine.ts";

/**
 * Runner Centralizado para Automações Agendadas
 */
export async function runAtisAutomations(workerName: string) {
  const { dateKey, timeKey, weekday } = brNow();
  const engine = new AtisEngine(supabaseAdmin, workerName);

  if (!(await engine.isGlobalEnabled())) {
    console.log("[AtisRunner] Global disabled.");
    return { skipped: true, reason: "global_disabled" };
  }

  // Busca configurações habilitadas para hoje
  const { data: configs, error } = await supabaseAdmin
    .from("atis_notification_configs")
    .select("id, name, send_times, days_of_week")
    .eq("enabled", true)
    .eq("automation_mode", "automatic")
    .contains("days_of_week", [weekday]);

  if (error) {
    console.error("[AtisRunner] Error fetching configs:", error);
    return { error };
  }

  console.log(`[AtisRunner] Found ${configs?.length ?? 0} potential configs for today.`);

  const results = [];
  for (const config of configs ?? []) {
    // Verifica se é hora de enviar (dentro de uma janela de 5 min)
    const matchesTime = config.send_times.some((t: string) => {
      const [h, m] = t.split(":");
      const [nowH, nowM] = timeKey.split(":");
      const targetMin = parseInt(h) * 60 + parseInt(m);
      const nowMin = parseInt(nowH) * 60 + parseInt(nowM);
      return nowMin >= targetMin && nowMin < targetMin + 10;
    });

    if (matchesTime) {
      console.log(`[AtisRunner] Running config: ${config.name} (${config.id})`);
      await engine.runConfig(config.id);
      results.push({ id: config.id, name: config.name, status: "triggered" });
    }
  }

  return { ok: true, processed: results };
}
