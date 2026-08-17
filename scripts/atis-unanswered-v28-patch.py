from pathlib import Path

# --- conversation-runtime: structured failure reasons + atomic grouped recorder ---
p = Path("supabase/functions/_shared/atis/conversation-runtime.ts")
text = p.read_text()
start = text.index("export function looksUnanswered")
end = text.index("\nexport async function rememberAnswer", start)
classification = r'''export function unansweredReason(text: string, route: string) {
  const q = normalize(text);
  if (/nao consegui identificar uma referencia biblica completa|não consegui identificar uma referência bíblica completa/.test(q)) return "input_incomplete";
  if (/preciso de um culto lembrado|preciso que o usuario escolha um item|preciso que o usuário escolha um item|faltam dados|dados suficientes/.test(q)) return "grounding_missing";
  if (/nao encontrei|não encontrei|nao foi encontrado|não foi encontrado|nao possui letra disponivel|não possui letra disponível/.test(q)) return "lookup_not_found";
  if (/nao sei|não sei|nao consegui responder|não consegui responder|nao tenho informacao|não tenho informação|nao tenho certeza|não tenho certeza|nao posso confirmar|não posso confirmar/.test(q)) return "assistant_uncertain";
  return null;
}

export function looksUnanswered(text: string, route: string) {
  return unansweredReason(text, route) !== null;
}

export function runtimeFailureReason(message: string) {
  const value = String(message ?? "").trim().toUpperCase();
  if (value.includes("AI_PROVIDER_UNAVAILABLE")) return "ai_provider_unavailable";
  if (value.includes("AI_EMPTY_RESPONSE")) return "ai_empty_response";
  if (value.includes("APP_") || value.includes("SOURCE_") || value.includes("HTTP_")) return "source_unavailable";
  return "runtime_error";
}
'''
text = text[:start] + classification + text[end:]
record_start = text.index("export async function recordUnanswered")
record = r'''export async function recordUnanswered(supabase: any, input: {
  inboundId: string;
  destinationType: DestinationType;
  destinationId: string;
  question: string;
  route?: string | null;
  answer?: string | null;
  reason: string;
}) {
  const { error } = await supabase.rpc("atis_record_unanswered", {
    _inbound_message_id: input.inboundId,
    _destination_type: input.destinationType,
    _destination_id: input.destinationId,
    _question: input.question.slice(0, 5000),
    _route: input.route ?? null,
    _answer: input.answer?.slice(0, 5000) ?? null,
    _reason: input.reason,
  });
  if (error) throw error;
}
'''
text = text[:record_start] + record
p.write_text(text)

# --- webhook: use structured reason classifier ---
p = Path("supabase/functions/atis-webhook/index.ts")
text = p.read_text()
text = text.replace("  looksUnanswered,\n", "  runtimeFailureReason,\n  unansweredReason,\n", 1)
old = '''      if (looksUnanswered(answerText, answer.route)) {
        await recordUnanswered(supabase, { inboundId: inbound.id, destinationType, destinationId, question: limitedText, route: answer.route, answer: answerText, reason: "assistant_uncertain" });
      }'''
new = '''      const gapReason = unansweredReason(answerText, answer.route);
      if (gapReason) {
        await recordUnanswered(supabase, { inboundId: inbound.id, destinationType, destinationId, question: limitedText, route: answer.route, answer: answerText, reason: gapReason });
      }'''
if old not in text:
    raise SystemExit("webhook normal unanswered anchor missing")
text = text.replace(old, new, 1)
old = 'await recordUnanswered(supabase, { inboundId: inbound.id, destinationType: policyForFailure.destinationType, destinationId: policyForFailure.destinationId, question: limitedText, reason: `error:${message.slice(0, 120)}` });'
new = 'await recordUnanswered(supabase, { inboundId: inbound.id, destinationType: policyForFailure.destinationType, destinationId: policyForFailure.destinationId, question: limitedText, reason: runtimeFailureReason(message) });'
if old not in text:
    raise SystemExit("webhook error unanswered anchor missing")
