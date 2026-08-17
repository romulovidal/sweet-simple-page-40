export type DestinationInsightRow = {
  status?: string | null;
  assistant_route?: string | null;
  metadata?: Record<string, any> | null;
  received_at?: string | null;
};

export type DestinationInsightType = "contact" | "individual" | "group";

const TZ = "America/Fortaleza";

function localParts(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
  };
}

function sortedCounts(map: Map<string, number>, limit = 6) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export function buildDestinationInsights(rows: DestinationInsightRow[], destinationType: DestinationInsightType) {
  const replied = rows.filter((row) => row.status === "replied");
  const failed = rows.filter((row) => row.status === "failed");
  const ignored = rows.filter((row) => row.status === "ignored");
  const degraded = replied.filter((row) => row.metadata?.degraded === true);
  const attempted = replied.length + failed.length;

  const routeCounts = new Map<string, number>();
  const contextCounts = new Map<string, number>();
  const days = new Set<string>();
  const hourCounts = new Map<string, number>();
  let firstSeen: string | null = null;
  let lastSeen: string | null = null;

  for (const row of rows) {
    if (row.assistant_route) routeCounts.set(row.assistant_route, (routeCounts.get(row.assistant_route) ?? 0) + 1);
    const context = typeof row.metadata?.context_source === "string" ? row.metadata.context_source : null;
    if (context) contextCounts.set(context, (contextCounts.get(context) ?? 0) + 1);
    if (!row.received_at) continue;
    const parts = localParts(row.received_at);
    if (parts) {
      days.add(parts.date);
      const hour = String(parts.hour).padStart(2, "0");
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }
    if (!firstSeen || row.received_at < firstSeen) firstSeen = row.received_at;
    if (!lastSeen || row.received_at > lastSeen) lastSeen = row.received_at;
  }

  const routes = sortedCounts(routeCounts);
  const contexts = sortedCounts(contextCounts, 4);
  const peakHour = sortedCounts(hourCounts, 1)[0] ?? null;
  const memoryHits = contextCounts.get("memory") ?? 0;
  const ministryMemoryHits = rows.filter((row) => row.metadata?.context_memory_reason === "ministry_memory").length;
  const continuityHits = rows.filter((row) => row.metadata?.context_source === "memory" || row.metadata?.context_memory_reason === "ministry_memory").length;
  const recommendations: string[] = [];

  if (failed.length > 0) recommendations.push(`Há ${failed.length} falha(s) técnica(s) no período; vale revisar o Histórico e inteligência operacional.`);
  if (degraded.length > 0) recommendations.push(`Houve ${degraded.length} resposta(s) degradada(s); a conversa recebeu fallback seguro, mas a causa continua registrada para revisão.`);
  if (continuityHits > 0) recommendations.push(`O contexto estruturado foi reaproveitado em ${continuityHits} interação(ões), sinal de continuidade real da conversa.`);

  const studyRoutes = new Set(["exegetai", "chapter_summary", "connections", "timeline", "word_meaning"]);
  const studyCount = routes.filter((row) => studyRoutes.has(row.key)).reduce((sum, row) => sum + row.count, 0);
  if (studyCount >= 3 && studyCount >= Math.max(1, Math.floor(replied.length * 0.35))) {
    recommendations.push("Há uso recorrente de recursos de estudo; o modo Estudo pode ser uma boa configuração manual para este destino.");
  }
  if (destinationType === "group" && rows.length >= 30) {
    recommendations.push("Este grupo tem atividade relevante com o ATIS; mantenha cooldown e limite de respostas adequados para evitar excesso de mensagens.");
  }

  return {
    period_days: 30,
    total: rows.length,
    replied: replied.length,
    failed: failed.length,
    ignored: ignored.length,
    degraded: degraded.length,
    reply_success_rate: attempted > 0 ? Math.round((replied.length / attempted) * 1000) / 10 : null,
    active_days: days.size,
    first_seen_at: firstSeen,
    last_seen_at: lastSeen,
    memory_hits: memoryHits,
    ministry_memory_hits: ministryMemoryHits,
    continuity_hits: continuityHits,
    top_routes: routes.map(({ key, count }) => ({ route: key, count })),
    context_sources: contexts.map(({ key, count }) => ({ source: key, count })),
    peak_hour: peakHour ? `${peakHour.key}:00` : null,
    peak_hour_count: peakHour?.count ?? 0,
    recommendations,
  };
}
