import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Clock, Users, Send, Save } from "lucide-react";
const DEFAULT = { enabled: false, time: "06:30", group_ids: [] };
const AtisDailyDevotional = () => {
    const [cfg, setCfg] = useState(DEFAULT);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingNow, setSendingNow] = useState(false);
    const load = async () => {
        setLoading(true);
        try {
            const [{ data: config }, { data: gs }] = await Promise.all([
                atisDb.from("atis_notification_configs").select("*").eq("source_key", "legacy:atis_daily_devotional").maybeSingle(),
                atisDb.from("atis_groups").select("id,wa_group_id,name").eq("active", true).order("name"),
            ]);
            if (config) {
                setCfg({
                    enabled: config.enabled,
                    time: config.send_times?.[0] || "06:30",
                    group_ids: [],
                });
            }
            setGroups((gs ?? []));
        }
        catch (e) {
            console.error("Error loading devotional config", e);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);
    const toggleGroup = (jid) => {
        toast.error("Para gerenciar alvos de sistema, utilize a aba de Automações V2.");
    };
    const save = async () => {
        setSaving(true);
        try {
            const { error } = await atisDb.from("atis_notification_configs").update({
                enabled: cfg.enabled,
                send_times: [cfg.time],
            }).eq("source_key", "legacy:atis_daily_devotional");
            if (error)
                throw error;
            toast.success("Devocional diário (V2) salvo");
        }
        catch (e) {
            toast.error("Erro ao salvar: " + e.message);
        }
        finally {
            setSaving(false);
        }
    };
    const sendNow = async () => {
        if (!cfg.group_ids.length)
            return toast.error("Selecione ao menos um grupo antes");
        setSendingNow(true);
        try {
            const { data, error } = await supabase.functions.invoke("atis-daily-devotional", {
                method: "POST",
                body: { force: true },
            });
            if (error)
                throw error;
            const sent = data?.sent ?? 0;
            toast.success(`Devocional enviado para ${sent} grupo(s)`);
        }
        catch (e) {
            toast.error("Erro ao enviar: " + (e?.message ?? e));
        }
        finally {
            setSendingNow(false);
        }
    };
    if (loading)
        return <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-6 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin"/></div>;
    return (<div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-4 border border-primary/20 shadow-lg shadow-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="w-5 h-5 text-primary mt-0.5 animate-pulse"/>
          <div>
            <p className="text-sm font-bold">Devocional diário automático (grupos)</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-0.5">
              Envia todo dia, no horário definido (Fortaleza-CE), o mesmo versículo do dia da Bíblia Atalaia + a frase motivacional gerada por IA, direto para os grupos escolhidos. Requer versículo agendado no painel admin.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-primary" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}/>
          <span className="text-xs font-semibold">{cfg.enabled ? "Ativo" : "Desativado"}</span>
        </label>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase flex items-center gap-1 mb-1"><Clock className="w-3 h-3"/> Horário (Fortaleza)</label>
        <input type="time" value={cfg.time} onChange={(e) => setCfg({ ...cfg, time: e.target.value })} className="w-full h-10 px-3 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-sm"/>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase flex items-center gap-1 mb-2">
          <Users className="w-3 h-3"/> Grupos que vão receber ({cfg.group_ids.length}/{groups.length})
        </label>
        {groups.length === 0 ? (<p className="text-xs text-[hsl(var(--dark-muted))] italic">
            Nenhum grupo importado. Vá em Grupos → Buscar grupos do WhatsApp.
          </p>) : (<div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {groups.map((g) => {
                const checked = cfg.group_ids.includes(g.wa_group_id);
                return (<label key={g.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${checked ? "bg-primary/10" : "bg-[hsl(var(--dark-bg))] hover:bg-[hsl(var(--dark-card-hover))]"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleGroup(g.wa_group_id)} className="w-4 h-4 accent-primary"/>
                  <span className="text-xs font-medium truncate">{g.name}</span>
                </label>);
            })}
          </div>)}
      </div>

      {cfg.last_sent_date && (<p className="text-[10px] text-[hsl(var(--dark-muted))] italic">
          Último envio automático: {cfg.last_sent_date}
        </p>)}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
          Salvar
        </button>
        <button onClick={sendNow} disabled={sendingNow} className="flex-1 h-10 rounded-xl bg-[hsl(var(--dark-bg))] border border-primary/40 text-primary font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {sendingNow ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
          Enviar agora
        </button>
      </div>
    </div>);
};
export default AtisDailyDevotional;
