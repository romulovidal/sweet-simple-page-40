import { useEffect, useState } from "react";
import { Bot, Clock3, Loader2, Save, ShieldCheck, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AtisDestinationType } from "./AtisDestinationSettings";
import AtisDestinationInsights from "./AtisDestinationInsights";

type Profile = {
  conversation_mode: "normal" | "study" | "concise";
  response_style: "concise" | "balanced" | "detailed";
  quiet_hours_enabled: boolean;
  quiet_start?: string | null;
  quiet_end?: string | null;
  timezone: string;
  cooldown_seconds: number;
  max_replies_per_10m: number;
  mention_only: boolean;
  enable_buttons: boolean;
  enable_audio: boolean;
  continue_in_app: boolean;
  custom_instruction?: string | null;
};

type Props = { destinationType: AtisDestinationType; destinationId: string };

async function invoke(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sua sessão administrativa expirou.");
  const { data, error } = await supabase.functions.invoke("atis-console", { body, headers: { Authorization: `Bearer ${token}` } });
  if (error) {
    const response = error?.context;
    if (response instanceof Response) {
      try { const parsed = await response.clone().json(); throw new Error(parsed?.message || parsed?.error || error.message); } catch (err) { if (err instanceof Error && err.message !== error.message) throw err; }
    }
    throw new Error(error.message || "Não foi possível salvar o comportamento.");
  }
  return data as any;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`relative w-11 h-6 rounded-full transition disabled:opacity-40 ${checked ? "bg-primary" : "bg-[hsl(var(--dark-card-hover))]"}`}><span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? "translate-x-5" : ""}`} /></button>;
}

export default function AtisConversationProfile({ destinationType, destinationId }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setSaved(false); setDirty(false);
    void invoke({ action: "profile_get", data: { destination_type: destinationType, id: destinationId } })
      .then((result) => { if (active) setProfile(result.profile); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Falha ao carregar comportamento."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [destinationType, destinationId]);

  const patch = (values: Partial<Profile>) => { setProfile((current) => current ? { ...current, ...values } : current); setDirty(true); setSaved(false); };
  const save = async () => {
    if (!profile) return;
    if (profile.quiet_hours_enabled && (!profile.quiet_start || !profile.quiet_end)) { setError("Informe o início e o fim do horário silencioso."); return; }
    setSaving(true); setError(null); setSaved(false);
    try {
      const result = await invoke({ action: "profile_save", data: { destination_type: destinationType, id: destinationId, ...profile } });
      setProfile(result.profile); setDirty(false); setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao salvar comportamento."); }
    finally { setSaving(false); }
  };

  if (loading) return <section className="rounded-2xl border border-[hsl(var(--dark-card-hover))] p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></section>;
  if (!profile) return <section className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error || "Comportamento indisponível."}</section>;

  return <section className="rounded-2xl border border-[hsl(var(--dark-card-hover))] overflow-hidden">
    <div className="p-4 bg-[hsl(var(--dark-bg))] flex items-start gap-3"><Bot className="w-5 h-5 text-primary mt-0.5" /><div><h4 className="text-sm font-bold">Comportamento da conversa</h4><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Perfil independente para esta pessoa ou grupo: profundidade, silêncio, antispam, botões e áudio.</p></div></div>
    <div className="p-4 space-y-4">
      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-[10px] text-destructive">{error}</div>}
      {saved && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-[10px] text-emerald-400">Comportamento salvo.</div>}

      <AtisDestinationInsights destinationType={destinationType} destinationId={destinationId} />

      <div className="grid sm:grid-cols-2 gap-3"><Field label="Modo padrão"><select value={profile.conversation_mode} onChange={(e) => patch({ conversation_mode: e.target.value as Profile["conversation_mode"] })} className="profile-field"><option value="normal">Normal</option><option value="study">Modo Estudo</option><option value="concise">Conciso</option></select></Field><Field label="Estilo das respostas"><select value={profile.response_style} onChange={(e) => patch({ response_style: e.target.value as Profile["response_style"] })} className="profile-field"><option value="concise">Curto</option><option value="balanced">Equilibrado</option><option value="detailed">Detalhado</option></select></Field></div>
      <Field label="Instrução de estilo deste destino"><textarea value={profile.custom_instruction ?? ""} onChange={(e) => patch({ custom_instruction: e.target.value })} maxLength={1000} rows={3} placeholder="Ex.: responder com linguagem simples para jovens. Não altera regras de segurança do ATIS." className="profile-field h-auto py-3 resize-y" /></Field>

      <div className="rounded-xl bg-[hsl(var(--dark-bg))] p-3 space-y-3"><Row icon={<Clock3 className="w-4 h-4" />} title="Horário silencioso" subtitle="Ignora respostas automáticas durante a janela escolhida"><Toggle checked={profile.quiet_hours_enabled} onChange={(value) => patch({ quiet_hours_enabled: value })} /></Row>{profile.quiet_hours_enabled && <div className="grid grid-cols-2 gap-2"><Field label="Início"><input type="time" value={profile.quiet_start?.slice(0,5) ?? ""} onChange={(e) => patch({ quiet_start: e.target.value })} className="profile-field" /></Field><Field label="Fim"><input type="time" value={profile.quiet_end?.slice(0,5) ?? ""} onChange={(e) => patch({ quiet_end: e.target.value })} className="profile-field" /></Field></div>}</div>

      <div className="grid sm:grid-cols-2 gap-3"><Field label="Cooldown entre respostas (segundos)"><input type="number" min={0} max={300} value={profile.cooldown_seconds} onChange={(e) => patch({ cooldown_seconds: Number(e.target.value) })} className="profile-field" /></Field><Field label="Máximo de respostas / 10 min"><input type="number" min={1} max={50} value={profile.max_replies_per_10m} onChange={(e) => patch({ max_replies_per_10m: Number(e.target.value) })} className="profile-field" /></Field></div>

      {destinationType === "group" && <div className="rounded-xl bg-[hsl(var(--dark-bg))] p-3"><Row icon={<ShieldCheck className="w-4 h-4" />} title="Responder só quando chamado" subtitle="Em grupo, exige “Atis” ou @menção para evitar interferir em conversas"><Toggle checked={profile.mention_only} onChange={(value) => patch({ mention_only: value })} /></Row></div>}
      <div className="rounded-xl bg-[hsl(var(--dark-bg))] divide-y divide-[hsl(var(--dark-card-hover))]/60"><div className="p-3"><Row icon={<Bot className="w-4 h-4" />} title="Botões de ação" subtitle="Experimental na Evolution 2.3.7; deixe desligado salvo teste controlado"><Toggle checked={profile.enable_buttons} onChange={(value) => patch({ enable_buttons: value })} /></Row></div><div className="p-3"><Row icon={<Volume2 className="w-4 h-4" />} title="Resposta em áudio" subtitle="Quando possível, envia também uma narração; texto continua sendo a resposta principal"><Toggle checked={profile.enable_audio} onChange={(value) => patch({ enable_audio: value })} /></Row></div></div>
      <button onClick={save} disabled={saving || !dirty} className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? "Salvando…" : dirty ? "Salvar comportamento" : "Comportamento salvo"}</button>
    </div>
    <style>{`.profile-field{width:100%;min-height:40px;border-radius:12px;border:1px solid hsl(var(--dark-card-hover));background:hsl(var(--dark-bg));padding:0 10px;color:hsl(var(--dark-text));font-size:11px;outline:none}`}</style>
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="text-[10px] font-bold">{label}</span><div className="mt-1.5">{children}</div></label>; }
function Row({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) { return <div className="flex items-center gap-3"><span className="text-primary">{icon}</span><span className="min-w-0 flex-1"><span className="block text-[11px] font-bold">{title}</span><span className="block text-[9px] text-[hsl(var(--dark-muted))] mt-0.5">{subtitle}</span></span>{children}</div>; }
