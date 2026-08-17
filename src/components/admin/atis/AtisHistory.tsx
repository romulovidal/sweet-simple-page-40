import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, BrainCircuit, CheckCircle2, Loader2, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tab = "history" | "unanswered" | "prayers";
type Dashboard = {
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
};

type HistoryMetadata = {
  context_source?: "memory" | "memory+history" | "history" | "none" | string | null;
  context_memory_reference?: string | null;
  context_memory_reason?: string | null;
  context_memory_age_seconds?: number | string | null;
  history_messages_used?: number | null;
  context_messages_used?: number | null;
};
type HistoryRow = { id: string; remote_jid: string; sender_name?: string | null; message_text: string; is_group: boolean; assistant_route?: string | null; response_text?: string | null; status: string; error?: string | null; metadata?: HistoryMetadata | null; received_at: string };
type Unanswered = { id: string; question: string; route?: string | null; answer?: string | null; reason: string; status: string; resolution_note?: string | null; occurrence_count: number; first_seen_at: string; last_seen_at: string; created_at: string };
type Prayer = { id: string; sender_name?: string | null; content: string; status: string; is_private: boolean; admin_note?: string | null; created_at: string };

async function invoke(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sua sessão administrativa expirou.");
  const { data, error } = await supabase.functions.invoke("atis-console", { body, headers: { Authorization: `Bearer ${token}` } });
  if (error) {
    const response = error?.context;
    if (response instanceof Response) {
      try { const parsed = await response.clone().json(); throw new Error(parsed?.message || parsed?.error || error.message); } catch (err) { if (err instanceof Error && err.message !== error.message) throw err; }
    }
    throw new Error(error.message || "Falha ao consultar o ATIS.");
  }
  return data as any;
}

function dateTime(value: string) {
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value)); }
  catch { return value; }
}

function contextLabel(source?: string | null) {
  if (source === "memory+history") return "memória + histórico";
  if (source === "memory") return "memória";
  if (source === "history") return "histórico";
  if (source === "none") return "sem contexto";
  return null;
}
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


