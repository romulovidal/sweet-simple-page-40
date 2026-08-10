import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Save, Loader2, Sparkles, HandHeart, Shield, Plus, X, Lock, Clock, ShieldCheck } from "lucide-react";

type DailyVerseDM = { enabled?: boolean; time?: string; include_reflection?: boolean; target?: "profiles" | "contacts" | "both"; last_sent_date?: string };
type Welcome = { enabled?: boolean; template?: string | null };
type Crisis = { enabled?: boolean; pastor_phones?: string[]; custom_keywords?: string[]; alert_template?: string | null };
type Access = { dm_restrict?: boolean; allow_group_members?: boolean; deny_reply?: string | null };
type Timed = { enabled?: boolean; time?: string };
type DevoT = Timed & { group_ids?: string[]; last_sent_date?: string };
type BdayT = Timed & { group_ids?: string[]; template?: string | null; use_ai?: boolean; last_sent_date?: string };
type Guard = {
  enabled?: boolean; warmup_start_date?: string | null;
  quiet_start?: number; quiet_end?: number;
  daily_global_cap?: number; daily_recipient_cap?: number; dedupe_hours?: number;
  hourly_cap?: number; daily_group_cap?: number;
  min_gap_ms?: number; max_gap_ms?: number;
  batch_pause_every?: number; batch_pause_ms?: number;
  variation?: boolean; optout_footer?: boolean;
  jitter_max_ms?: number; read_before_reply?: boolean; link_guard?: boolean; max_chars?: number;
  error_circuit?: number; paused_until?: string | null; consecutive_errors?: number;
};

const DEFAULTS = {
  daily_verse_dm: { enabled: false, time: "07:00", include_reflection: true, target: "both" } as DailyVerseDM,
  welcome: { enabled: true, template: null } as Welcome,
  crisis: { enabled: true, pastor_phones: [], custom_keywords: [], alert_template: null } as Crisis,
  access: { dm_restrict: false, allow_group_members: true, deny_reply: null } as Access,
  devotional: { enabled: false, time: "06:30", group_ids: [] } as DevoT,
  birthday: { enabled: false, time: "08:00", group_ids: [], template: null, use_ai: true } as BdayT,
  guard: {
    enabled: true, warmup_start_date: null, quiet_start: 21, quiet_end: 8,
    daily_global_cap: 120, daily_recipient_cap: 2, dedupe_hours: 20,
    hourly_cap: 20, daily_group_cap: 3,
    min_gap_ms: 25000, max_gap_ms: 95000, batch_pause_every: 8, batch_pause_ms: 300000,
    variation: true, optout_footer: true, jitter_max_ms: 9000, read_before_reply: true,
    link_guard: true, max_chars: 900,
    error_circuit: 3, paused_until: null, consecutive_errors: 0,
  } as Guard,
};