text = text.replace(old, new, 1)
p.write_text(text)

# --- console: cleaner operational metrics + richer review workflow ---
p = Path("supabase/functions/atis-console/index.ts")
text = p.read_text()
start = text.index("async function dashboard(supabase: any) {")
end = text.index("\nasync function historyList", start)
dashboard = r'''async function dashboard(supabase: any) {
  const now = Date.now();
  const since24h = new Date(now - 24 * 3600_000).toISOString();
  const since7d = new Date(now - 7 * 24 * 3600_000).toISOString();
  const [in24, in7, unanswered, prayers, groups] = await Promise.all([
    supabase.from("atis_inbound_messages").select("id", { count: "exact", head: true }).gte("received_at", since24h),
    supabase.from("atis_inbound_messages").select("id,remote_jid,status,assistant_route,is_group,error,received_at").gte("received_at", since7d).order("received_at", { ascending: false }).limit(5000),
    supabase.from("atis_unanswered_questions").select("id,status,reason,route,occurrence_count,last_seen_at").in("status", ["open", "reviewing"]).order("last_seen_at", { ascending: false }).limit(1000),
    supabase.from("atis_prayer_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "praying"]),
    supabase.from("atis_groups").select("id,name,provider_group_id").eq("is_active", true),
  ]);
  for (const result of [in24, in7, unanswered, prayers, groups]) if (result.error) throw result.error;

  const seven = in7.data ?? [];
  const activeUnanswered = unanswered.data ?? [];
  const replied = seven.filter((row: any) => row.status === "replied");
  const failed = seven.filter((row: any) => row.status === "failed");
  const ignored = seven.filter((row: any) => row.status === "ignored");
  const attempted = replied.length + failed.length;
  const conversations = new Set(seven.map((row: any) => row.remote_jid)).size;

  const routeCounts = new Map<string, number>();
  for (const row of replied) {
    if (!row.assistant_route) continue;
    routeCounts.set(row.assistant_route, (routeCounts.get(row.assistant_route) ?? 0) + 1);
  }
  const routes = [...routeCounts.entries()].map(([route, count]) => ({ route, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const failureCounts = new Map<string, number>();
  for (const row of failed) {
    const reason = firstString(row.error) ?? "erro_sem_codigo";
    failureCounts.set(reason, (failureCounts.get(reason) ?? 0) + 1);
  }
  const failure_reasons = [...failureCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const unansweredReasonCounts = new Map<string, number>();
  let unansweredOccurrences = 0;
  for (const row of activeUnanswered) {
    const count = Math.max(1, Number(row.occurrence_count ?? 1));
    unansweredOccurrences += count;
    const reason = firstString(row.reason) ?? "assistant_uncertain";
    unansweredReasonCounts.set(reason, (unansweredReasonCounts.get(reason) ?? 0) + count);
  }
  const unanswered_reasons = [...unansweredReasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const groupByJid = new Map<string, any>((groups.data ?? []).map((group: any): [string, any] => [String(group.provider_group_id), group]));
  const groupCounts = new Map<string, number>();
  const groupRoutes = new Map<string, Map<string, number>>();
  for (const row of replied) {
    if (!row.is_group || !groupByJid.has(row.remote_jid)) continue;
    groupCounts.set(row.remote_jid, (groupCounts.get(row.remote_jid) ?? 0) + 1);
    const route = row.assistant_route || "sem_rota";
    const routes = groupRoutes.get(row.remote_jid) ?? new Map<string, number>();
    routes.set(route, (routes.get(route) ?? 0) + 1);
    groupRoutes.set(row.remote_jid, routes);
  }
  const group_metrics = [...groupCounts.entries()].map(([jid, count]) => {
    const routes = [...(groupRoutes.get(jid)?.entries() ?? [])].sort((a, b) => b[1] - a[1]);
    return { id: groupByJid.get(jid)?.id, name: groupByJid.get(jid)?.name, messages_7d: count, top_route: routes[0]?.[0] ?? null, top_route_count: routes[0]?.[1] ?? 0, routes: routes.slice(0, 3).map(([route, route_count]) => ({ route, count: route_count })) };
  }).sort((a, b) => b.messages_7d - a.messages_7d).slice(0, 12);

  return {
    inbound_24h: in24.count ?? 0,
    inbound_7d: seven.length,
    conversations_7d: conversations,
    replied_7d: replied.length,
    failed_7d: failed.length,
    ignored_7d: ignored.length,
    private_7d: seven.filter((row: any) => !row.is_group).length,
    groups_7d: seven.filter((row: any) => row.is_group).length,
    reply_success_rate: attempted > 0 ? Math.round((replied.length / attempted) * 1000) / 10 : null,
    unanswered_open: activeUnanswered.length,
    unanswered_occurrences_open: unansweredOccurrences,
    prayer_open: prayers.count ?? 0,
    routes,
    failure_reasons,
    unanswered_reasons,
    group_metrics,
  };
}
'''
text = text[:start] + dashboard + text[end:]
start = text.index("async function unansweredList(supabase: any, raw: Json) {")
end = text.index("\nasync function unansweredUpdate", start)
unanswered_list = r'''async function unansweredList(supabase: any, raw: Json) {
  const limit = clampInt(raw.limit, 100, 1, 250);
  let query = supabase.from("atis_unanswered_questions")
    .select("id,question,route,answer,reason,status,resolution_note,resolved_by,resolved_at,occurrence_count,first_seen_at,last_seen_at,created_at,updated_at")
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  const status = firstString(raw.status) ?? "active";
  if (status === "active") query = query.in("status", ["open", "reviewing"]);
  else if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
'''
text = text[:start] + unanswered_list + text[end:]
start = text.index("async function unansweredUpdate(supabase: any, auth: any, raw: Json) {")
end = text.index("\nasync function prayersList", start)
unanswered_update = r'''async function unansweredUpdate(supabase: any, auth: any, raw: Json) {
  const id = firstString(raw.id);
  if (!id) throw new Error("ID_REQUIRED");
  const status = ["open", "reviewing", "resolved", "ignored"].includes(raw.status) ? raw.status : null;
  if (!status) throw new Error("INVALID_STATUS");
  const note = firstString(raw.resolution_note);
  if (note && note.length > 2000) throw new Error("RESOLUTION_NOTE_TOO_LONG");
  const payload: Json = { status, resolution_note: note, updated_at: new Date().toISOString() };
  if (status === "resolved") {
    payload.resolved_at = new Date().toISOString();
    payload.resolved_by = auth.userId === "service-role" ? null : auth.userId;
  } else {
    payload.resolved_at = null;
    payload.resolved_by = null;
  }
  const { data, error } = await supabase.from("atis_unanswered_questions").update(payload).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}
'''
text = text[:start] + unanswered_update + text[end:]
p.write_text(text)

