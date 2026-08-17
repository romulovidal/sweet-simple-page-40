import { useEffect, useMemo, useState } from "react";
import { AtSign, BrainCircuit, Loader2, MessageCircle, Save, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

async function invoke(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sua sessão administrativa expirou.");
  const { data, error } = await supabase.functions.invoke("atis-settings", { body, headers: { Authorization: `Bearer ${token}` } });
  if (error) {
    const response = error?.context;
    if (response instanceof Response) {
      try { const payload = await response.clone().json(); throw new Error(payload?.message || payload?.error || error.message); } catch (cause) { if (cause instanceof Error && cause.message !== "Unexpected end of JSON input") throw cause; }
    }
    throw error;
  }
  return data as any;
}

const Toggle = ({ enabled, onChange, disabled = false, label }: { enabled: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!enabled)}
    className={`relative w-12 h-7 rounded-full transition-all shrink-0 disabled:opacity-35 ${enabled ? "bg-primary" : "bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))]"}`}
  >
    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${enabled ? "left-6" : "left-1"}`} />
  </button>
);

type Behavior = { direct: boolean; groups: boolean; mentionOnly: boolean };

const AtisSettings = () => {
  const [prompt, setPrompt] = useState("");
  const [original, setOriginal] = useState("");
  const [behavior, setBehavior] = useState<Behavior>({ direct: true, groups: true, mentionOnly: false });
  const [behaviorOriginal, setBehaviorOriginal] = useState<Behavior>({ direct: true, groups: true, mentionOnly: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [behaviorSaving, setBehaviorSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [behaviorSaved, setBehaviorSaved] = useState(false);

  useEffect(() => {
    let active = true;
    invoke({ action: "get" }).then((data) => {
      if (!active) return;
      setPrompt(data.prompt ?? "");
      setOriginal(data.prompt ?? "");
      const nextBehavior = {
        direct: data.auto_reply_direct !== false,
        groups: data.auto_reply_groups !== false,
        mentionOnly: data.group_mention_only === true,
      };
      setBehavior(nextBehavior);
      setBehaviorOriginal(nextBehavior);
    }).catch((err) => active && setError(err instanceof Error ? err.message : "Falha ao carregar as configurações."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const behaviorChanged = useMemo(() => (
    behavior.direct !== behaviorOriginal.direct
    || behavior.groups !== behaviorOriginal.groups
    || behavior.mentionOnly !== behaviorOriginal.mentionOnly
  ), [behavior, behaviorOriginal]);

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const result = await invoke({ action: "save", prompt });
      setPrompt(result.prompt ?? prompt); setOriginal(result.prompt ?? prompt); setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };

  const saveBehavior = async () => {
    setBehaviorSaving(true); setError(null); setBehaviorSaved(false);
    try {
      const result = await invoke({
        action: "save_behavior",
        auto_reply_direct: behavior.direct,
        auto_reply_groups: behavior.groups,
        group_mention_only: behavior.mentionOnly,
      });
      const nextBehavior = {
        direct: result.auto_reply_direct !== false,
        groups: result.auto_reply_groups !== false,
        mentionOnly: result.group_mention_only === true,
      };
      setBehavior(nextBehavior);
      setBehaviorOriginal(nextBehavior);
      setBehaviorSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar o comportamento do ATIS."); }
    finally { setBehaviorSaving(false); }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/60">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-2xl grid place-items-center bg-primary/15 text-primary shrink-0"><SlidersHorizontal className="w-5 h-5" /></span>
          <div><p className="text-[10px] uppercase tracking-[0.2em] text-primary">Configurações do ATIS</p><h2 className="text-xl font-bold mt-1">Personalize o comportamento</h2><p className="text-xs text-[hsl(var(--dark-muted))] mt-2 leading-relaxed">Controle quando o ATIS participa das conversas e ajuste sua identidade ministerial.</p></div>
        </div>
      </div>

      {error && <div className="rounded-2xl p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
      {behaviorSaved && <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">Comportamento salvo. As próximas mensagens já usarão esta configuração.</div>}
      {saved && <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">Prompt salvo. As próximas conversas já usarão esta versão.</div>}

      <section className="rounded-3xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/60 overflow-hidden">
        <div className="p-4 sm:p-5 flex items-start gap-3 border-b border-[hsl(var(--dark-card-hover))]/60">
          <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1"><h3 className="text-sm font-bold">Conversas e grupos</h3><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Defina onde o ATIS responde automaticamente e se ele deve aguardar ser chamado nos grupos.</p></div>
        </div>
        <div className="divide-y divide-[hsl(var(--dark-card-hover))]/50">
          <div className="p-4 sm:p-5 flex items-center gap-4">
            <span className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/10 text-primary shrink-0"><MessageCircle className="w-4 h-4" /></span>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold">Responder conversas individuais</p><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Mantém o atendimento automático nas conversas privadas autorizadas.</p></div>
            <Toggle enabled={behavior.direct} onChange={(direct) => { setBehavior((current) => ({ ...current, direct })); setBehaviorSaved(false); }} label="Responder conversas individuais" />
          </div>

          <div className="p-4 sm:p-5 flex items-center gap-4">
            <span className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/10 text-primary shrink-0"><Users className="w-4 h-4" /></span>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold">Responder em grupos</p><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Quando ativo, grupos sincronizados e habilitados podem conversar normalmente com o ATIS.</p></div>
            <Toggle enabled={behavior.groups} onChange={(groups) => { setBehavior((current) => ({ ...current, groups, mentionOnly: groups ? current.mentionOnly : false })); setBehaviorSaved(false); }} label="Responder em grupos" />
          </div>

          <div className={`p-4 sm:p-5 flex items-center gap-4 ${!behavior.groups ? "opacity-50" : ""}`}>
            <span className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/10 text-primary shrink-0"><AtSign className="w-4 h-4" /></span>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold">Somente quando o ATIS for chamado</p><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1 leading-relaxed">Nos grupos, responde somente quando alguém escrever <b>Atis</b> na mensagem ou marcar a conta do ATIS com @. Conversas gerais do grupo são ignoradas.</p></div>
            <Toggle disabled={!behavior.groups} enabled={behavior.groups && behavior.mentionOnly} onChange={(mentionOnly) => { setBehavior((current) => ({ ...current, mentionOnly })); setBehaviorSaved(false); }} label="Responder somente quando o ATIS for chamado" />
          </div>
        </div>
        <div className="p-4 sm:p-5 border-t border-[hsl(var(--dark-card-hover))]/60">
          <button onClick={saveBehavior} disabled={behaviorSaving || !behaviorChanged} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">{behaviorSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{behaviorSaving ? "Salvando..." : "Salvar comportamento"}</button>
        </div>
      </section>

      <section className="rounded-3xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/60 overflow-hidden">
        <div className="p-4 sm:p-5 flex items-start gap-3 border-b border-[hsl(var(--dark-card-hover))]/60">
          <BrainCircuit className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1"><h3 className="text-sm font-bold">Prompt-base do ATIS</h3><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Este é o prompt ministerial editável. As proteções técnicas e de segurança permanecem separadas e não podem ser removidas por engano.</p></div>
        </div>
        <div className="p-4 sm:p-5">
          <textarea value={prompt} onChange={(e) => { setPrompt(e.target.value); setSaved(false); }} rows={20} spellCheck={false} className="w-full min-h-[55dvh] md:min-h-[440px] rounded-2xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] p-4 text-xs sm:text-sm leading-relaxed outline-none focus:border-primary/50 resize-y" />
          <div className="mt-2 flex items-center justify-between text-[10px] text-[hsl(var(--dark-muted))]"><span>{prompt.length.toLocaleString("pt-BR")} / 20.000 caracteres</span><span>{prompt === original ? "Sem alterações" : "Alterações não salvas"}</span></div>
          <div className="mt-4 rounded-2xl p-3 bg-primary/5 border border-primary/10 flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" /><p className="text-[10px] leading-relaxed text-[hsl(var(--dark-muted))]">Regras fixas continuam protegendo segredos, ações administrativas e a exigência de usar Bíblia/Harpa/dados do próprio app como fonte quando disponíveis.</p></div>
          <button onClick={save} disabled={saving || prompt.trim().length < 200 || prompt === original} className="w-full h-12 mt-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? "Salvando..." : "Salvar prompt"}</button>
        </div>
      </section>
    </div>
  );
};

export default AtisSettings;
