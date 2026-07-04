import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, RefreshCw, Search, BookOpen } from "lucide-react";

type Totals = { total_events: number; unique_actors: number };
type Item = { event_name?: string; n: number; book?: string; chapter?: number; q?: string };
type ByDay = { day: string; n: number };
type Summary = {
  days_back: number;
  totals: Totals;
  top_events: Item[];
  by_day: ByDay[];
  top_chapters: Item[];
  top_searches: Item[];
};

const RANGES = [1, 7, 14, 30];

const AdminAnalytics = () => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (d: number) => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.rpc("get_analytics_summary", { _days_back: d });
    if (err) setError(err.message);
    else setData(res as unknown as Summary);
    setLoading(false);
  };

  useEffect(() => { load(days); }, [days]);

  const max = data?.by_day.reduce((m, d) => Math.max(m, d.n), 0) || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setDays(r)}
            className={`px-3 h-9 rounded-full text-xs font-semibold transition-colors shrink-0 ${
              days === r
                ? "bg-primary text-primary-foreground"
                : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card-hover))]"
            }`}
          >
            {r === 1 ? "Hoje" : `${r} dias`}
          </button>
        ))}
        <button
          onClick={() => load(days)}
          className="ml-auto w-9 h-9 rounded-full grid place-items-center bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] shrink-0"
          aria-label="Recarregar"
        >
          <RefreshCw className={`w-4 h-4 text-[hsl(var(--dark-muted))] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm">{error}</div>}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs text-[hsl(var(--dark-muted))]">Eventos</span>
              </div>
              <p className="text-2xl font-bold">{data?.totals.total_events ?? 0}</p>
            </div>
            <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-[hsl(var(--dark-muted))]">Únicos</span>
              </div>
              <p className="text-2xl font-bold">{data?.totals.unique_actors ?? 0}</p>
            </div>
          </div>

          {data && data.by_day.length > 0 && (
            <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
              <p className="text-sm font-semibold mb-3">Eventos por dia</p>
              <div className="flex items-end gap-1 h-24">
                {data.by_day.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div
                      className="w-full bg-primary/70 rounded-t"
                      style={{ height: `${(d.n / max) * 100}%` }}
                      title={`${d.day}: ${d.n}`}
                    />
                    <span className="text-[9px] text-[hsl(var(--dark-muted))] truncate w-full text-center">
                      {d.day.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
            <p className="text-sm font-semibold mb-3">Top eventos</p>
            <div className="space-y-2">
              {(data?.top_events ?? []).map((e) => (
                <div key={e.event_name} className="flex items-center justify-between text-sm">
                  <span className="truncate">{e.event_name}</span>
                  <span className="text-[hsl(var(--dark-muted))]">{e.n}</span>
                </div>
              ))}
              {(!data?.top_events || data.top_events.length === 0) && (
                <p className="text-xs text-[hsl(var(--dark-muted))]">Sem dados no período.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Capítulos mais lidos</span>
              </div>
              <div className="space-y-1.5">
                {(data?.top_chapters ?? []).map((c, i) => (
                  <div key={`${c.book}-${c.chapter}`} className="flex items-center gap-3 text-sm">
                    <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                    <span className="flex-1 uppercase">{c.book} {c.chapter}</span>
                    <span className="text-xs text-[hsl(var(--dark-muted))]">{c.n}x</span>
                  </div>
                ))}
                {(!data?.top_chapters || data.top_chapters.length === 0) && (
                  <p className="text-xs text-[hsl(var(--dark-muted))]">Sem dados.</p>
                )}
              </div>
            </div>

            <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Buscas populares</span>
              </div>
              <div className="space-y-1.5">
                {(data?.top_searches ?? []).map((s, i) => (
                  <div key={s.q} className="flex items-center gap-3 text-sm">
                    <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                    <span className="flex-1 truncate">"{s.q}"</span>
                    <span className="text-xs text-[hsl(var(--dark-muted))]">{s.n}x</span>
                  </div>
                ))}
                {(!data?.top_searches || data.top_searches.length === 0) && (
                  <p className="text-xs text-[hsl(var(--dark-muted))]">Sem dados.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAnalytics;