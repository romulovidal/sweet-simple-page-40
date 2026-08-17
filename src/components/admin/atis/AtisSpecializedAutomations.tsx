import { useEffect, useMemo, useState } from "react";
import { Clock3, Loader2, RefreshCw, ShieldAlert, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SpecializedAutomation = {
  id: string;
  destination_type: "contact" | "individual" | "group";
  destination_id: string;
  destination_name: string;
  feature_key: string;
  enabled: boolean;
  destination_allowed: boolean;
  effective_enabled: boolean;
  schedule_mode: "system" | "instant" | "custom_time" | string;
  custom_time?: string | null;
  timezone: string;
  updated_at: string;
};

const featureLabels: Record<string, string> = {
  daily_devotional: "Reflexão devocional diária",
  birthdays: "Aniversariantes do dia",
};

async function invoke(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sua sessão administrativa expirou.");
  const { data, error } = await supabase.functions.invoke("atis-console", {
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
    throw new Error(error.message || "Falha ao consultar automações por destinatário.");
  }
  return data as any;
}

function destinationLabel(type: SpecializedAutomation["destination_type"]) {
  if (type === "group") return "Grupo";
  if (type === "contact") return "Contato do app";
  return "Indivíduo";
}

function timeLabel(row: SpecializedAutomation) {
  if (row.schedule_mode === "custom_time" && row.custom_time) return row.custom_time.slice(0, 5);
  if (row.schedule_mode === "instant") return "Imediata";
  return "Horário padrão do app";
}

function updatedLabel(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Fortaleza",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export default function AtisSpecializedAutomations() {
  const [rows, setRows] = useState<SpecializedAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke({ action: "specialized_automations_list" });
      setRows(result.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar automações por destinatário.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, SpecializedAutomation[]>();
    for (const row of rows) {
      const current = map.get(row.feature_key) ?? [];
      current.push(row);
      map.set(row.feature_key, current);
    }
    return [...map.entries()].sort(([a], [b]) => (featureLabels[a] ?? a).localeCompare(featureLabels[b] ?? b, "pt-BR"));
  }, [rows]);

  const enabled = rows.filter((row) => row.effective_enabled).length;
  const blocked = rows.filter((row) => row.enabled && !row.destination_allowed).length;
  const customTimes = rows.filter((row) => row.schedule_mode === "custom_time" && row.custom_time).length;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 flex items-start gap-3">
        <UsersRound className="w-5 h-5 text-sky-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold">Automações por destinatário</h3>
          <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">
            Visão das rotinas especializadas executadas pelos runners do ATIS. Elas continuam configuradas na ficha de cada contato, indivíduo ou grupo; esta tela apenas consolida a operação sem criar uma segunda fonte de verdade.
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="w-9 h-9 rounded-xl bg-[hsl(var(--dark-bg))] grid place-items-center disabled:opacity-40" title="Atualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-6 text-center">
          <p className="text-sm font-bold">Nenhuma automação por destinatário configurada</p>
          <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">Ative devocionais, aniversários ou futuras rotinas na configuração do destinatário.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              ["Configuradas", rows.length, "registros reais"],
              ["Efetivamente ativas", enabled, "aptas a enviar"],
              ["Bloqueadas", blocked, "permissão do destino"],
              ["Horário próprio", customTimes, "agendamentos"],
            ].map(([label, value, sub]) => (
              <div key={String(label)} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-3">
                <p className="text-[9px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">{label}</p>
                <p className="text-xl font-black mt-1">{value}</p>
                <p className="text-[9px] text-[hsl(var(--dark-muted))]">{sub}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {grouped.map(([featureKey, items]) => (
              <div key={featureKey} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] overflow-hidden">
                <div className="p-4 border-b border-[hsl(var(--dark-card-hover))] flex items-center gap-3">
                  <Clock3 className="w-4 h-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-xs font-bold">{featureLabels[featureKey] ?? featureKey}</p>
                    <p className="text-[9px] text-[hsl(var(--dark-muted))] mt-0.5">{items.filter((item) => item.effective_enabled).length} ativa(s) de {items.length} configurada(s)</p>
                  </div>
                </div>
                <div className="divide-y divide-[hsl(var(--dark-card-hover))]">
                  {items.map((row) => (
                    <div key={row.id} className="p-4 flex items-start gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${row.effective_enabled ? "bg-emerald-400" : row.enabled && !row.destination_allowed ? "bg-amber-400" : "bg-[hsl(var(--dark-muted))]"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold truncate">{row.destination_name}</p>
                          <span className="text-[8px] px-2 py-0.5 rounded-full bg-[hsl(var(--dark-bg))]">{destinationLabel(row.destination_type)}</span>
                          {row.enabled && !row.destination_allowed && <span className="text-[8px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 inline-flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Bloqueada pelo destinatário</span>}
                          {!row.enabled && <span className="text-[8px] px-2 py-0.5 rounded-full bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]">Desativada</span>}
                        </div>
                        <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1.5">
                          {timeLabel(row)} · {row.timezone || "America/Fortaleza"} · atualizado {updatedLabel(row.updated_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-[hsl(var(--dark-muted))] px-1">
            Para alterar ativação ou horário, abra <strong>ATIS → Destinatários</strong>, selecione o contato, indivíduo ou grupo e use o botão de configurações. Os runners especializados continuam lendo diretamente essas configurações.
          </p>
        </>
      )}
    </div>
  );
}
