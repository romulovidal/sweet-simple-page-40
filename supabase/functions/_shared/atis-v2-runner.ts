import { supabaseAdmin, brNow } from "./atis-v2-helpers.ts";
import { AtisEngine } from "./atis-automation-engine.ts";

/**
 * Runner Centralizado para Automações Agendadas
 */
export async function runAtisAutomations(workerName: string) {
  const { dateKey, timeKey, weekday } = brNow();
  console.log("[AtisRunner] Initializing engine...");
  const engine = new AtisEngine(supabaseAdmin, workerName);

  // Debug log entry
  await supabaseAdmin.from("atis_automation_logs").upsert({
    config_id: "a9db9d6f-e1bb-47c2-921f-6e5b269a05ce",
    recipient_type: "individual",
    recipient_key: "debug",
    occurrence_key: `debug-${new Date().toISOString()}`,
    idempotency_key: `debug-${workerName}-${new Date().toISOString().substring(0, 16)}`,
    status: "skipped",
    last_error: `Worker ${workerName} tick at ${timeKey} (weekday ${weekday})`
  }, { onConflict: "idempotency_key" });

  if (!(await engine.isGlobalEnabled())) {
    console.log("[AtisRunner] Global disabled.");
    return { skipped: true, reason: "global_disabled" };
  }

  // Busca configurações habilitadas para hoje
  const { data: allConfigs, error } = await supabaseAdmin
    .from("atis_notification_configs")
    .select("id, name, send_times, days_of_week, source_key")
    .eq("enabled", true)
    .eq("automation_mode", "automatic")
    .contains("days_of_week", [weekday]);

  if (error) {
    console.error("[AtisRunner] Error fetching configs:", error);
    return { error };
  }

  const SPECIALIZED_SOURCE_KEYS = new Set([
    "system:plans",
    "system:series",
    "system:welcome",
    "system:broadcasts",
  ]);

  // Filtra configs que não são gerenciadas por runners especializados
  const configs = (allConfigs ?? []).filter(
    (c) => !c.source_key || !SPECIALIZED_SOURCE_KEYS.has(c.source_key)
  );

  console.log(`[AtisRunner] Found ${configs.length} runnable configs for today (out of ${allConfigs?.length ?? 0}).`);

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

  // FASE B: Processar retries e ocorrências pendentes (Independente de send_times)
  console.log("[AtisRunner] Checking for pending retries...");
  const { data: pendingLogs } = await supabaseAdmin
    .from("atis_automation_logs")
    .select("*, atis_notification_configs(*)")
    .in("status", ["retrying", "scheduled", "pending"])
    .lte("next_retry_at", new Date().toISOString());

  for (const log of pendingLogs ?? []) {
    const config = log.atis_notification_configs;
    if (!config || !config.enabled) continue;

    // A FASE B GLOBAL deve excluir logs pertencentes a runners especializados.
    // Isso garante que a regra de negócio completa (ex: incremento de current_day nos planos)
    // seja executada pelo runner dono da regra.
    if (config.source_key && SPECIALIZED_SOURCE_KEYS.has(config.source_key)) {
      continue;
    }

    console.log(`[AtisRunner] Processing retry for log ${log.id} (Config: ${config.name})`);
    
    const recipient = {
      recipientType: log.recipient_type,
      recipientKey: log.recipient_key
    };

    try {
      const result = await engine.processRecipient(config, recipient, log.occurrence_key);
      if (!result.ok) {
        console.warn(`[AtisRunner] Engine skipped/failed log ${log.id}:`, result.reason || result.error);
        results.push({ id: config.id, logId: log.id, status: "retry_failed", reason: result.reason || result.error });
      } else {
        results.push({ id: config.id, logId: log.id, status: "retry_processed" });
      }
    } catch (err) {
      console.error(`[AtisRunner] Critical error processing log ${log.id}:`, err);
      results.push({ id: config.id, logId: log.id, status: "error", error: err.message });
    }
  }

  return { ok: true, processed: results };
}
