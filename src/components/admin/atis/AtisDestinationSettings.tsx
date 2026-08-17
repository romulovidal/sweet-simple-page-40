import { useEffect, useMemo, useState } from "react";
import { Bell, BrainCircuit, Cake, Clock3, Loader2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AtisConversationProfile from "./AtisConversationProfile";

export type AtisDestinationType = "contact" | "individual" | "group";
type FeatureKind = "ai" | "push" | "automation";
type ScheduleMode = "system" | "instant" | "custom_time";

type FeatureSetting = {
  kind: FeatureKind;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  schedule_mode: ScheduleMode;
  custom_time?: string | null;
  timezone: string;
  configured?: boolean;
  systemBehavior?: string;
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
      CUSTOM_TIME_REQUIRED: "Escolha um horário para todos os recursos configurados como horário personalizado.",
      DESTINATION_NOT_FOUND: "Este destinatário não está mais disponível no ATIS.",
      INVALID_FEATURE: "Um dos recursos selecionados não está disponível para este tipo de destinatário.",
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
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function ScheduleEditor({ item, saving, patch }: { item: FeatureSetting; saving: boolean; patch: (values: Partial<FeatureSetting>) => void }) {
  if (!item.enabled) return null;
  return (
    <div className="grid sm:grid-cols-[1fr_150px] gap-2">
      <select
        value={item.schedule_mode}
        disabled={saving}
        onChange={(event) => {
          const mode = event.target.value as ScheduleMode;
          patch({ schedule_mode: mode, ...(mode !== "custom_time" ? { custom_time: null } : {}) });
        }}
        className="h-10 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-[11px] text-[hsl(var(--dark-text))] outline-none disabled:opacity-40"
      >
        <option value="system">Padrão do sistema</option>
        <option value="instant">Instantâneo ao evento</option>
        <option value="custom_time">Horário personalizado</option>
      </select>
      {item.schedule_mode === "custom_time" ? (
        <label className="relative">
          <Clock3 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--dark-muted))]" />
          <input
            type="time"
            value={item.custom_time ?? ""}
            disabled={saving}
            onChange={(event) => patch({ custom_time: event.target.value })}
            className="w-full h-10 pl-9 pr-2 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-[11px] text-[hsl(var(--dark-text))] outline-none disabled:opacity-40"
          />
        </label>
      ) : (
        <div className="min-h-10 rounded-xl bg-primary/5 border border-primary/10 px-3 py-2 flex items-center text-[10px] leading-snug text-primary">
          {item.schedule_mode === "instant" ? "Envia assim que o evento ocorrer" : item.systemBehavior || "Usa o comportamento padrão do recurso"}
        </div>
      )}
    </div>
  );
}

