import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Cake, Clock, Users, Send, Save, Sparkles } from "lucide-react";

type Group = { id: string; wa_group_id: string; name: string };
type Cfg = { enabled: boolean; time: string; group_ids: string[]; template: string | null; use_ai: boolean; last_sent_date?: string };

const DEFAULT: Cfg = { enabled: false, time: "08:00", group_ids: [], template: null, use_ai: true };

const AtisBirthdayAuto = () => {
  const [cfg, setCfg] = useState<Cfg>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: config } = await atisDb
        .from("atis_notification_configs")
        .select("*")
        .eq("source_key", "legacy:atis_birthday_greeting")
        .maybeSingle();

      if (config) {
        setCfg({
          enabled: config.enabled,
          time: config.send_times?.[0] || "08:00",
          group_ids: [],
          template: config.message_template,
          use_ai: config.use_ai,
        });
      }
    } catch (e) {
      console.error("Error loading birthday config", e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await atisDb.from("atis_notification_configs").update({
        enabled: cfg.enabled,
        send_times: [cfg.time],
        message_template: cfg.template,
        use_ai: cfg.use_ai,
      }).eq("source_key", "legacy:atis_birthday_greeting");

      if (error) throw error;
      toast.success("Configuração de Aniversário salva");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    setSendingNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("atis-birthday-greeting", {
        method: "POST",
        body: { force: true, is_manual: true },
      });
      if (error) {
        const errorData = await error.context?.json().catch(() => null);
        throw new Error(errorData?.details || errorData?.error || error.message || "Erro na Edge Function");
      }
      const d = data as any;
      if (d?.skipped || d?.reason === 'no-birthdays') {
        toast.message("Nenhum aniversariante hoje", { description: "Nada foi enviado." });
      } else if (d?.engineResult?.ok === false) {
        toast.error(`Falha no motor: ${d.engineResult.reason || d.engineResult.error}`);
      } else {
        toast.success(`Parabéns enviado com sucesso para todos os alvos ativos`);
      }
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message ?? e));
    } finally {
      setSendingNow(false);
    }
  };

  if (loading) return <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-6 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-4 border border-[hsl(var(--streak-orange))/40] shadow-lg shadow-[hsl(var(--streak-orange))/5]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Cake className="w-5 h-5 text-[hsl(var(--streak-orange))] mt-0.5" />
          <div>
            <p className="text-sm font-bold">Parabéns automático</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-0.5">
              Todo dia o Atis verifica se há aniversariantes e envia uma mensagem para os alvos configurados.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-[hsl(var(--streak-orange))]" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
          <span className="text-xs font-semibold">{cfg.enabled ? "Ativo" : "Desativado"}</span>
        </label>
      </div>

      <div className="p-3 rounded-xl bg-[hsl(var(--streak-orange))]/5 border border-[hsl(var(--streak-orange))]/20 flex items-start gap-2">
        <Users className="w-4 h-4 text-[hsl(var(--streak-orange))] shrink-0 mt-0.5" />
        <p className="text-[10px] text-[hsl(var(--dark-muted))] leading-relaxed">
          Os destinatários deste alerta agora são gerenciados de forma centralizada. 
          Vá em <strong>Automações V2</strong> e edite os <strong>Targets</strong> da configuração "Aniversariantes".
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> Horário (Fortaleza)</label>
          <input type="time" value={cfg.time} onChange={(e) => setCfg({ ...cfg, time: e.target.value })}
            className="w-full h-10 px-3 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-sm" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Modo da mensagem</label>
          <div className="h-10 flex items-center gap-3 px-3 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-xs">
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={cfg.use_ai && !cfg.template} onChange={() => setCfg({ ...cfg, use_ai: true, template: null })} /> IA (Gemini)
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={!!cfg.template || !cfg.use_ai} onChange={() => setCfg({ ...cfg, use_ai: false, template: cfg.template ?? "" })} /> Modelo fixo
            </label>
          </div>
        </div>
      </div>

      {(!cfg.use_ai || cfg.template !== null) && (
        <div>
          <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase mb-1 block">
            Modelo personalizado — variáveis: <code className="text-primary">{"{nomes}"}</code> <code className="text-primary">{"{lista}"}</code> <code className="text-primary">{"{saudacao}"}</code>
          </label>
          <textarea
            rows={5}
            value={cfg.template ?? ""}
            onChange={(e) => setCfg({ ...cfg, template: e.target.value })}
            placeholder={"🎂 {saudacao}, família!\n\nHoje é dia de festa! Parabéns a:\n{lista}\n\nQue Deus abençoe grandemente. 🙏"}
            className="w-full px-3 py-2 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-sm font-mono"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="flex-1 h-10 rounded-xl bg-[hsl(var(--streak-orange))] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
        </button>
        <button onClick={sendNow} disabled={sendingNow}
          className="flex-1 h-10 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--streak-orange))/40] text-[hsl(var(--streak-orange))] font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {sendingNow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar agora
        </button>
      </div>
    </div>
  );
};

export default AtisBirthdayAuto;