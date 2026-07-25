import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Save, Loader2, Sparkles, HandHeart, Shield, Plus, X, Lock } from "lucide-react";

type DailyVerseDM = { enabled?: boolean; time?: string; include_reflection?: boolean; target?: "profiles" | "contacts" | "both"; last_sent_date?: string };
type Welcome = { enabled?: boolean; template?: string | null };
type Crisis = { enabled?: boolean; pastor_phones?: string[]; custom_keywords?: string[]; alert_template?: string | null };
type Access = { dm_restrict?: boolean; allow_group_members?: boolean; deny_reply?: string | null };

const DEFAULTS = {
  daily_verse_dm: { enabled: false, time: "07:00", include_reflection: true, target: "both" } as DailyVerseDM,
  welcome: { enabled: true, template: null } as Welcome,
  crisis: { enabled: true, pastor_phones: [], custom_keywords: [], alert_template: null } as Crisis,
  access: { dm_restrict: false, allow_group_members: true, deny_reply: null } as Access,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newKw, setNewKw] = useState("");

  useEffect(() => {
    (async () => {
      const [a, b, c, d] = await Promise.all([
        loadSetting("atis_daily_verse_dm", DEFAULTS.daily_verse_dm),
        loadSetting("atis_welcome", DEFAULTS.welcome),
        loadSetting("atis_crisis_alert", DEFAULTS.crisis),
        loadSetting("atis_access_control", DEFAULTS.access),
      ]);
      setDv(a); setWc(b); setCr(c); setAc(d); setLoading(false);
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