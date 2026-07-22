import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, CalendarClock, BookOpen, Settings, ArrowLeft, Cake, Bot, ListTree } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import atisAvatarAsset from "@/assets/atis-avatar.png.asset.json";
const atisAvatar = atisAvatarAsset.url;
import AtisDashboard from "./AtisDashboard";
import AtisContacts from "./AtisContacts";
import AtisGroups from "./AtisGroups";
import AtisBirthdays from "./AtisBirthdays";
import AtisBroadcasts from "./AtisBroadcasts";
import AtisStudies from "./AtisStudies";
import AtisConfig from "./AtisConfig";
import AtisLogs from "./AtisLogs";

type TabId = "dashboard" | "contacts" | "groups" | "birthdays" | "broadcasts" | "studies" | "logs" | "config";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard },
  { id: "contacts", label: "Contatos", icon: Users },
  { id: "groups", label: "Grupos", icon: Bot },
  { id: "birthdays", label: "Aniversários", icon: Cake },
  { id: "broadcasts", label: "Agenda", icon: CalendarClock },
  { id: "studies", label: "Estudos", icon: BookOpen },
  { id: "logs", label: "Logs", icon: ListTree },
  { id: "config", label: "Config", icon: Settings },
];

const MOBILE_BOTTOM: TabId[] = ["dashboard", "contacts", "broadcasts", "studies", "config"];

const AtisLayout = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("dashboard");

  const renderTab = () => {
    switch (tab) {
      case "dashboard": return <AtisDashboard onNavigate={setTab} />;
      case "contacts": return <AtisContacts />;
      case "groups": return <AtisGroups />;
      case "birthdays": return <AtisBirthdays />;
      case "broadcasts": return <AtisBroadcasts />;
      case "studies": return <AtisStudies />;
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
            <img src={atisAvatar} alt="Atis" width={40} height={40} className="w-10 h-10 rounded-2xl shadow-lg" />
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
                <img src={atisAvatar} alt="Atis" width={32} height={32} className="w-8 h-8 rounded-xl" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{activeMeta.label}</p>
                <p className="text-[10px] text-[hsl(var(--dark-muted))]">Painel Atis</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[hsl(var(--dark-muted))] px-2 py-1 rounded-full bg-[hsl(var(--dark-card))]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Evolution offline
            </span>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 lg:px-8 py-5">{renderTab()}</main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--dark-card))] border-t border-[hsl(var(--dark-card-hover))]">
          <div className="flex items-center justify-around h-16">
            {MOBILE_BOTTOM.map((id) => {
              const meta = TABS.find((t) => t.id === id)!;
              const Icon = meta.icon;
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
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