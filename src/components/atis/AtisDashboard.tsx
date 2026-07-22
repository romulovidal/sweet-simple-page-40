import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { Users, Cake, CalendarClock, BookOpen, MessageCircle, Bot, WifiOff } from "lucide-react";

type Stats = { contacts: number; groups: number; birthdaysToday: number; pending: number; studies: number; messages24h: number };

const AtisDashboard = ({ onNavigate }: { onNavigate: (tab: any) => void }) => {
  const [stats, setStats] = useState<Stats>({ contacts: 0, groups: 0, birthdaysToday: 0, pending: 0, studies: 0, messages24h: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date();
      const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const [c, g, b, br, st, ml] = await Promise.all([
        atisDb.from("atis_contacts").select("id", { count: "exact", head: true }),
        atisDb.from("atis_groups").select("id", { count: "exact", head: true }),
        atisDb.from("atis_birthdays").select("id, birth_date").eq("active", true),
        atisDb.from("atis_broadcasts").select("id", { count: "exact", head: true }).eq("status", "pending"),
        atisDb.from("atis_studies").select("id", { count: "exact", head: true }),
        atisDb.from("atis_messages_log").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      ]);
      const birthdaysToday = (b.data ?? []).filter((r: any) => {
        const d = new Date(r.birth_date);
        return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === mmdd;
      }).length;
      setStats({
        contacts: c.count ?? 0,
        groups: g.count ?? 0,
        birthdaysToday,
        pending: br.count ?? 0,
        studies: st.count ?? 0,
        messages24h: ml.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Contatos", value: stats.contacts, icon: Users, tab: "contacts" },
    { label: "Grupos", value: stats.groups, icon: Bot, tab: "groups" },
    { label: "Aniversários hoje", value: stats.birthdaysToday, icon: Cake, tab: "birthdays" },
    { label: "Envios pendentes", value: stats.pending, icon: CalendarClock, tab: "broadcasts" },
    { label: "Estudos", value: stats.studies, icon: BookOpen, tab: "studies" },
    { label: "Mensagens 24h", value: stats.messages24h, icon: MessageCircle, tab: "logs" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] text-white flex items-start gap-4">
        <span className="w-12 h-12 rounded-2xl bg-white/15 grid place-items-center backdrop-blur">
          <WifiOff className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold">Evolution API desconectada</p>
          <p className="text-xs opacity-90 mt-1">
            Configure a URL, a chave e a instância em <button onClick={() => onNavigate("config")} className="underline">Config</button> para o Atis começar a responder.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(({ label, value, icon: Icon, tab }) => (
          <button
            key={label}
            onClick={() => onNavigate(tab)}
            className="text-left rounded-2xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] p-4 transition-colors"
          >
            <Icon className="w-5 h-5 text-primary mb-3" />
            <p className="text-2xl font-bold">{loading ? "—" : value}</p>
            <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">{label}</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-5">
        <p className="text-sm font-bold mb-3">Próximos passos</p>
        <ol className="space-y-2 text-sm text-[hsl(var(--dark-muted))] list-decimal list-inside">
          <li>Subir uma instância da Evolution API (Railway) e informar URL + chave em Config.</li>
          <li>Cadastrar contatos e grupos que o Atis vai atender.</li>
          <li>Cadastrar aniversariantes e estudos ministeriais.</li>
          <li>Agendar broadcasts recorrentes (versículo do dia, culto, etc.).</li>
        </ol>
      </div>
    </div>
  );
};

export default AtisDashboard;