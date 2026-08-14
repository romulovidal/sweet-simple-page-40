import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Cake, Clock, Users, Send, Save, Sparkles } from "lucide-react";
const DEFAULT = { enabled: false, time: "08:00", group_ids: [], template: null, use_ai: true };
const AtisBirthdayAuto = () => {
    const [cfg, setCfg] = useState(DEFAULT);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingNow, setSendingNow] = useState(false);
    const load = async () => {
        setLoading(true);
        try {
            const [{ data: config }, { data: gs }] = await Promise.all([
                atisDb.from("atis_notification_configs").select("*").eq("source_key", "legacy:atis_birthday_greeting").maybeSingle(),
                atisDb.from("atis_groups").select("id,wa_group_id,name").eq("active", true).order("name"),
            ]);
            if (config) {
                setCfg({
                    enabled: config.enabled,
                    time: config.send_times?.[0] || "08:00",
                    group_ids: [], // Targets serão carregados separadamente ou via V2
                    template: config.message_template,
                    use_ai: config.use_ai,
                });
            }
            setGroups((gs ?? []));
        }
        catch (e) {
            console.error("Error loading birthday config", e);
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
                message_template: cfg.template,
                use_ai: cfg.use_ai,
            }).eq("source_key", "legacy:atis_birthday_greeting");
            if (error)
                throw error;
            toast.success("Aniversário automático (V2) salvo");
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
            const { data, error } = await supabase.functions.invoke("atis-birthday-greeting", {
                method: "POST",
                body: { force: true },
            });
            if (error)
                throw error;
            const d = data;
            if (d?.skipped)
                toast.message("Nenhum aniversariante hoje", { description: "Nada foi enviado." });
            else
                toast.success(`Parabéns enviado para ${d?.sent ?? 0} grupo(s) — ${(d?.names ?? []).join(", ")}`);
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
    return (<div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-4 border border-[hsl(var(--streak-orange))/40] shadow-lg shadow-[hsl(var(--streak-orange))/5]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Cake className="w-5 h-5 text-[hsl(var(--streak-orange))] mt-0.5"/>
          <div>
            <p className="text-sm font-bold">Parabéns automático (grupos)</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-0.5">
              Todo dia, no horário definido (Fortaleza), o Atis verifica se há aniversariantes e envia uma mensagem para os grupos selecionados.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-[hsl(var(--streak-orange))]" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}/>
          <span className="text-xs font-semibold">{cfg.enabled ? "Ativo" : "Desativado"}</span>
        </label>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase flex items-center gap-1 mb-1"><Clock className="w-3 h-3"/> Horário (Fortaleza)</label>
          <input type="time" value={cfg.time} onChange={(e) => setCfg({ ...cfg, time: e.target.value })} className="w-full h-10 px-3 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-sm"/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3"/> Modo da mensagem</label>
          <div className="h-10 flex items-center gap-3 px-3 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-xs">
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={cfg.use_ai && !cfg.template} onChange={() => setCfg({ ...cfg, use_ai: true, template: null })}/> IA (Gemini)
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={!!cfg.template || !cfg.use_ai} onChange={() => setCfg({ ...cfg, use_ai: false, template: cfg.template ?? "" })}/> Modelo fixo
            </label>
          </div>
        </div>
      </div>

      {(!cfg.use_ai || cfg.template !== null) && (<div>
          <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase mb-1 block">
            Modelo personalizado — variáveis: <code className="text-primary">{"{nomes}"}</code> <code className="text-primary">{"{lista}"}</code> <code className="text-primary">{"{saudacao}"}</code>
          </label>
          <textarea rows={5} value={cfg.template ?? ""} onChange={(e) => setCfg({ ...cfg, template: e.target.value })} placeholder={"🎂 {saudacao}, família!\n\nHoje é dia de festa! Parabéns a:\n{lista}\n\nQue Deus abençoe grandemente. 🙏"} className="w-full px-3 py-2 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-sm font-mono"/>
          <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">Deixe vazio para usar a IA. Com texto aqui, o modelo fixo tem prioridade.</p>
        </div>)}

      <div>
        <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase flex items-center gap-1 mb-2">
          <Users className="w-3 h-3"/> Grupos que vão receber ({cfg.group_ids.length}/{groups.length})
        </label>
        {groups.length === 0 ? (<p className="text-xs text-[hsl(var(--dark-muted))] italic">Nenhum grupo importado. Vá em Grupos.</p>) : (<div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {groups.map((g) => {
                const checked = cfg.group_ids.includes(g.wa_group_id);
                return (<label key={g.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${checked ? "bg-[hsl(var(--streak-orange))/10]" : "bg-[hsl(var(--dark-bg))] hover:bg-[hsl(var(--dark-card-hover))]"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleGroup(g.wa_group_id)} className="w-4 h-4 accent-[hsl(var(--streak-orange))]"/>
                  <span className="text-xs font-medium truncate">{g.name}</span>
                </label>);
            })}
          </div>)}
      </div>

      {cfg.last_sent_date && (<p className="text-[10px] text-[hsl(var(--dark-muted))] italic">Último envio automático: {cfg.last_sent_date}</p>)}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 h-10 rounded-xl bg-[hsl(var(--streak-orange))] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Salvar
        </button>
        <button onClick={sendNow} disabled={sendingNow} className="flex-1 h-10 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--streak-orange))/40] text-[hsl(var(--streak-orange))] font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {sendingNow ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} Enviar agora
        </button>
      </div>
    </div>);
};
export default AtisBirthdayAuto;
