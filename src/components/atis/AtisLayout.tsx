import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, CalendarClock, BookOpen, Settings, ArrowLeft, Cake, Bot, ListTree, MessageCircle, Sparkles, Library, AlertTriangle, Church } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import atisAvatarAsset from "@/assets/atis-avatar.png.asset.json";
const atisAvatar = atisAvatarAsset.url;
import AtisDashboard from "./AtisDashboard";
import AtisContacts from "./AtisContacts";
import AtisGroups from "./AtisGroups";
import AtisIndividuals from "./AtisIndividuals";
import AtisBirthdays from "./AtisBirthdays";
import AtisBroadcasts from "./AtisBroadcasts";
import AtisStudies from "./AtisStudies";
import AtisConfig from "./AtisConfig";
import AtisLogs from "./AtisLogs";
import AtisSeries from "./AtisSeries";
import AtisPlansWA from "./AtisPlansWA";
import AtisAlerts from "./AtisAlerts";
import { useAtisStatus } from "./useAtisStatus";
import AdminCultoSelections from "../admin/AdminCultoSelections";

type TabId = "dashboard" | "contacts" | "groups" | "individuals" | "birthdays" | "broadcasts" | "studies" | "series" | "plans" | "alerts" | "logs" | "config" | "selections";

const resolveAtisAvatar = () => {
  const path = atisAvatarAsset.url;
  if (typeof window === "undefined") return path;
  if (window.location.hostname === "biblia.atalaias.online") {
    return `https://biblia-atalaia.lovable.app${path}`;
  }
  return path;
};

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard },
  { id: "selections", label: "Cultos", icon: Church },
  { id: "contacts", label: "Contatos", icon: Users },
  { id: "groups", label: "Grupos", icon: Bot },
  { id: "individuals", label: "Individuais", icon: MessageCircle },
  { id: "birthdays", label: "Aniversários", icon: Cake },
  { id: "broadcasts", label: "Agenda", icon: CalendarClock },
  { id: "studies", label: "Estudos", icon: BookOpen },
  { id: "series", label: "Séries", icon: Sparkles },
  { id: "plans", label: "Planos WA", icon: Library },
  { id: "alerts", label: "Alertas", icon: AlertTriangle },
  { id: "logs", label: "Logs", icon: ListTree },
  { id: "config", label: "Config", icon: Settings },
];

const MOBILE_BOTTOM: TabId[] = ["dashboard", "selections", "contacts", "groups", "individuals", "broadcasts", "birthdays", "studies", "series", "plans", "alerts", "logs", "config"];

const AtisLayout = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("dashboard");
  const status = useAtisStatus();
  const atisAvatarUrl = resolveAtisAvatar();

  const renderTab = () => {
    switch (tab) {
      case "dashboard": return <AtisDashboard onNavigate={setTab} />;
      case "selections": return <AdminCultoSelections />;
      case "contacts": return <AtisContacts />;
      case "groups": return <AtisGroups />;
      case "individuals": return <AtisIndividuals />;
      case "birthdays": return <AtisBirthdays />;
      case "broadcasts": return <AtisBroadcasts />;
      case "studies": return <AtisStudies />;
      case "series": return <AtisSeries />;
      case "plans": return <AtisPlansWA />;
      case "alerts": return <AtisAlerts />;
      case "logs": return <AtisLogs />;
      case "config": return <AtisConfig />;
    }
  };

  const activeMeta = TABS.find((t) => t.id === tab)!;

  return (
    <div className="min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))]">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="fixed left-0 top-0 bottom-0 w-64 z-40 bg-[hsl(var(--dark-card))] border-r border-[hsl(var(--dark-card-hover))] flex flex-col">
          <div className="px-5 pt-6 pb-5 flex items-center gap-3 border-b border-[hsl(var(--dark-card-hover))]">
            <img src={atisAvatarUrl} alt="Atis" width={40} height={40} className="w-10 h-10 rounded-2xl shadow-lg object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">Atis</p>
              <p className="text-xs text-[hsl(var(--dark-muted))]">Bot ministerial</p>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${
                  tab === id
                    ? "bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))]"
                    : "text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card-hover))]/60 hover:text-[hsl(var(--dark-text))]"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-[hsl(var(--dark-card-hover))]">
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card-hover))]/60 hover:text-[hsl(var(--dark-text))]"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao Admin
            </button>
          </div>
        </aside>
      )}

      <div className={isMobile ? "pb-20" : "lg:pl-64"}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[hsl(var(--dark-bg))]/90 backdrop-blur border-b border-[hsl(var(--dark-card-hover))]">
          <div className="max-w-5xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {isMobile && (
                <button onClick={() => navigate("/admin")} className="p-1 -ml-1" aria-label="Voltar">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              {isMobile && (
                <img src={atisAvatarUrl} alt="Atis" width={32} height={32} className="w-8 h-8 rounded-xl object-cover" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{activeMeta.label}</p>
                <p className="text-[10px] text-[hsl(var(--dark-muted))]">Painel Atis</p>
              </div>
            </div>
            <button
              onClick={() => setTab("config")}
              title={status.lastCheckedAt ? `Última checagem: ${status.lastCheckedAt.toLocaleTimeString("pt-BR")}` : ""}
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[hsl(var(--dark-muted))] px-2 py-1 rounded-full bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))]"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status.loading
                    ? "bg-yellow-500 animate-pulse"
                    : status.connected
                    ? "bg-green-500"
                    : status.state === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />
              {status.loading
                ? "Checando…"
                : status.connected
                ? "Evolution online"
                : status.state === "connecting"
                ? "Conectando…"
                : "Evolution offline"}
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 lg:px-8 py-5">{renderTab()}</main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--dark-card))] border-t border-[hsl(var(--dark-card-hover))]">
          <div className="flex items-center gap-1 h-16 overflow-x-auto px-2 no-scrollbar">
            {MOBILE_BOTTOM.map((id) => {
              const meta = TABS.find((t) => t.id === id)!;
              const Icon = meta.icon;
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[64px] transition-colors ${
                    active ? "text-[hsl(var(--dark-text))]" : "text-[hsl(var(--dark-muted))]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default AtisLayout;