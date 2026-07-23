import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { Users, Cake, CalendarClock, BookOpen, MessageCircle, Bot, WifiOff, Wifi, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useAtisStatus } from "./useAtisStatus";

type Stats = { contacts: number; groups: number; birthdaysToday: number; pending: number; studies: number; messages24h: number };
type UpcomingBroadcast = { id: string; title: string; scheduled_at: string | null; status: string; recurrence: string | null; target_type: string };
type Plan = { id: string; title: string; category: string | null; total_days: number | null; is_active: boolean };

const AtisDashboard = ({ onNavigate }: { onNavigate: (tab: any) => void }) => {
  const [stats, setStats] = useState<Stats>({ contacts: 0, groups: 0, birthdaysToday: 0, pending: 0, studies: 0, messages24h: 0 });
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<UpcomingBroadcast[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const status = useAtisStatus();

  useEffect(() => {
    (async () => {
      const today = new Date();
      const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const [c, g, b, br, st, ml, upc, pl] = await Promise.all([
        atisDb.from("atis_contacts").select("id", { count: "exact", head: true }),
        atisDb.from("atis_groups").select("id", { count: "exact", head: true }),
        atisDb.from("atis_birthdays").select("id, birth_date").eq("active", true),
        atisDb.from("atis_broadcasts").select("id", { count: "exact", head: true }).eq("status", "pending"),
        atisDb.from("atis_studies").select("id", { count: "exact", head: true }),
        atisDb.from("atis_messages_log").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
        atisDb.from("atis_broadcasts").select("id,title,scheduled_at,status,recurrence,target_type").in("status", ["pending", "scheduled"]).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(5),
        atisDb.from("admin_plans").select("id,title,category,total_days,is_active").eq("is_active", true).order("sort_order", { ascending: true }).limit(6),
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
      setUpcoming((upc.data ?? []) as UpcomingBroadcast[]);
      setPlans((pl.data ?? []) as Plan[]);
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

  const online = status.connected;
  const StatusIcon = status.loading ? Loader2 : online ? Wifi : WifiOff;
  const bannerGrad = online
    ? "from-[hsl(150,70%,35%)] to-[hsl(180,60%,32%)]"
    : status.state === "connecting"
    ? "from-[hsl(38,90%,45%)] to-[hsl(20,85%,40%)]"
    : "from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)]";

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl p-5 bg-gradient-to-br ${bannerGrad} text-white flex items-start gap-4`}>
        <span className="w-12 h-12 rounded-2xl bg-white/15 grid place-items-center backdrop-blur">
          <StatusIcon className={`w-6 h-6 ${status.loading ? "animate-spin" : ""}`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold">
            {status.loading
              ? "Verificando conexão…"
              : online
              ? "WhatsApp do Atis conectado"
              : status.state === "connecting"
              ? "Conectando ao WhatsApp…"
              : status.state === "error"
              ? "Erro ao consultar Evolution API"
              : "Evolution API desconectada"}
          </p>
          <p className="text-xs opacity-90 mt-1">
            {online ? (
              <>Pronto para enviar e responder. Última checagem: {status.lastCheckedAt?.toLocaleTimeString("pt-BR")}.</>
            ) : (
              <>
                Abra <button onClick={() => onNavigate("config")} className="underline font-semibold">Config → Conectar</button> e escaneie o QR Code para ligar o Atis.
              </>
            )}
          </p>
        </div>
        <button
          onClick={status.refresh}
          className="shrink-0 text-[10px] font-semibold bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1.5"
        >
          Atualizar
        </button>
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

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> Próximos envios</p>
          <button onClick={() => onNavigate("broadcasts")} className="text-[11px] font-semibold text-primary">Ver todos</button>
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin mx-auto my-3" />
        ) : upcoming.length === 0 ? (
          <p className="text-xs text-[hsl(var(--dark-muted))] text-center py-4">Nenhum envio agendado. Toque em Agenda para criar.</p>
        ) : (
          <ul className="space-y-1.5">
            {upcoming.map((u) => (
              <li key={u.id} className="flex items-center gap-3 text-sm py-2 px-3 rounded-lg bg-[hsl(var(--dark-bg))]">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{u.title}</p>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))]">
                    {u.scheduled_at ? new Date(u.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }) : "sem data"} · {u.recurrence ?? "once"} · {u.target_type}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase text-yellow-500">{u.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Planos da Bíblia ativos</p>
          <button onClick={() => onNavigate("studies")} className="text-[11px] font-semibold text-primary">Ver todos</button>
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin mx-auto my-3" />
        ) : plans.length === 0 ? (
          <p className="text-xs text-[hsl(var(--dark-muted))] text-center py-4">Nenhum plano ativo cadastrado no app.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {plans.map((p) => (
              <div key={p.id} className="rounded-xl bg-[hsl(var(--dark-bg))] p-3">
                <p className="text-xs font-bold truncate">{p.title}</p>
                <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-0.5">
                  {p.category ?? "Geral"} · {p.total_days ?? 0}d
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] text-green-500 font-semibold mt-1">
                  <CheckCircle2 className="w-3 h-3" /> Ativo
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AtisDashboard;