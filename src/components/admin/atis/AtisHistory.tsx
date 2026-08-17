import { useEffect, useState } from "react";
import { AlertCircle, BarChart3, CheckCircle2, Loader2, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tab = "history" | "unanswered" | "prayers";
type Dashboard = {
  inbound_24h: number;
  inbound_7d: number;
  conversations_7d: number;
  unanswered_open: number;
  prayer_open: number;
  routes: Array<{ route: string; count: number }>;
  group_metrics: Array<{ id?: string; name?: string; messages_7d: number; top_route?: string | null; top_route_count?: number }>;
};

type HistoryRow = { id: string; remote_jid: string; sender_name?: string | null; message_text: string; is_group: boolean; assistant_route?: string | null; response_text?: string | null; status: string; error?: string | null; received_at: string };
type Unanswered = { id: string; question: string; route?: string | null; answer?: string | null; reason: string; status: string; created_at: string };
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

export default function AtisHistory() {
  const [tab, setTab] = useState<Tab>("history");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [unanswered, setUnanswered] = useState<Unanswered[]>([]);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [dash, hist, unans, pray] = await Promise.all([
        invoke({ action: "dashboard" }),
        invoke({ action: "history_list", data: { limit: 120 } }),
        invoke({ action: "unanswered_list", data: { status: "open", limit: 100 } }),
        invoke({ action: "prayers_list", data: { status: "active", limit: 100 } }),
      ]);
      setDashboard(dash.metrics ?? null); setHistory(hist.rows ?? []); setUnanswered(unans.rows ?? []); setPrayers(pray.rows ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao carregar histórico."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const updateUnanswered = async (id: string, status: "resolved" | "ignored") => {
    setBusy(id); setError(null);
    try { await invoke({ action: "unanswered_update", data: { id, status } }); await load(); }
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

      {dashboard && <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">{[
        ["24h", dashboard.inbound_24h, "mensagens"],
        ["7 dias", dashboard.inbound_7d, "mensagens"],
        ["Conversas", dashboard.conversations_7d, "em 7 dias"],
        ["Não respondeu", dashboard.unanswered_open, "abertas"],
        ["Orações", dashboard.prayer_open, "em acompanhamento"],
      ].map(([label, value, sub]) => <div key={String(label)} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-3"><p className="text-[9px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">{label}</p><p className="text-xl font-black mt-1">{value}</p><p className="text-[9px] text-[hsl(var(--dark-muted))]">{sub}</p></div>)}</div>}

      {dashboard && (dashboard.routes.length > 0 || dashboard.group_metrics.length > 0) && <div className="grid md:grid-cols-2 gap-3"><div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4"><p className="text-xs font-bold">Assuntos mais usados · 7 dias</p><div className="mt-3 space-y-2">{dashboard.routes.slice(0, 6).map((row) => <div key={row.route} className="flex items-center gap-2 text-[10px]"><span className="flex-1 truncate">{row.route}</span><strong>{row.count}</strong></div>)}</div></div><div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4"><p className="text-xs font-bold">Grupos mais ativos · 7 dias</p><div className="mt-3 space-y-2">{dashboard.group_metrics.length ? dashboard.group_metrics.slice(0, 6).map((row, index) => <div key={`${row.id}-${index}`} className="flex items-center gap-2 text-[10px]"><span className="flex-1 truncate">{row.name || "Grupo"}{row.top_route ? <span className="block text-[8px] text-[hsl(var(--dark-muted))] mt-0.5">Mais perguntado: {row.top_route}</span> : null}</span><strong>{row.messages_7d}</strong></div>) : <p className="text-[10px] text-[hsl(var(--dark-muted))]">Sem atividade de grupos no período.</p>}</div></div></div>}

      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[hsl(var(--dark-card))] sticky top-[70px] z-20"><TabButton active={tab === "history"} onClick={() => setTab("history")} label="Conversas" count={history.length} /><TabButton active={tab === "unanswered"} onClick={() => setTab("unanswered")} label="Não respondeu" count={unanswered.length} /><TabButton active={tab === "prayers"} onClick={() => setTab("prayers")} label="Orações" count={prayers.length} /></div>

      {tab === "history" && <div className="space-y-2">{history.length === 0 ? <Empty text="Nenhuma conversa registrada." /> : history.map((row) => <div key={row.id} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4"><div className="flex items-start gap-3"><MessageSquareText className="w-4 h-4 text-primary mt-0.5" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><p className="text-xs font-bold truncate">{row.sender_name || (row.is_group ? "Grupo" : "Conversa")}</p>{row.assistant_route && <span className="text-[8px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{row.assistant_route}</span>}<span className="text-[8px] text-[hsl(var(--dark-muted))]">{dateTime(row.received_at)}</span></div><p className="mt-2 text-xs"><span className="text-[hsl(var(--dark-muted))]">Usuário:</span> {row.message_text}</p>{row.response_text && <p className="mt-2 text-xs whitespace-pre-wrap"><span className="text-primary font-bold">ATIS:</span> {row.response_text}</p>}{row.error && <p className="mt-2 text-[10px] text-destructive">Erro: {row.error}</p>}</div></div></div>)}</div>}

      {tab === "unanswered" && <div className="space-y-2">{unanswered.length === 0 ? <Empty text="Nenhuma pergunta aberta nesta central." icon="check" /> : unanswered.map((row) => <div key={row.id} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-amber-500/20 p-4"><div className="flex gap-3"><AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" /><div className="flex-1 min-w-0"><div className="flex gap-2 flex-wrap"><span className="text-[8px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">{row.reason}</span>{row.route && <span className="text-[8px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{row.route}</span>}<span className="text-[8px] text-[hsl(var(--dark-muted))]">{dateTime(row.created_at)}</span></div><p className="text-xs font-semibold mt-2">{row.question}</p>{row.answer && <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-2 whitespace-pre-wrap">Resposta registrada: {row.answer}</p>}<div className="flex gap-2 mt-3"><button disabled={busy === row.id} onClick={() => updateUnanswered(row.id, "resolved")} className="h-9 px-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-bold disabled:opacity-40">Marcar resolvida</button><button disabled={busy === row.id} onClick={() => updateUnanswered(row.id, "ignored")} className="h-9 px-3 rounded-xl bg-[hsl(var(--dark-bg))] text-[10px] font-bold disabled:opacity-40">Ignorar</button></div></div></div></div>)}</div>}

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
