import { useEffect, useMemo, useState } from "react";
import { Bell, BrainCircuit, Clock3, Loader2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AtisDestinationType = "contact" | "individual" | "group";

type FeatureSetting = {
  kind: "ai" | "push";
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  schedule_mode: "system" | "custom_time";
  custom_time?: string | null;
  timezone: string;
  configured?: boolean;
};

type Props = {
  destinationType: AtisDestinationType;
  destinationId: string;
  destinationName: string;
  onClose: () => void;
};

async function errorMessage(error: any) {
  const fallback = error?.message || "Não foi possível salvar as configurações.";
  const response = error?.context;
  if (!(response instanceof Response)) return fallback;
  try {
    const body = await response.clone().json();
    const friendly: Record<string, string> = {
      CUSTOM_TIME_REQUIRED: "Escolha um horário para todos os pushes configurados como horário personalizado.",
      DESTINATION_NOT_FOUND: "Este destinatário não está mais disponível no ATIS.",
    };
    return friendly[body?.error] || body?.message || body?.error || fallback;
  } catch {
    return fallback;
  }
}

async function invoke<T = any>(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou. Entre novamente.");
  const { data, error } = await supabase.functions.invoke("atis-destination-settings", {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw new Error(await errorMessage(error));
  return data as T;
}

function Toggle({ enabled, onClick, disabled }: { enabled: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40 ${enabled ? "bg-primary" : "bg-[hsl(var(--dark-card-hover))]"}`}
      aria-pressed={enabled}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-1" : "translate-x-[-16px]"}`} style={{ left: "50%" }} />
    </button>
  );
}

const AtisDestinationSettings = ({ destinationType, destinationId, destinationName, onClose }: Props) => {
  const [settings, setSettings] = useState<FeatureSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void invoke<{ settings: FeatureSetting[] }>({
      action: "get",
      data: { destination_type: destinationType, id: destinationId },
    }).then((result) => {
      if (active) setSettings(result.settings ?? []);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Falha ao carregar configurações.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [destinationType, destinationId]);

  const ai = useMemo(() => settings.filter((item) => item.kind === "ai"), [settings]);
  const pushes = useMemo(() => settings.filter((item) => item.kind === "push"), [settings]);
  const invalidCustomTime = pushes.some((item) => item.enabled && item.schedule_mode === "custom_time" && !item.custom_time);

  const patch = (kind: FeatureSetting["kind"], key: string, values: Partial<FeatureSetting>) => {
    setSaved(false);
    setSettings((rows) => rows.map((row) => row.kind === kind && row.key === key ? { ...row, ...values } : row));
  };

  const save = async () => {
    if (invalidCustomTime) {
      setError("Escolha um horário para todos os pushes configurados como horário personalizado.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await invoke<{ settings: FeatureSetting[] }>({
        action: "save",
        data: {
          destination_type: destinationType,
          id: destinationId,
          settings: settings.map((item) => ({
            kind: item.kind,
            key: item.key,
            enabled: item.enabled,
            schedule_mode: item.kind === "push" ? item.schedule_mode : "system",
            custom_time: item.kind === "push" ? item.custom_time ?? null : null,
          })),
        },
      });
      setSettings(result.settings ?? settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm px-3 py-5 sm:px-4 sm:py-8 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[hsl(var(--dark-card-hover))] flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Configuração do destinatário</p>
            <h3 className="text-base font-bold text-[hsl(var(--dark-text))] mt-1 truncate">{destinationName}</h3>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Defina quais recursos este destino pode usar e quais pushes nativos serão espelhados no WhatsApp.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl grid place-items-center bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="p-4 sm:p-5 space-y-5">
            {error && <div className="rounded-xl p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs">{error}</div>}
            {saved && <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">Configurações salvas.</div>}

            <section className="rounded-2xl border border-[hsl(var(--dark-card-hover))] overflow-hidden">
              <div className="p-4 bg-[hsl(var(--dark-bg))] flex items-start gap-3">
                <BrainCircuit className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[hsl(var(--dark-text))]">Motores de IA</h4>
                  <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Cada ferramenta pode ser liberada ou bloqueada para este destino.</p>
                  {destinationType === "group" && <p className="text-[10px] text-amber-400 mt-1">Essas permissões não ligam sozinhas a resposta automática em grupos; elas são aplicadas quando o atendimento de grupos estiver habilitado.</p>}
                </div>
              </div>
              <div className="divide-y divide-[hsl(var(--dark-card-hover))]/60">
                {ai.map((item) => (
                  <div key={item.key} className="p-4 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[hsl(var(--dark-text))]">{item.label}</p>
                      <p className="text-[10px] leading-relaxed text-[hsl(var(--dark-muted))] mt-1">{item.description}</p>
                    </div>
                    <Toggle enabled={item.enabled} onClick={() => patch("ai", item.key, { enabled: !item.enabled })} disabled={saving} />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[hsl(var(--dark-card-hover))] overflow-hidden">
              <div className="p-4 bg-[hsl(var(--dark-bg))] flex items-start gap-3">
                <Bell className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[hsl(var(--dark-text))]">Pushes nativos do app → WhatsApp</h4>
                  <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Padrão do sistema envia quando o push nativo é executado. Horário personalizado segura a cópia na fila do ATIS até o horário escolhido.</p>
                </div>
              </div>
              <div className="divide-y divide-[hsl(var(--dark-card-hover))]/60">
                {pushes.map((item) => (
                  <div key={item.key} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[hsl(var(--dark-text))]">{item.label}</p>
                        <p className="text-[10px] leading-relaxed text-[hsl(var(--dark-muted))] mt-1">{item.description}</p>
                      </div>
                      <Toggle enabled={item.enabled} onClick={() => patch("push", item.key, { enabled: !item.enabled })} disabled={saving} />
                    </div>
                    {item.enabled && (
                      <div className="grid sm:grid-cols-[1fr_150px] gap-2">
                        <select
                          value={item.schedule_mode}
                          onChange={(e) => patch("push", item.key, { schedule_mode: e.target.value as FeatureSetting["schedule_mode"], ...(e.target.value === "system" ? { custom_time: null } : {}) })}
                          className="h-10 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-[11px] text-[hsl(var(--dark-text))] outline-none"
                        >
                          <option value="system">Padrão do sistema — instantâneo</option>
                          <option value="custom_time">Horário personalizado</option>
                        </select>
                        {item.schedule_mode === "custom_time" ? (
                          <label className="relative">
                            <Clock3 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--dark-muted))]" />
                            <input type="time" value={item.custom_time ?? ""} onChange={(e) => patch("push", item.key, { custom_time: e.target.value })} className="w-full h-10 pl-9 pr-2 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-[11px] text-[hsl(var(--dark-text))] outline-none" />
                          </label>
                        ) : <div className="h-10 rounded-xl bg-primary/5 border border-primary/10 px-3 flex items-center text-[10px] text-primary">Executa junto ao push</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="rounded-xl p-3 bg-[hsl(var(--dark-bg))] text-[10px] leading-relaxed text-[hsl(var(--dark-muted))]">
              Fuso horário: <strong className="text-[hsl(var(--dark-text))]">America/Fortaleza</strong>. Se um push nativo ocorrer depois do horário personalizado daquele dia, a cópia é liberada imediatamente para não ficar atrasada até o dia seguinte.
            </div>

            <button onClick={save} disabled={saving || invalidCustomTime} className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Salvando..." : "Salvar configurações"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AtisDestinationSettings;