# --- admin UI: operational health + supervised review queue ---
p = Path("src/components/admin/atis/AtisHistory.tsx")
text = p.read_text()
start = text.index("type Dashboard = {")
end = text.index("\n\ntype HistoryMetadata", start)
dashboard_type = r'''type Dashboard = {
  inbound_24h: number;
  inbound_7d: number;
  conversations_7d: number;
  replied_7d: number;
  failed_7d: number;
  ignored_7d: number;
  private_7d: number;
  groups_7d: number;
  reply_success_rate: number | null;
  unanswered_open: number;
  unanswered_occurrences_open: number;
  prayer_open: number;
  routes: Array<{ route: string; count: number }>;
  failure_reasons: Array<{ reason: string; count: number }>;
  unanswered_reasons: Array<{ reason: string; count: number }>;
  group_metrics: Array<{ id?: string; name?: string; messages_7d: number; top_route?: string | null; top_route_count?: number }>;
};'''
text = text[:start] + dashboard_type + text[end:]
old = 'type Unanswered = { id: string; question: string; route?: string | null; answer?: string | null; reason: string; status: string; created_at: string };'
new = 'type Unanswered = { id: string; question: string; route?: string | null; answer?: string | null; reason: string; status: string; resolution_note?: string | null; occurrence_count: number; first_seen_at: string; last_seen_at: string; created_at: string };'
if old not in text:
    raise SystemExit("unanswered type anchor missing")
