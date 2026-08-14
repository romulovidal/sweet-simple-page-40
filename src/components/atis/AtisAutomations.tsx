import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Search, Bell, BellOff, Settings2, History, Info, Play } from "lucide-react";

type Automation = {
  id: string;
  name: string;
  notification_type: string;
  enabled: boolean;
  automation_mode: string;
  send_times: string[];
  days_of_week: number[];
  source_key: string | null;
};

const AtisAutomations = () => {
  const [items, setItems] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await atisDb.from("atis_notification_configs").select("*").order("name");
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async (id: string, current: boolean) => {
    const { error } = await atisDb.from("atis_notification_configs").update({ enabled: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const filtered = items.filter(i => 
    !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.notification_type.includes(q)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dark-muted))]" />
          <input 
            value={q} 
            onChange={e => setQ(e.target.value)} 
            placeholder="Buscar automação..." 
            className="w-full h-11 rounded-xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] pl-9 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <button className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Criar
        </button>
      </div>

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto my-8 text-primary" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(i => (
            <div key={i.id} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4 space-y-3 transition-all hover:border-primary/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${i.enabled ? 'bg-green-500' : 'bg-[hsl(var(--dark-muted))]'}`} />
                    <h3 className="font-bold text-sm truncate">{i.name}</h3>
                  </div>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] uppercase font-semibold tracking-wider">
                    {i.notification_type.replace('-', ' ')} • {i.automation_mode}
                  </p>
                </div>
                <button 
                  onClick={() => toggleEnabled(i.id, i.enabled)}
                  className={`p-2 rounded-xl transition-colors ${i.enabled ? 'text-primary bg-primary/10' : 'text-[hsl(var(--dark-muted))] bg-[hsl(var(--dark-bg))]'}`}
                >
                  {i.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-[hsl(var(--dark-muted))] py-1 border-y border-[hsl(var(--dark-card-hover))]/50">
                <div className="flex items-center gap-1.5">
                  <Play className="w-3 h-3" />
                  <span>{i.send_times.join(', ')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <History className="w-3 h-3" />
                  <span>{i.days_of_week.length === 7 ? 'Diário' : `${i.days_of_week.length} dias`}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button className="flex-1 h-9 rounded-lg bg-[hsl(var(--dark-bg))] text-xs font-semibold flex items-center justify-center gap-1.5 border border-[hsl(var(--dark-card-hover))]">
                  <Settings2 className="w-3.5 h-3.5" /> Configurar
                </button>
                <button className="h-9 w-9 rounded-lg bg-[hsl(var(--dark-bg))] flex items-center justify-center border border-[hsl(var(--dark-card-hover))]">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AtisAutomations;
