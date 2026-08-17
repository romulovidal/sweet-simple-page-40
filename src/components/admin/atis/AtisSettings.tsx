import { useEffect, useState } from "react";
import { BrainCircuit, Loader2, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
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

const AtisSettings = () => {
  const [prompt, setPrompt] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    invoke({ action: "get" }).then((data) => {
      if (!active) return;
      setPrompt(data.prompt ?? "");
      setOriginal(data.prompt ?? "");
    }).catch((err) => active && setError(err instanceof Error ? err.message : "Falha ao carregar o prompt."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const result = await invoke({ action: "save", prompt });
      setPrompt(result.prompt ?? prompt); setOriginal(result.prompt ?? prompt); setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/60">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-2xl grid place-items-center bg-primary/15 text-primary shrink-0"><SlidersHorizontal className="w-5 h-5" /></span>
          <div><p className="text-[10px] uppercase tracking-[0.2em] text-primary">Configurações do ATIS</p><h2 className="text-xl font-bold mt-1">Personalize o comportamento</h2><p className="text-xs text-[hsl(var(--dark-muted))] mt-2 leading-relaxed">Ajuste identidade, tom, visão ministerial e instruções de roteamento até o ATIS responder da forma ideal.</p></div>
        </div>
      </div>

      {error && <div className="rounded-2xl p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
      {saved && <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">Prompt salvo. As próximas conversas já usarão esta versão.</div>}

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
