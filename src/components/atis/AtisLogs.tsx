import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { Loader2, Search, Filter, ExternalLink, AlertCircle, CheckCircle2, Clock } from "lucide-react";

type Log = {
  id: string;
  config_name: string;
  recipient_key: string;
  recipient_type: string;
  status: string;
  scheduled_for: string;
  processed_at: string | null;
  attempts: number;
  last_error: string | null;
};

const AtisLogs = () => {
  const [items, setItems] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    // Join simulado via config_id
    const { data } = await atisDb.from("atis_automation_logs")
      .select(`
        *,
        atis_notification_configs ( name )
      `)
      .order("created_at", { ascending: false })
      .limit(50);
    
    setItems((data || []).map((d: any) => ({
      ...d,
      config_name: d.atis_notification_configs?.name || "Desconhecida"
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      case 'processing': return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      default: return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dark-muted))]" />
          <input 
            value={q} 
            onChange={e => setQ(e.target.value)} 
            placeholder="Filtrar logs..." 
            className="w-full h-10 rounded-xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] pl-9 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]">
          <Filter className="w-4 h-4" />
        </button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-[hsl(var(--dark-muted))]">Nenhum log encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] border-b border-[hsl(var(--dark-card-hover))]">
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Automação / Destinatário</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Status</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Horário</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--dark-card-hover))]">
                {items.map(log => (
                  <tr key={log.id} className="hover:bg-[hsl(var(--dark-bg))]/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-[hsl(var(--dark-text))]">{log.config_name}</p>
                      <p className="text-[10px] text-[hsl(var(--dark-muted))] font-mono mt-0.5">{log.recipient_key}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        {getStatusIcon(log.status)}
                        <span className="text-[10px] font-bold uppercase">{log.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--dark-muted))] leading-tight">
                      <p>{new Date(log.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-[9px]">{new Date(log.scheduled_for).toLocaleDateString('pt-BR')}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AtisLogs;