export default function AtisHistory() {
  const [tab, setTab] = useState<Tab>("history");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [unanswered, setUnanswered] = useState<Unanswered[]>([]);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [unansweredView, setUnansweredView] = useState<"active" | "resolved" | "ignored" | "all">("active");
  const [unansweredNotes, setUnansweredNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const contextMetrics = useMemo(() => {
    const metrics = { memory: 0, history: 0, none: 0, measured: 0 };
    for (const row of history) {
      if (row.status !== "replied") continue;
      const source = row.metadata?.context_source;
      if (source === "memory" || source === "memory+history") { metrics.memory++; metrics.measured++; }
      else if (source === "history") { metrics.history++; metrics.measured++; }
      else if (source === "none") { metrics.none++; metrics.measured++; }
    }
    return metrics;
  }, [history]);

  const unansweredCounts = useMemo(() => ({
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

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [dash, hist, unans, pray] = await Promise.all([
        invoke({ action: "dashboard" }),
        invoke({ action: "history_list", data: { limit: 120 } }),
        invoke({ action: "unanswered_list", data: { status: "all", limit: 200 } }),
        invoke({ action: "prayers_list", data: { status: "active", limit: 100 } }),
      ]);
      setDashboard(dash.metrics ?? null); setHistory(hist.rows ?? []); setUnanswered(unans.rows ?? []); setPrayers(pray.rows ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao carregar histórico."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const updateUnanswered = async (id: string, status: "open" | "reviewing" | "resolved" | "ignored") => {
    setBusy(id); setError(null);
    try {
      const current = unanswered.find((row) => row.id === id);
      const resolutionNote = unansweredNotes[id] ?? current?.resolution_note ?? "";
      await invoke({ action: "unanswered_update", data: { id, status, resolution_note: resolutionNote || null } });
      await load();
    }
    catch (err) { setError(err instanceof Error ? err.message : "Falha ao atualizar."); }
    finally { setBusy(null); }
  };

  const updatePrayer = async (id: string, status: "praying" | "answered" | "archived") => {
    setBusy(id); setError(null);
    try { await invoke({ action: "prayer_update", data: { id, status } }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Falha ao atualizar pedido."); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"><BarChart3 className="w-5 h-5 text-primary mt-0.5" /><div className="flex-1"><h2 className="text-sm font-bold">Histórico e inteligência operacional</h2><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Acompanhe conversas, assuntos mais usados, grupos ativos, perguntas que o ATIS não soube sustentar e pedidos de oração confirmados.</p></div><button onClick={() => load()} className="w-9 h-9 rounded-xl bg-[hsl(var(--dark-bg))] grid place-items-center"><RefreshCw className="w-4 h-4" /></button></div>
      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

      {dashboard && <>
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
      </>}

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4">
        <div className="flex items-start gap-3">
          <BrainCircuit className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold">Contexto conversacional · amostra recente</p>
            <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">Mostra como as respostas novas estão recuperando continuidade. A memória estruturada tem prioridade; o histórico textual permanece como fallback.</p>
          </div>
        </div>
        {contextMetrics.measured > 0 ? (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              ["Memória", contextMetrics.memory, "estruturada"],
              ["Histórico", contextMetrics.history, "fallback"],
              ["Sem contexto", contextMetrics.none, "resposta nova"],
            ].map(([label, value, sub]) => <div key={String(label)} className="rounded-xl bg-[hsl(var(--dark-bg))] p-3"><p className="text-[9px] text-[hsl(var(--dark-muted))]">{label}</p><p className="text-lg font-black mt-0.5">{value}</p><p className="text-[8px] text-[hsl(var(--dark-muted))]">{sub}</p></div>)}
          </div>
        ) : (
          <p className="mt-3 text-[10px] text-[hsl(var(--dark-muted))]">A nova telemetria já está ativa. Ela aparecerá aqui assim que houver respostas processadas pela versão contextual do webhook.</p>
        )}
      </div>

      {dashboard && (dashboard.routes.length > 0 || dashboard.group_metrics.length > 0) && <div className="grid md:grid-cols-2 gap-3"><div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4"><p className="text-xs font-bold">Assuntos mais usados · 7 dias</p><div className="mt-3 space-y-2">{dashboard.routes.slice(0, 6).map((row) => <div key={row.route} className="flex items-center gap-2 text-[10px]"><span className="flex-1 truncate">{row.route}</span><strong>{row.count}</strong></div>)}</div></div><div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4"><p className="text-xs font-bold">Grupos mais ativos · 7 dias</p><div className="mt-3 space-y-2">{dashboard.group_metrics.length ? dashboard.group_metrics.slice(0, 6).map((row, index) => <div key={`${row.id}-${index}`} className="flex items-center gap-2 text-[10px]"><span className="flex-1 truncate">{row.name || "Grupo"}{row.top_route ? <span className="block text-[8px] text-[hsl(var(--dark-muted))] mt-0.5">Mais perguntado: {row.top_route}</span> : null}</span><strong>{row.messages_7d}</strong></div>) : <p className="text-[10px] text-[hsl(var(--dark-muted))]">Sem atividade de grupos no período.</p>}</div></div></div>}

      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[hsl(var(--dark-card))] sticky top-[70px] z-20"><TabButton active={tab === "history"} onClick={() => setTab("history")} label="Conversas" count={history.length} /><TabButton active={tab === "unanswered"} onClick={() => setTab("unanswered")} label="Não respondeu" count={unansweredCounts.active} /><TabButton active={tab === "prayers"} onClick={() => setTab("prayers")} label="Orações" count={prayers.length} /></div>

      {tab === "history" && <div className="space-y-2">{history.length === 0 ? <Empty text="Nenhuma conversa registrada." /> : history.map((row) => {
        const context = contextLabel(row.metadata?.context_source);
        return <div key={row.id} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4"><div className="flex items-start gap-3"><MessageSquareText className="w-4 h-4 text-primary mt-0.5" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><p className="text-xs font-bold truncate">{row.sender_name || (row.is_group ? "Grupo" : "Conversa")}</p>{row.assistant_route && <span className="text-[8px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{row.assistant_route}</span>}{context && <span className={`text-[8px] px-2 py-0.5 rounded-full ${row.metadata?.context_source?.includes("memory") ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400"}`}>{context}</span>}<span className="text-[8px] text-[hsl(var(--dark-muted))]">{dateTime(row.received_at)}</span></div>{row.metadata?.context_memory_reference && row.metadata?.context_source?.includes("memory") && <p className="text-[9px] text-emerald-400/80 mt-1">Memória bíblica: {row.metadata.context_memory_reference}</p>}<p className="mt-2 text-xs"><span className="text-[hsl(var(--dark-muted))]">Usuário:</span> {row.message_text}</p>{row.response_text && <p className="mt-2 text-xs whitespace-pre-wrap"><span className="text-primary font-bold">ATIS:</span> {row.response_text}</p>}{row.error && <p className="mt-2 text-[10px] text-destructive">Erro: {row.error}</p>}</div></div></div>;
      })}</div>}

      {tab === "unanswered" && <div className="space-y-3">
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[hsl(var(--dark-card))]">
          {([[
            "active", "Abertas", unansweredCounts.active,
          ], ["resolved", "Resolvidas", unansweredCounts.resolved], ["ignored", "Ignoradas", unansweredCounts.ignored], ["all", "Todas", unansweredCounts.all]] as const).map(([key, label, count]) => <button key={key} onClick={() => setUnansweredView(key)} className={`h-9 rounded-lg text-[9px] font-bold ${unansweredView === key ? "bg-primary text-primary-foreground" : "text-[hsl(var(--dark-muted))]"}`}>{label} · {count}</button>)}
        </div>
        {visibleUnanswered.length === 0 ? <Empty text="Nenhuma pergunta nesta visualização." icon="check" /> : visibleUnanswered.map((row) => <div key={row.id} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-amber-500/20 p-4"><div className="flex gap-3"><AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" /><div className="flex-1 min-w-0"><div className="flex gap-2 flex-wrap"><span className="text-[8px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">{reasonLabel(row.reason)}</span><span className="text-[8px] px-2 py-0.5 rounded-full bg-[hsl(var(--dark-bg))]">{reviewStatusLabel(row.status)}</span>{row.occurrence_count > 1 && <span className="text-[8px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300">Repetiu {row.occurrence_count}×</span>}{row.route && <span className="text-[8px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{row.route}</span>}<span className="text-[8px] text-[hsl(var(--dark-muted))]">Última: {dateTime(row.last_seen_at || row.created_at)}</span></div><p className="text-xs font-semibold mt-2">{row.question}</p>{row.answer && <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-2 whitespace-pre-wrap">Última resposta registrada: {row.answer}</p>}<textarea value={unansweredNotes[row.id] ?? row.resolution_note ?? ""} onChange={(event) => setUnansweredNotes((current) => ({ ...current, [row.id]: event.target.value }))} maxLength={2000} placeholder="Nota de revisão (opcional): o que precisa ser corrigido, fonte esperada, decisão pastoral..." className="mt-3 min-h-20 w-full resize-y rounded-xl border border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-bg))] px-3 py-2 text-[10px] outline-none focus:border-primary/50"/><div className="flex gap-2 mt-3 flex-wrap">{row.status !== "reviewing" && <button disabled={busy === row.id} onClick={() => updateUnanswered(row.id, "reviewing")} className="h-9 px-3 rounded-xl bg-amber-500/10 text-amber-300 text-[10px] font-bold disabled:opacity-40">Em revisão</button>}<button disabled={busy === row.id} onClick={() => updateUnanswered(row.id, "resolved")} className="h-9 px-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-bold disabled:opacity-40">Marcar resolvida</button><button disabled={busy === row.id} onClick={() => updateUnanswered(row.id, "ignored")} className="h-9 px-3 rounded-xl bg-[hsl(var(--dark-bg))] text-[10px] font-bold disabled:opacity-40">Ignorar</button>{row.status !== "open" && <button disabled={busy === row.id} onClick={() => updateUnanswered(row.id, "open")} className="h-9 px-3 rounded-xl bg-primary/10 text-primary text-[10px] font-bold disabled:opacity-40">Reabrir</button>}</div><p className="text-[8px] text-[hsl(var(--dark-muted))] mt-3">Primeira ocorrência: {dateTime(row.first_seen_at || row.created_at)} · Esta fila é apenas para revisão humana; ela não altera prompts nem comportamento do ATIS automaticamente.</p></div></div></div>)}
      </div>}

      {tab === "prayers" && <div className="space-y-2">{prayers.length === 0 ? <Empty text="Nenhum pedido de oração em acompanhamento." icon="check" /> : prayers.map((row) => <div key={row.id} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-primary/15 p-4"><div className="flex gap-3"><ShieldCheck className="w-4 h-4 text-primary mt-0.5" /><div className="flex-1 min-w-0"><div className="flex gap-2 items-center flex-wrap"><p className="text-xs font-bold">{row.sender_name || "Pessoa"}</p><span className="text-[8px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">privado</span><span className="text-[8px] px-2 py-0.5 rounded-full bg-[hsl(var(--dark-bg))]">{row.status}</span><span className="text-[8px] text-[hsl(var(--dark-muted))]">{dateTime(row.created_at)}</span></div><p className="text-xs mt-2 whitespace-pre-wrap">{row.content}</p><div className="flex gap-2 mt-3 flex-wrap"><button disabled={busy === row.id} onClick={() => updatePrayer(row.id, "praying")} className="h-9 px-3 rounded-xl bg-primary/10 text-primary text-[10px] font-bold disabled:opacity-40">Em oração</button><button disabled={busy === row.id} onClick={() => updatePrayer(row.id, "answered")} className="h-9 px-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-bold disabled:opacity-40">Respondida</button><button disabled={busy === row.id} onClick={() => updatePrayer(row.id, "archived")} className="h-9 px-3 rounded-xl bg-[hsl(var(--dark-bg))] text-[10px] font-bold disabled:opacity-40">Arquivar</button></div></div></div></div>)}</div>}
    </div>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return <button onClick={onClick} className={`h-10 rounded-lg text-[10px] sm:text-xs font-bold ${active ? "bg-primary text-primary-foreground" : "text-[hsl(var(--dark-muted))]"}`}>{label} <span className="opacity-70">({count})</span></button>;
}
function Empty({ text, icon }: { text: string; icon?: "check" }) {
  return <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-10 text-center">{icon === "check" ? <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400/70" /> : <MessageSquareText className="w-8 h-8 mx-auto text-[hsl(var(--dark-muted))] opacity-50" />}<p className="text-xs text-[hsl(var(--dark-muted))] mt-3">{text}</p></div>;
}
