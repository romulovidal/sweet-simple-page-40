import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Clock, Users, Send, Save } from "lucide-react";

type Group = { id: string; wa_group_id: string; name: string };
type Cfg = { enabled: boolean; time: string; group_ids: string[]; last_sent_date?: string };

const DEFAULT: Cfg = { enabled: false, time: "06:30", group_ids: [] };

const AtisDailyDevotional = () => {
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
        .eq("source_key", "legacy:atis_daily_devotional")
        .maybeSingle();

      if (config) {
        setCfg({
          enabled: config.enabled,
          time: config.send_times?.[0] || "06:30",
          group_ids: [], // Not used in V2 model here anymore
        });
      }
    } catch (e) {
      console.error("Error loading devotional config", e);
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
      }).eq("source_key", "legacy:atis_daily_devotional");

      if (error) throw error;
      toast.success("Configurações do Devocional salvas");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    setSendingNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("atis-daily-devotional", {
        method: "POST",
        body: { force: true },
      });
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      toast.success(`Devocional enviado para ${sent} grupo(s)`);
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message ?? e));
    } finally {
      setSendingNow(false);
    }
  };

  if (loading) return <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-6 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-4 border border-primary/20 shadow-lg shadow-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="w-5 h-5 text-primary mt-0.5 animate-pulse" />
          <div>
            <p className="text-sm font-bold">Devocional diário automático</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-0.5">
              Envia todo dia o versículo do dia da Bíblia Atalaia + frase motivacional via IA.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-primary"
            checked={cfg.enabled}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
          />
          <span className="text-xs font-semibold">{cfg.enabled ? "Ativo" : "Desativado"}</span>
        </label>
      </div>

      <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2">
        <Users className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[10px] text-[hsl(var(--dark-muted))] leading-relaxed">
          Os destinatários (grupos/pessoas) deste devocional agora são gerenciados de forma centralizada. 
          Vá em <strong>Automações V2</strong> e edite os <strong>Targets</strong> da configuração "Devocional Diário".
        </p>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> Horário (Fortaleza)</label>
        <input
          type="time"
          value={cfg.time}
          onChange={(e) => setCfg({ ...cfg, time: e.target.value })}
          className="w-full h-10 px-3 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-sm"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </button>
        <button
          onClick={sendNow}
          disabled={sendingNow}
          className="flex-1 h-10 rounded-xl bg-[hsl(var(--dark-bg))] border border-primary/40 text-primary font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {sendingNow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar agora
        </button>
      </div>
    </div>
  );
};

export default AtisDailyDevotional;