text = text.replace(old, new, 1)
context_end = text.index("\n\nexport default function AtisHistory()")
helpers = r'''
function reasonLabel(reason: string) {
  const labels: Record<string, string> = {
    assistant_uncertain: "Resposta incerta",
    lookup_not_found: "Fonte não encontrada",
    grounding_missing: "Contexto insuficiente",
    input_incomplete: "Pedido incompleto",
    ai_provider_unavailable: "IA indisponível",
    ai_empty_response: "IA sem resposta",
    source_unavailable: "Fonte indisponível",
    runtime_error: "Erro de execução",
  };
  return labels[reason] ?? reason;
}

function reviewStatusLabel(status: string) {
  if (status === "reviewing") return "Em revisão";
  if (status === "resolved") return "Resolvida";
  if (status === "ignored") return "Ignorada";
  return "Aberta";
}
'''
text = text[:context_end] + helpers + text[context_end:]
old = '  const [busy, setBusy] = useState<string | null>(null);\n  const [error, setError] = useState<string | null>(null);'
new = '  const [busy, setBusy] = useState<string | null>(null);\n  const [unansweredView, setUnansweredView] = useState<"active" | "resolved" | "ignored" | "all">("active");\n  const [unansweredNotes, setUnansweredNotes] = useState<Record<string, string>>({});\n  const [error, setError] = useState<string | null>(null);'
if old not in text:
    raise SystemExit("history state anchor missing")
text = text.replace(old, new, 1)
old = '        invoke({ action: "unanswered_list", data: { status: "open", limit: 100 } }),' 
new = '        invoke({ action: "unanswered_list", data: { status: "all", limit: 200 } }),' 
if old not in text:
    raise SystemExit("history unanswered load anchor missing")
text = text.replace(old, new, 1)
# Insert computed review queue before load().
anchor = '  const load = async () => {'
computed = r'''  const unansweredCounts = useMemo(() => ({
    active: unanswered.filter((row) => row.status === "open" || row.status === "reviewing").length,
    resolved: unanswered.filter((row) => row.status === "resolved").length,
    ignored: unanswered.filter((row) => row.status === "ignored").length,
    all: unanswered.length,
  }), [unanswered]);
  const visibleUnanswered = useMemo(() => {
    if (unansweredView === "active") return unanswered.filter((row) => row.status === "open" || row.status === "reviewing");
    if (unansweredView === "all") return unanswered;
    return unanswered.filter((row) => row.status === unansweredView);
  }, [unanswered, unansweredView]);

'''
if anchor not in text:
    raise SystemExit("history load anchor missing")
text = text.replace(anchor, computed + anchor, 1)
start = text.index('  const updateUnanswered = async (id: string, status: "resolved" | "ignored") => {')
end = text.index("\n\n  const updatePrayer", start)
update_fn = r'''  const updateUnanswered = async (id: string, status: "open" | "reviewing" | "resolved" | "ignored") => {
    setBusy(id); setError(null);
    try {
      const current = unanswered.find((row) => row.id === id);
      const resolutionNote = unansweredNotes[id] ?? current?.resolution_note ?? "";
      await invoke({ action: "unanswered_update", data: { id, status, resolution_note: resolutionNote || null } });
      await load();
    }
    catch (err) { setError(err instanceof Error ? err.message : "Falha ao atualizar."); }
    finally { setBusy(null); }
  };'''