async function loadSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await atisDb.from("admin_settings").select("value").eq("key", key).maybeSingle();
  return { ...fallback, ...(data?.value ?? {}) } as T;
}
async function saveSetting(key: string, value: any) {
  const { error } = await atisDb.from("admin_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

const AtisAdvancedSettings = () => {
  const [dv, setDv] = useState<DailyVerseDM>(DEFAULTS.daily_verse_dm);
  const [wc, setWc] = useState<Welcome>(DEFAULTS.welcome);
  const [cr, setCr] = useState<Crisis>(DEFAULTS.crisis);
  const [ac, setAc] = useState<Access>(DEFAULTS.access);
  const [devo, setDevo] = useState<DevoT>(DEFAULTS.devotional);
  const [bday, setBday] = useState<BdayT>(DEFAULTS.birthday);
  const [gd, setGd] = useState<Guard>(DEFAULTS.guard);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newKw, setNewKw] = useState("");

  useEffect(() => {
    (async () => {
      const [a, b, c, d, e, f, g] = await Promise.all([
        loadSetting("atis_daily_verse_dm", DEFAULTS.daily_verse_dm),
        loadSetting("atis_welcome", DEFAULTS.welcome),
        loadSetting("atis_crisis_alert", DEFAULTS.crisis),
        loadSetting("atis_access_control", DEFAULTS.access),
        loadSetting("atis_daily_devotional", DEFAULTS.devotional),
        loadSetting("atis_birthday_greeting", DEFAULTS.birthday),
        loadSetting("atis_antiban", DEFAULTS.guard),
      ]);
      setDv(a); setWc(b); setCr(c); setAc(d); setDevo(e); setBday(f); setGd(g); setLoading(false);
    })();
  }, []);

  const save = async (key: string, value: any) => {
    setSaving(key);
    try { await saveSetting(key, value); toast.success("Salvo"); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin mx-auto mt-6" />;

  return (
    <div className="space-y-4">
      {/* Proteção anti-banimento */}
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg grid place-items-center bg-emerald-500/20 text-emerald-400"><ShieldCheck className="w-4 h-4" /></span>
          <div className="flex-1">
            <p className="text-sm font-bold">Proteção anti-banimento</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">Limites, pausas humanas, aquecimento do número e descadastro automático. Mantenha ativo para reduzir risco de bloqueio pela Meta. Desativar não interrompe os envios — apenas remove as travas (maior risco).</p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={gd.enabled !== false} onChange={(e) => setGd({ ...gd, enabled: e.target.checked })} />
            Ativo
          </label>
        </div>

        {gd.paused_until && new Date(gd.paused_until).getTime() > Date.now() && (
          <div className="rounded-lg bg-destructive/15 text-destructive text-[11px] p-2">
            Envios pausados automaticamente até {new Date(gd.paused_until).toLocaleTimeString("pt-BR")} — foram detectadas {gd.consecutive_errors ?? 0} falhas seguidas.
            <button className="ml-2 underline font-semibold" onClick={() => { const next = { ...gd, paused_until: null, consecutive_errors: 0 }; setGd(next); save("atis_antiban", next); }}>Retomar agora</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Número conectado em (aquecimento)</span>
            <input type="date" value={gd.warmup_start_date ?? ""} onChange={(e) => setGd({ ...gd, warmup_start_date: e.target.value || null })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Teto diário (após aquecimento)</span>
            <input type="number" min={10} value={gd.daily_global_cap ?? 250} onChange={(e) => setGd({ ...gd, daily_global_cap: Number(e.target.value) })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Máx. por contato/dia</span>
            <input type="number" min={1} value={gd.daily_recipient_cap ?? 3} onChange={(e) => setGd({ ...gd, daily_recipient_cap: Number(e.target.value) })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Bloquear repetição (horas)</span>
            <input type="number" min={0} value={gd.dedupe_hours ?? 20} onChange={(e) => setGd({ ...gd, dedupe_hours: Number(e.target.value) })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Silêncio a partir de (h)</span>
            <input type="number" min={0} max={23} value={gd.quiet_start ?? 21} onChange={(e) => setGd({ ...gd, quiet_start: Number(e.target.value) })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Silêncio até (h)</span>
            <input type="number" min={0} max={23} value={gd.quiet_end ?? 7} onChange={(e) => setGd({ ...gd, quiet_end: Number(e.target.value) })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Intervalo mínimo (segundos)</span>
            <input type="number" min={3} value={Math.round((gd.min_gap_ms ?? 12000) / 1000)} onChange={(e) => setGd({ ...gd, min_gap_ms: Number(e.target.value) * 1000 })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Intervalo máximo (segundos)</span>
            <input type="number" min={5} value={Math.round((gd.max_gap_ms ?? 45000) / 1000)} onChange={(e) => setGd({ ...gd, max_gap_ms: Number(e.target.value) * 1000 })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Pausa longa a cada N envios</span>
            <input type="number" min={0} value={gd.batch_pause_every ?? 15} onChange={(e) => setGd({ ...gd, batch_pause_every: Number(e.target.value) })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Duração da pausa longa (min)</span>
            <input type="number" min={1} value={Math.round((gd.batch_pause_ms ?? 180000) / 60000)} onChange={(e) => setGd({ ...gd, batch_pause_ms: Number(e.target.value) * 60000 })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Teto por hora (massa)</span>
            <input type="number" min={0} value={gd.hourly_cap ?? 20} onChange={(e) => setGd({ ...gd, hourly_cap: Number(e.target.value) })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Máx. por grupo/dia</span>
            <input type="number" min={1} value={gd.daily_group_cap ?? 3} onChange={(e) => setGd({ ...gd, daily_group_cap: Number(e.target.value) })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Atraso aleatório máx. (s)</span>
            <input type="number" min={0} value={Math.round((gd.jitter_max_ms ?? 9000) / 1000)} onChange={(e) => setGd({ ...gd, jitter_max_ms: Number(e.target.value) * 1000 })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Tamanho máx. da mensagem</span>
            <input type="number" min={200} value={gd.max_chars ?? 900} onChange={(e) => setGd({ ...gd, max_chars: Number(e.target.value) })}
              className="w-full rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={gd.read_before_reply !== false} onChange={(e) => setGd({ ...gd, read_before_reply: e.target.checked })} />
            Marcar como lido antes de responder (comportamento humano)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={gd.link_guard !== false} onChange={(e) => setGd({ ...gd, link_guard: e.target.checked })} />
            No máximo 1 link por mensagem automática
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={gd.variation !== false} onChange={(e) => setGd({ ...gd, variation: e.target.checked })} />
            Variar levemente cada mensagem (evita envios idênticos em massa)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={gd.optout_footer !== false} onChange={(e) => setGd({ ...gd, optout_footer: e.target.checked })} />
            Incluir rodapé "responda SAIR" nas mensagens automáticas em DM
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-[hsl(var(--dark-muted))]">Pausar tudo após N falhas seguidas</span>
            <input type="number" min={2} value={gd.error_circuit ?? 4} onChange={(e) => setGd({ ...gd, error_circuit: Number(e.target.value) })}
              className="w-28 rounded-lg bg-[hsl(var(--dark-bg))] px-3 py-2 text-sm" />
          </label>
        </div>

        <button onClick={() => save("atis_antiban", gd)} disabled={saving === "atis_antiban"}
          className="w-full rounded-xl bg-primary text-primary-foreground py-2 text-sm font-semibold flex items-center justify-center gap-2">
          {saving === "atis_antiban" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar proteção
        </button>
      </div>

      {/* Horários automáticos (grupos e DMs) */}
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg grid place-items-center bg-primary/20 text-primary"><Clock className="w-4 h-4" /></span>
          <div className="flex-1">
            <p className="text-sm font-bold">Horários automáticos</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">Horário de envio (Fortaleza-CE) de cada automação do Atis. As notificações nativas do app Bíblia Atalaia (versículo do dia no push, lembretes) seguem sua própria configuração no painel admin.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Reflexão devocional (grupos)</span>
            <input type="time" value={devo.time ?? "06:30"} onChange={(e) => setDevo({ ...devo, time: e.target.value })} className="input" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Aniversariantes (grupos)</span>
            <input type="time" value={bday.time ?? "08:00"} onChange={(e) => setBday({ ...bday, time: e.target.value })} className="input" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Versículo do dia (DM)</span>
            <input type="time" value={dv.time ?? "07:00"} onChange={(e) => setDv({ ...dv, time: e.target.value })} className="input" />
          </label>
        </div>
        <p className="text-[10px] text-[hsl(var(--dark-muted))]">Planos de leitura e séries têm horário definido por assinante (aba Planos WA e Séries). Lembretes de culto seguem a escala configurada.</p>
        <button
          onClick={async () => {
            setSaving("horarios");
            try {
              await Promise.all([
                saveSetting("atis_daily_devotional", devo),
                saveSetting("atis_birthday_greeting", bday),
                saveSetting("atis_daily_verse_dm", dv),
              ]);
              toast.success("Horários salvos");
            } catch (e: any) { toast.error(e.message); }
            finally { setSaving(null); }
          }}
          disabled={saving === "horarios"}
          className="btn-save">
          <Save className="w-3.5 h-3.5" /> {saving === "horarios" ? "Salvando…" : "Salvar horários"}
        </button>
      </div>

      {/* Controle de acesso — DM restrita */}
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg grid place-items-center bg-amber-500/20 text-amber-400"><Lock className="w-4 h-4" /></span>
          <div className="flex-1">
            <p className="text-sm font-bold">Controle de acesso (DM)</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">Só responde em conversa privada a contatos/usuários cadastrados ou pessoas de grupos onde o Atis participa. Nos grupos, o comportamento continua definido em cada grupo.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!!ac.dm_restrict} onChange={(e) => setAc({ ...ac, dm_restrict: e.target.checked })} /> Ativo
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={ac.allow_group_members !== false} onChange={(e) => setAc({ ...ac, allow_group_members: e.target.checked })} />
          Permitir também quem já esteve em algum grupo com o Atis
        </label>
        <div className="space-y-1">
          <span className="text-[11px] text-[hsl(var(--dark-muted))]">Mensagem de recusa (opcional — em branco = ignora em silêncio)</span>
          <textarea
            value={ac.deny_reply ?? ""} onChange={(e) => setAc({ ...ac, deny_reply: e.target.value })}
            placeholder="Ex.: Olá! Este canal é reservado a membros cadastrados. Fale com um administrador para ser incluído."
            className="input" style={{ height: 80, padding: 12 }} />
        </div>
        <button onClick={() => save("atis_access_control", ac)} disabled={saving === "atis_access_control"} className="btn-save">
          <Save className="w-3.5 h-3.5" /> {saving === "atis_access_control" ? "Salvando…" : "Salvar"}
        </button>
      </div>

      {/* DM diária do versículo */}
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg grid place-items-center bg-blue-500/20 text-blue-400"><Sparkles className="w-4 h-4" /></span>
          <div className="flex-1">
            <p className="text-sm font-bold">DM diária do versículo</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">Envia o versículo do dia (do app) por WhatsApp para quem optou.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!!dv.enabled} onChange={(e) => setDv({ ...dv, enabled: e.target.checked })} /> Ativo
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Horário (Fortaleza)</span>
            <input type="time" value={dv.time ?? "07:00"} onChange={(e) => setDv({ ...dv, time: e.target.value })} className="input" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[hsl(var(--dark-muted))]">Destinatários</span>
            <select value={dv.target ?? "both"} onChange={(e) => setDv({ ...dv, target: e.target.value as any })} className="input">
              <option value="both">App + Contatos</option>
              <option value="profiles">Só usuários do app</option>
              <option value="contacts">Só contatos Atis</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={dv.include_reflection !== false} onChange={(e) => setDv({ ...dv, include_reflection: e.target.checked })} />
          Incluir mini-reflexão gerada por IA
        </label>
        <button onClick={() => save("atis_daily_verse_dm", dv)} disabled={saving === "atis_daily_verse_dm"} className="btn-save">
          <Save className="w-3.5 h-3.5" /> {saving === "atis_daily_verse_dm" ? "Salvando…" : "Salvar"}
        </button>
      </div>

      {/* Boas-vindas */}
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg grid place-items-center bg-emerald-500/20 text-emerald-400"><HandHeart className="w-4 h-4" /></span>
          <div className="flex-1">
            <p className="text-sm font-bold">Boas-vindas automáticas</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">Envia mensagem inicial quando um usuário do app ou contato ativa opt-in.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={wc.enabled !== false} onChange={(e) => setWc({ ...wc, enabled: e.target.checked })} /> Ativo
          </label>
        </div>
        <textarea
          value={wc.template ?? ""} onChange={(e) => setWc({ ...wc, template: e.target.value })}
          placeholder="Deixe vazio para usar o modelo padrão. Use {nome} para o nome do contato."
          className="input" style={{ height: 140, padding: 12 }} />
        <button onClick={() => save("atis_welcome", wc)} disabled={saving === "atis_welcome"} className="btn-save">
          <Save className="w-3.5 h-3.5" /> {saving === "atis_welcome" ? "Salvando…" : "Salvar"}
        </button>
      </div>

      {/* Detecção de crise */}
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg grid place-items-center bg-red-500/20 text-red-400"><Shield className="w-4 h-4" /></span>
          <div className="flex-1">
            <p className="text-sm font-bold">Detecção de crise + alerta pastoral</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">Detecta sinais de risco em DMs, responde com acolhimento e avisa até 4 pastores simultaneamente. Sem rate-limit — toda mensagem de risco dispara alerta.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={cr.enabled !== false} onChange={(e) => setCr({ ...cr, enabled: e.target.checked })} /> Ativo
          </label>
        </div>

        <div>
          <p className="text-[11px] font-bold text-[hsl(var(--dark-muted))] uppercase tracking-wide mb-1.5">Pastores notificados</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(cr.pastor_phones ?? []).map((p) => (
              <span key={p} className="inline-flex items-center gap-1 bg-[hsl(var(--dark-bg))] rounded-lg px-2 py-1 text-xs">
                {p}
                <button onClick={() => setCr({ ...cr, pastor_phones: (cr.pastor_phones ?? []).filter((x) => x !== p) })} className="text-red-400"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {!cr.pastor_phones?.length && <span className="text-[11px] text-[hsl(var(--dark-muted))]">Nenhum — adicione até 4 números para intervenção rápida.</span>}
          </div>
          <div className="flex gap-2">
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="55859..."
              inputMode="tel"
              disabled={(cr.pastor_phones?.length ?? 0) >= 4}
              className="input flex-1 disabled:opacity-50" />
            <button
              onClick={() => {
                const ph = newPhone.replace(/\D/g, "");
                if (ph.length < 10) return toast.error("Número inválido");
                const current = cr.pastor_phones ?? [];
                if (current.includes(ph)) { setNewPhone(""); return toast.error("Este número já foi adicionado"); }
                if (current.length >= 4) return toast.error("Máximo de 4 pastores");
                setCr({ ...cr, pastor_phones: [...current, ph] });
                setNewPhone("");
              }}
              disabled={(cr.pastor_phones?.length ?? 0) >= 4}
              className="h-10 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">{(cr.pastor_phones?.length ?? 0)}/4 pastores cadastrados</p>
        </div>

        <div>
          <p className="text-[11px] font-bold text-[hsl(var(--dark-muted))] uppercase tracking-wide mb-1.5">Palavras-chave adicionais</p>
          <p className="text-[10px] text-[hsl(var(--dark-muted))] mb-2">Além das ~20 palavras padrão (suicídio, não aguento, abuso, etc.), você pode incluir termos específicos da sua comunidade.</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(cr.custom_keywords ?? []).map((k) => (
              <span key={k} className="inline-flex items-center gap-1 bg-[hsl(var(--dark-bg))] rounded-lg px-2 py-1 text-xs font-mono">
                {k}
                <button onClick={() => setCr({ ...cr, custom_keywords: (cr.custom_keywords ?? []).filter((x) => x !== k) })} className="text-red-400"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newKw} onChange={(e) => setNewKw(e.target.value)} placeholder="palavra ou expressão" className="input flex-1" />
            <button
              onClick={() => {
                const k = newKw.trim().toLowerCase();
                if (!k) return;
                setCr({ ...cr, custom_keywords: Array.from(new Set([...(cr.custom_keywords ?? []), k])) });
                setNewKw("");
              }}
              className="h-10 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
        </div>

        <textarea
          value={cr.alert_template ?? ""} onChange={(e) => setCr({ ...cr, alert_template: e.target.value })}
          placeholder="Template do alerta ao pastor (opcional). Variáveis: {nome} {numero} {mensagem} {palavras}"
          className="input" style={{ height: 100, padding: 12 }} />

        <button onClick={() => save("atis_crisis_alert", cr)} disabled={saving === "atis_crisis_alert"} className="btn-save">
          <Save className="w-3.5 h-3.5" /> {saving === "atis_crisis_alert" ? "Salvando…" : "Salvar"}
        </button>
      </div>

      <style>{`
        .input{width:100%;height:40px;padding:0 12px;border-radius:10px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:13px}
        .btn-save{width:100%;height:38px;border-radius:10px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));font-weight:600;font-size:12px;display:inline-flex;align-items:center;justify-content:center;gap:6px}
        .btn-save:disabled{opacity:.5}
      `}</style>
    </div>
  );
};

export default AtisAdvancedSettings;