const AtisDestinationSettings = ({ destinationType, destinationId, destinationName, onClose }: Props) => {
  const [settings, setSettings] = useState<FeatureSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setDirty(false);
    void invoke<{ settings: FeatureSetting[] }>({ action: "get", data: { destination_type: destinationType, id: destinationId } })
      .then((result) => { if (active) setSettings(result.settings ?? []); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Falha ao carregar configurações."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [destinationType, destinationId]);

  const ai = useMemo(() => settings.filter((item) => item.kind === "ai"), [settings]);
  const pushes = useMemo(() => settings.filter((item) => item.kind === "push"), [settings]);
  const automations = useMemo(() => settings.filter((item) => item.kind === "automation"), [settings]);
  const invalidCustomTime = settings.some((item) => item.kind !== "ai" && item.enabled && item.schedule_mode === "custom_time" && !item.custom_time);

  const patch = (kind: FeatureKind, key: string, values: Partial<FeatureSetting>) => {
    setSaved(false);
    setDirty(true);
    setSettings((rows) => rows.map((row) => row.kind === kind && row.key === key ? { ...row, ...values } : row));
  };

  const save = async () => {
    if (invalidCustomTime) {
      setError("Escolha um horário para todos os recursos configurados como horário personalizado.");
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
            schedule_mode: item.kind === "ai" ? "system" : item.schedule_mode,
            custom_time: item.kind === "ai" ? null : item.custom_time ?? null,
          })),
        },
      });
      setSettings(result.settings ?? settings);
      setSaved(true);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const renderScheduledSection = (title: string, description: string, items: FeatureSetting[], icon: "bell" | "cake") => {
    if (!items.length) return null;
    const Icon = icon === "cake" ? Cake : Bell;
    return (
      <section className="rounded-2xl border border-[hsl(var(--dark-card-hover))] overflow-hidden">
        <div className="p-4 bg-[hsl(var(--dark-bg))] flex items-start gap-3">
          <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-[hsl(var(--dark-text))]">{title}</h4>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">{description}</p>
          </div>
        </div>
        <div className="divide-y divide-[hsl(var(--dark-card-hover))]/60">
          {items.map((item) => (
            <div key={`${item.kind}:${item.key}`} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[hsl(var(--dark-text))]">{item.label}</p>
                  <p className="text-[10px] leading-relaxed text-[hsl(var(--dark-muted))] mt-1">{item.description}</p>
                </div>
                <Toggle enabled={item.enabled} onClick={() => patch(item.kind, item.key, { enabled: !item.enabled })} disabled={saving} />
              </div>
              <ScheduleEditor item={item} saving={saving} patch={(values) => patch(item.kind, item.key, values)} />
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-start sm:justify-center sm:px-4 sm:py-8 overflow-hidden">
      <div className="w-full max-w-2xl max-h-[92dvh] sm:max-h-[calc(100vh-4rem)] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[hsl(var(--dark-card-hover))] flex items-start gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Configuração do destinatário</p>
            <h3 className="text-base font-bold text-[hsl(var(--dark-text))] mt-1 truncate">{destinationName}</h3>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Cada recurso deste destinatário tem ativação e horário próprios. Uma configuração não altera os demais contatos, individuais ou grupos.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl grid place-items-center bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-5 space-y-5">
              {error && <div className="rounded-xl p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs">{error}</div>}
              {saved && <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">Configurações salvas para este destinatário.</div>}
              <div className={`rounded-xl p-3 border text-[10px] leading-relaxed ${dirty ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-primary/5 border-primary/10 text-primary"}`}>
                {dirty ? "Há alterações ainda não salvas. Toque em Salvar configurações na barra fixa abaixo para colocá-las em funcionamento." : "Os valores exibidos estão salvos no ATIS. Qualquer nova alteração só entra em vigor depois de tocar em Salvar configurações."}
              </div>

              <AtisConversationProfile destinationType={destinationType} destinationId={destinationId} />

              <section className="rounded-2xl border border-[hsl(var(--dark-card-hover))] overflow-hidden">
                <div className="p-4 bg-[hsl(var(--dark-bg))] flex items-start gap-3">
                  <BrainCircuit className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[hsl(var(--dark-text))]">Motores de IA</h4>
                    <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">As respostas conversacionais continuam instantâneas; aqui você apenas libera ou bloqueia cada motor para este destino.</p>
                    {destinationType === "group" && <p className="text-[10px] text-amber-400 mt-1">Essas permissões não ligam sozinhas respostas automáticas no grupo.</p>}
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

              {renderScheduledSection("Pushes nativos do app → WhatsApp", "Cada push pode seguir o padrão do sistema, sair instantaneamente ou esperar um horário exclusivo deste destinatário.", pushes, "bell")}
              {renderScheduledSection("Conteúdos e automações ATIS", "Conteúdos automáticos do ATIS também têm ativação e horário exclusivos para este destinatário. A Reflexão Devocional usa o Versículo do Dia e o motor devocional já existentes no app.", automations, "cake")}

              <div className="rounded-xl p-3 bg-[hsl(var(--dark-bg))] text-[10px] leading-relaxed text-[hsl(var(--dark-muted))]">
                Fuso horário: <strong className="text-[hsl(var(--dark-text))]">America/Fortaleza</strong>. Em push nativo com horário personalizado, se o evento só chegar depois do horário escolhido, a mensagem é liberada naquele momento para não ficar presa até o dia seguinte.
              </div>
            </div>

            <div className="shrink-0 p-3 sm:p-4 border-t border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-card))]/95 backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button onClick={save} disabled={saving || invalidCustomTime} className={`w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 ${dirty ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] border border-[hsl(var(--dark-card-hover))]"}`}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Salvando..." : dirty ? "Salvar configurações" : "Configurações salvas"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AtisDestinationSettings;