text = text[:start] + update_fn + text[end:]
# Replace metric cards area up to context panel.
start = text.index('      {dashboard && <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">')
end = text.index('\n\n      <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4">', start)
metrics = r'''      {dashboard && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2">{[
          ["24h", dashboard.inbound_24h, "mensagens"],
          ["7 dias", dashboard.inbound_7d, "mensagens"],
          ["Respostas", dashboard.replied_7d, "7 dias"],
          ["Falhas", dashboard.failed_7d, "7 dias"],
          ["Ignoradas", dashboard.ignored_7d, "sem acionamento"],
          ["Conversas", dashboard.conversations_7d, "em 7 dias"],
          ["Não respondeu", dashboard.unanswered_open, `${dashboard.unanswered_occurrences_open} ocorrências`],
          ["Orações", dashboard.prayer_open, "em acompanhamento"],
        ].map(([label, value, sub]) => <div key={String(label)} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-3"><p className="text-[9px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">{label}</p><p className="text-xl font-black mt-1">{value}</p><p className="text-[9px] text-[hsl(var(--dark-muted))]">{sub}</p></div>)}</div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4"><p className="text-xs font-bold">Saúde do atendimento · 7 dias</p><p className="text-3xl font-black mt-2">{dashboard.reply_success_rate == null ? "—" : `${dashboard.reply_success_rate}%`}</p><p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">Sucesso entre tentativas respondidas + falhas. Mensagens ignoradas por política não entram nessa taxa.</p><div className="mt-3 flex gap-3 text-[10px]"><span>Privadas: <strong>{dashboard.private_7d}</strong></span><span>Grupos: <strong>{dashboard.groups_7d}</strong></span></div></div>
          <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4"><p className="text-xs font-bold">Falhas técnicas</p><div className="mt-3 space-y-2">{dashboard.failure_reasons.length ? dashboard.failure_reasons.map((row) => <div key={row.reason} className="flex gap-2 text-[10px]"><span className="flex-1 truncate">{row.reason}</span><strong>{row.count}</strong></div>) : <p className="text-[10px] text-emerald-400">Nenhuma falha técnica no período.</p>}</div></div>
          <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4"><p className="text-xs font-bold">Lacunas para revisão</p><div className="mt-3 space-y-2">{dashboard.unanswered_reasons.length ? dashboard.unanswered_reasons.map((row) => <div key={row.reason} className="flex gap-2 text-[10px]"><span className="flex-1 truncate">{reasonLabel(row.reason)}</span><strong>{row.count}</strong></div>) : <p className="text-[10px] text-emerald-400">Nenhuma lacuna aberta.</p>}</div></div>
        </div>
      </>}'''
text = text[:start] + metrics + text[end:]
text = text.replace('label="Não respondeu" count={unanswered.length}', 'label="Não respondeu" count={unansweredCounts.active}', 1)
# Replace unanswered tab section.
start = text.index('      {tab === "unanswered" &&')
end = text.index('\n\n      {tab === "prayers"', start)
unanswered_ui = r'''      {tab === "unanswered" && <div className="space-y-3">
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[hsl(var(--dark-card))]">
          {([[
            "active", "Abertas", unansweredCounts.active,
          ], ["resolved", "Resolvidas", unansweredCounts.resolved], ["ignored", "Ignoradas", unansweredCounts.ignored], ["all", "Todas", unansweredCounts.all]] as const).map(([key, label, count]) => <button key={key} onClick={() => setUnansweredView(key)} className={`h-9 rounded-lg text-[9px] font-bold ${unansweredView === key ? "bg-primary text-primary-foreground" : "text-[hsl(var(--dark-muted))]"}`}>{label} · {count}</button>)}
        </div>
        {visibleUnanswered.length === 0 ? <Empty text="Nenhuma pergunta nesta visualização." icon="check" /> : visibleUnanswered.map((row) => <div key={row.id} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-amber-500/20 p-4"><div className="flex gap-3"><AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" /><div className="flex-1 min-w-0"><div className="flex gap-2 flex-wrap"><span className="text-[8px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">{reasonLabel(row.reason)}</span><span className="text-[8px] px-2 py-0.5 rounded-full bg-[hsl(var(--dark-bg))]">{reviewStatusLabel(row.status)}</span>{row.occurrence_count > 1 && <span className="text-[8px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300">Repetiu {row.occurrence_count}×</span>}{row.route && <span className="text-[8px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{row.route}</span>}<span className="text-[8px] text-[hsl(var(--dark-muted))]">Última: {dateTime(row.last_seen_at || row.created_at)}</span></div><p className="text-xs font-semibold mt-2">{row.question}</p>{row.answer && <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-2 whitespace-pre-wrap">Última resposta registrada: {row.answer}</p>}<textarea value={unansweredNotes[row.id] ?? row.resolution_note ?? ""} onChange={(event) => setUnansweredNotes((current) => ({ ...current, [row.id]: event.target.value }))} maxLength={2000} placeholder="Nota de revisão (opcional): o que precisa ser corrigido, fonte esperada, decisão pastoral..." className="mt-3 min-h-20 w-full resize-y rounded-xl border border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-bg))] px-3 py-2 text-[10px] outline-none focus:border-primary/50"/><div className="flex gap-2 mt-3 flex-wrap">{row.status !== "reviewing" && <button disabled={busy === row.id} onClick={() => updateUnanswered(row.id, "reviewing")} className="h-9 px-3 rounded-xl bg-amber-500/10 text-amber-300 text-[10px] font-bold disabled:opacity-40">Em revisão</button>}<button disabled={busy === row.id} onClick={() => updateUnanswered(row.id, "resolved")} className="h-9 px-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-bold disabled:opacity-40">Marcar resolvida</button><button disabled={busy === row.id} onClick={() => updateUnanswered(row.id, "ignored")} className="h-9 px-3 rounded-xl bg-[hsl(var(--dark-bg))] text-[10px] font-bold disabled:opacity-40">Ignorar</button>{row.status !== "open" && <button disabled={busy === row.id} onClick={() => updateUnanswered(row.id, "open")} className="h-9 px-3 rounded-xl bg-primary/10 text-primary text-[10px] font-bold disabled:opacity-40">Reabrir</button>}</div><p className="text-[8px] text-[hsl(var(--dark-muted))] mt-3">Primeira ocorrência: {dateTime(row.first_seen_at || row.created_at)} · Esta fila é apenas para revisão humana; ela não altera prompts nem comportamento do ATIS automaticamente.</p></div></div></div>)}
      </div>}'''
text = text[:start] + unanswered_ui + text[end:]
p.write_text(text)

# --- tests: deterministic classification stays supervised and low-noise ---
test = Path("supabase/functions/_shared/atis/unanswered-intelligence_test.ts")
test.write_text(r'''import { runtimeFailureReason, unansweredReason } from "./conversation-runtime.ts";

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

Deno.test("classifies assistant uncertainty", () => {
  assertEquals(unansweredReason("Não tenho certeza dessa informação.", "ask_bible"), "assistant_uncertain", "uncertain");
});

Deno.test("classifies grounded lookup misses", () => {
  assertEquals(unansweredReason("🎵 Não encontrei esse hino na Harpa Cristã cadastrada no app.", "harpa_lookup"), "lookup_not_found", "lookup");
});

Deno.test("classifies incomplete Bible reference separately", () => {
  assertEquals(unansweredReason("📖 Não consegui identificar uma referência bíblica completa.", "bible_lookup"), "input_incomplete", "input");
});

Deno.test("classifies missing ministry grounding", () => {
  assertEquals(unansweredReason("Preciso de um culto lembrado com uma seleção ativa.", "ministry_relation"), "grounding_missing", "grounding");
});

Deno.test("does not flag a normal sourced answer", () => {
  assertEquals(unansweredReason("📖 João 3:16 — ARC", "bible_lookup"), null, "normal");
});

Deno.test("classifies provider and source runtime failures", () => {
  assertEquals(runtimeFailureReason("AI_PROVIDER_UNAVAILABLE"), "ai_provider_unavailable", "provider");
  assertEquals(runtimeFailureReason("AI_EMPTY_RESPONSE"), "ai_empty_response", "empty");
  assertEquals(runtimeFailureReason("APP_BIBLE_INVALID"), "source_unavailable", "source");
  assertEquals(runtimeFailureReason("unexpected failure"), "runtime_error", "runtime");
});
''')
