import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Users, Smartphone, RefreshCw } from "lucide-react";

type Bucket = { base: number; retained: number; rate: number | null };
type SourceSummary = { d1: Bucket; d7: Bucket; d30: Bucket };
type PerDay = {
  source: "user" | "device";
  cohort_day: string;
  cohort_size: number;
  d1: number; d7: number; d30: number;
  eligible_d1: boolean; eligible_d7: boolean; eligible_d30: boolean;
};
type Metrics = {
  days_back: number;
  generated_at: string;
  summary: Record<string, SourceSummary>;
  per_day: PerDay[];
};

const RANGES = [7, 14, 30, 60, 90];

const fmtRate = (r: number | null) => (r == null ? "—" : `${r.toFixed(1)}%`);

const SourceCard = ({
  title, icon: Icon, data,
}: { title: string; icon: typeof Users; data?: SourceSummary }) => (
  <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-sm font-semibold text-[hsl(var(--dark-text))]">{title}</span>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {(["d1", "d7", "d30"] as const).map((k) => {
        const b = data?.[k];
        return (
          <div key={k} className="bg-[hsl(var(--dark-bg))] rounded-lg p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">
              {k.toUpperCase()}
            </p>
            <p className="text-xl font-bold text-[hsl(var(--dark-text))] mt-1">
              {fmtRate(b?.rate ?? null)}
            </p>
            <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-0.5">
              {b ? `${b.retained}/${b.base}` : "—"}
            </p>
          </div>
        );
      })}
    </div>
  </div>
);

const AdminRetention = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (d: number) => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.rpc("get_retention_metrics", { _days_back: d });
    if (err) setError(err.message);
    else setData(res as unknown as Metrics);
    setLoading(false);
  };

  useEffect(() => { load(days); }, [days]);

  const userSummary = data?.summary?.user;
  const deviceSummary = data?.summary?.device;

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
            Últimos {r}d
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

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm">{error}</div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <SourceCard title="Usuários logados" icon={Users} data={userSummary} />
          <SourceCard title="Dispositivos anônimos" icon={Smartphone} data={deviceSummary} />

          <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-[hsl(var(--dark-text))]">
                Coortes diárias
              </span>
            </div>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs min-w-[520px]">
                <thead>
                  <tr className="text-[hsl(var(--dark-muted))] border-b border-[hsl(var(--dark-bg))]">
                    <th className="text-left py-2 font-medium">Dia</th>
                    <th className="text-left py-2 font-medium">Fonte</th>
                    <th className="text-right py-2 font-medium">Coorte</th>
                    <th className="text-right py-2 font-medium">D1</th>
                    <th className="text-right py-2 font-medium">D7</th>
                    <th className="text-right py-2 font-medium">D30</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.per_day ?? [])
                    .slice()
                    .sort((a, b) => (a.cohort_day < b.cohort_day ? 1 : -1))
                    .map((row) => (
                      <tr key={`${row.source}-${row.cohort_day}`} className="border-b border-[hsl(var(--dark-bg))]/50">
                        <td className="py-1.5 text-[hsl(var(--dark-text))]">{row.cohort_day}</td>
                        <td className="py-1.5 capitalize text-[hsl(var(--dark-muted))]">{row.source}</td>
                        <td className="py-1.5 text-right text-[hsl(var(--dark-text))]">{row.cohort_size}</td>
                        <td className="py-1.5 text-right text-[hsl(var(--dark-muted))]">
                          {row.eligible_d1 ? row.d1 : "—"}
                        </td>
                        <td className="py-1.5 text-right text-[hsl(var(--dark-muted))]">
                          {row.eligible_d7 ? row.d7 : "—"}
                        </td>
                        <td className="py-1.5 text-right text-[hsl(var(--dark-muted))]">
                          {row.eligible_d30 ? row.d30 : "—"}
                        </td>
                      </tr>
                    ))}
                  {(!data?.per_day || data.per_day.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-[hsl(var(--dark-muted))]">
                        Sem dados no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-3">
              "—" indica coortes ainda dentro da janela (sem tempo suficiente para medir).
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminRetention;