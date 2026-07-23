import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Check, ExternalLink, ShieldCheck } from "lucide-react";

type Alert = {
  id: string; contact_phone: string; contact_name: string | null;
  matched_keywords: string[]; severity: string; snippet: string | null;
  pastor_notified: boolean; handled: boolean; created_at: string;
};

const AtisAlerts = () => {
  const [list, setList] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = async () => {
    setLoading(true);
    let q = atisDb.from("atis_crisis_alerts").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "open") q = q.eq("handled", false);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setList((data as Alert[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const markHandled = async (id: string) => {
    const { error } = await atisDb.from("atis_crisis_alerts").update({ handled: true, handled_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Alertas pastorais</h2>
          <p className="text-sm text-[hsl(var(--dark-muted))]">Mensagens com sinais de crise detectados pelo Atis.</p>
        </div>
        <div className="flex gap-1 bg-[hsl(var(--dark-card))] rounded-lg p-1">
          {(["open", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded text-[11px] font-semibold ${filter === f ? "bg-primary text-primary-foreground" : "text-[hsl(var(--dark-muted))]"}`}>
              {f === "open" ? "Abertos" : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-8 text-primary" /> :
        !list.length ? (
          <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-8 text-center">
            <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhum alerta {filter === "open" ? "aberto" : ""}. Que a paz de Cristo continue!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((a) => (
              <div key={a.id} className={`bg-[hsl(var(--dark-card))] rounded-2xl p-4 border-l-4 ${a.severity === "high" ? "border-red-500" : "border-amber-500"}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${a.severity === "high" ? "text-red-400" : "text-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm">{a.contact_name ?? "Sem nome"}</p>
                      <span className="text-[10px] text-[hsl(var(--dark-muted))]">{a.contact_phone}</span>
                      {a.pastor_notified && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">pastor avisado</span>}
                      {a.handled && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">atendido</span>}
                    </div>
                    {a.snippet && <p className="text-xs mt-2 bg-[hsl(var(--dark-bg))] p-2 rounded whitespace-pre-wrap">{a.snippet}</p>}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {a.matched_keywords.map((k) => (
                        <span key={k} className="text-[9px] bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] px-1.5 py-0.5 rounded font-mono">{k}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-2">{new Date(a.created_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <a href={`https://wa.me/${a.contact_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg bg-green-500/20 text-green-400" title="Abrir no WhatsApp">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {!a.handled && (
                      <button onClick={() => markHandled(a.id)} className="p-1.5 rounded-lg bg-primary/20 text-primary" title="Marcar atendido">
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

export default AtisAlerts;