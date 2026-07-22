import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";

type Log = { id: string; direction: "in" | "out"; wa_from: string | null; wa_to: string | null; wa_group_id: string | null; body: string | null; command: string | null; status: string | null; created_at: string };

const AtisLogs = () => {
  const [items, setItems] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await atisDb.from("atis_messages_log").select("*").order("created_at", { ascending: false }).limit(100);
      setItems((data ?? []) as Log[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
      <p className="text-sm font-bold mb-3">Últimas mensagens (100)</p>
      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : items.length === 0 ? (
        <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Sem logs. Conecte o Evolution para começar.</p>
      ) : (
        <ul className="divide-y divide-[hsl(var(--dark-card-hover))]">
          {items.map(l => (
            <li key={l.id} className="py-2.5 flex items-start gap-3">
              <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${l.direction === "in" ? "bg-blue-500/15 text-blue-400" : "bg-green-500/15 text-green-400"}`}>
                {l.direction === "in" ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[hsl(var(--dark-muted))]">
                  {l.direction === "in" ? `de ${l.wa_from}` : `para ${l.wa_to}`}{l.wa_group_id && ` · grupo ${l.wa_group_id}`}{l.command && ` · /${l.command}`}
                </p>
                <p className="text-sm truncate">{l.body}</p>
                <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-0.5">{new Date(l.created_at).toLocaleString("pt-BR")}{l.status && ` · ${l.status}`}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AtisLogs;