import { useEffect, useState } from "react";
import { Activity, BrainCircuit, Clock3, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AtisDestinationType } from "./AtisDestinationSettings";

type Insights = {
  period_days: number;
  total: number;
  replied: number;
  failed: number;
  ignored: number;
  degraded: number;
  reply_success_rate: number | null;
  active_days: number;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  memory_hits: number;
  ministry_memory_hits: number;
  continuity_hits: number;
  top_routes: Array<{ route: string; count: number }>;
  context_sources: Array<{ source: string; count: number }>;
  peak_hour?: string | null;
  peak_hour_count: number;
  recommendations: string[];
};

type Props = { destinationType: AtisDestinationType; destinationId: string };

async function invoke(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sua sessão administrativa expirou.");
  const { data, error } = await supabase.functions.invoke("atis-insights", {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    const response = error?.context;
    if (response instanceof Response) {
      try {
        const parsed = await response.clone().json();
        throw new Error(parsed?.message || parsed?.error || error.message);
      } catch (err) {
        if (err instanceof Error && err.message !== error.message) throw err;
      }
    }
    throw new Error(error.message || "Não foi possível carregar a inteligência operacional.");
  }
  return data as any;
}

const routeLabels: Record<string, string> = {
  ask_bible: "Perguntas bíblicas",
  bible_lookup: "Leitura bíblica",
  exegetai: "Exegese",
  chapter_summary: "Resumo",
  word_meaning: "Palavras",
  connections: "Conexões",
  timeline: "Contexto histórico",
  devotional: "Devocional",
  daily_verse: "Versículo do dia",
  harpa_lookup: "Harpa",
  harpa_study: "Estudo da Harpa",
  culto_info: "Cultos",
  canticos_info: "Cânticos",
  ministry_relation: "Culto + Bíblia + Louvor",
  birthdays: "Aniversários",
};

function routeLabel(value: string) { return routeLabels[value] ?? value; }

export default function AtisDestinationInsights({ destinationType, destinationId }: Props) {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const result = await invoke({ destination_type: destinationType, id: destinationId, days: 30 });
      setData(result.insights ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar inteligência operacional.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [destinationType, destinationId]);

  return <section className="rounded-2xl border border-[hsl(var(--dark-card-hover))] overflow-hidden">
    <div className="p-4 bg-[hsl(var(--dark-bg))] flex items-start gap-3">
      <BrainCircuit className="w-5 h-5 text-primary mt-0.5" />
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold">Inteligência observada · 30 dias</h4>
        <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Perfil operacional derivado de rotas, estados e metadados. Não exibe nem analisa o texto das conversas neste painel.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} className="w-8 h-8 rounded-lg bg-[hsl(var(--dark-card))] grid place-items-center disabled:opacity-40" title="Atualizar inteligência"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></button>
    </div>

    {loading ? <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : error ? <div className="m-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-[10px] text-destructive">{error}</div> : !data || data.total === 0 ? <div className="p-4 text-[10px] text-[hsl(var(--dark-muted))]">Ainda não há atividade operacional suficiente deste destinatário no período.</div> : <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ["Interações", data.total],
          ["Respondidas", data.replied],
          ["Dias ativos", data.active_days],
          ["Sucesso", data.reply_success_rate == null ? "—" : `${data.reply_success_rate}%`],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-[hsl(var(--dark-bg))] p-3"><p className="text-[8px] uppercase tracking-wide text-[hsl(var(--dark-muted))]">{label}</p><p className="text-lg font-black mt-1">{value}</p></div>)}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-[hsl(var(--dark-bg))] p-3">
          <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /><p className="text-[10px] font-bold">Rotas mais usadas</p></div>
          <div className="mt-2 space-y-1.5">{data.top_routes.slice(0, 5).map((row) => <div key={row.route} className="flex gap-2 text-[9px]"><span className="flex-1 truncate">{routeLabel(row.route)}</span><strong>{row.count}</strong></div>)}</div>
        </div>
        <div className="rounded-xl bg-[hsl(var(--dark-bg))] p-3">
          <div className="flex items-center gap-2"><Clock3 className="w-4 h-4 text-primary" /><p className="text-[10px] font-bold">Continuidade e atividade</p></div>
          <div className="mt-2 space-y-1.5 text-[9px] text-[hsl(var(--dark-muted))]">
            <p>Memória reaproveitada: <strong className="text-[hsl(var(--dark-text))]">{data.continuity_hits}</strong></p>
            <p>Horário mais ativo: <strong className="text-[hsl(var(--dark-text))]">{data.peak_hour ?? "—"}</strong></p>
            <p>Degradadas: <strong className="text-[hsl(var(--dark-text))]">{data.degraded}</strong> · Falhas: <strong className="text-[hsl(var(--dark-text))]">{data.failed}</strong></p>
          </div>
        </div>
      </div>

      {data.recommendations.length > 0 && <div className="rounded-xl border border-primary/15 bg-primary/5 p-3"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /><p className="text-[10px] font-bold">Sinais para revisão do administrador</p></div><div className="mt-2 space-y-1.5">{data.recommendations.map((item, index) => <p key={`${index}:${item}`} className="text-[9px] leading-relaxed text-[hsl(var(--dark-muted))]">• {item}</p>)}</div><p className="text-[8px] text-[hsl(var(--dark-muted))] mt-3">Nenhuma recomendação é aplicada automaticamente ao comportamento do ATIS.</p></div>}
    </div>}
  </section>;
}
