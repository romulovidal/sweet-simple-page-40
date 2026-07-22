import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Loader2, Calendar, Users, LayoutDashboard, Bell, Shield,
  Clock, BookMarked, Home, Sparkles, BrainCircuit,
  Settings2, HandHeart, FileText, BookOpen, ChevronRight, LayoutGrid,
  ArrowLeft, MoreHorizontal, LineChart, Activity, Music2, Bot
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminDailyVerse from "@/components/admin/AdminDailyVerse";
import AdminPushSender from "@/components/admin/AdminPushSender";
import AdminRoles from "@/components/admin/AdminRoles";
import AdminActivityLog from "@/components/admin/AdminActivityLog";
import AdminCultoSchedule from "@/components/admin/AdminCultoSchedule";
import AdminAISettings from "@/components/admin/AdminAISettings";
import AdminAppFeatures from "@/components/admin/AdminAppFeatures";
import AdminPrayerRequests from "@/components/admin/AdminPrayerRequests";
import AdminAIInstructions from "@/components/admin/AdminAIInstructions";
import AdminPosts from "@/components/admin/AdminPosts";
import AdminPlans from "@/components/admin/AdminPlans";
import AdminUsers, { type UserProfile } from "@/components/admin/AdminUsers";
import AdminRetention from "@/components/admin/AdminRetention";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminHarpaReports from "@/components/admin/AdminHarpaReports";

type Post = Database["public"]["Tables"]["admin_posts"]["Row"];
type Plan = Database["public"]["Tables"]["admin_plans"]["Row"];

type ToolId = "dashboard" | "retention" | "analytics" | "posts" | "plans" | "verse" | "push" | "cultos" | "users" | "roles" | "log" | "ai" | "ai-prompts" | "app-features" | "prayers" | "harpa-reports";
type View = { kind: "home" } | { kind: "category"; id: string } | { kind: "tool"; id: ToolId };

const ADMIN_SECTIONS = [
  {
    id: "overview",
    title: "Visão Geral",
    subtitle: "Métricas e atividade",
    sectionIcon: LayoutDashboard,
    tabs: [
      { id: "dashboard", label: "Dashboard", desc: "Métricas e resumo", icon: LayoutDashboard },
      { id: "analytics", label: "Analytics", desc: "Eventos e uso", icon: Activity },
      { id: "retention", label: "Retenção", desc: "D1 · D7 · D30", icon: LineChart },
      { id: "log", label: "Atividade", desc: "Histórico de ações", icon: Clock },
    ],
  },
  {
    id: "content",
    title: "Conteúdo",
    subtitle: "Publicações e planos",
    sectionIcon: FileText,
    tabs: [
      { id: "posts", label: "Posts", desc: "Feed devocional", icon: FileText },
      { id: "plans", label: "Planos de Leitura", desc: "Trilhas bíblicas", icon: BookOpen },
      { id: "verse", label: "Versículo do Dia", desc: "Push diário", icon: BookMarked },
      { id: "cultos", label: "Escala de Cultos", desc: "Lembretes de culto", icon: Calendar },
    ],
  },
  {
    id: "community",
    title: "Comunidade",
    subtitle: "Interação e avisos",
    sectionIcon: HandHeart,
    tabs: [
      { id: "push", label: "Notificações Push", desc: "Envio manual", icon: Bell },
      { id: "prayers", label: "Pedidos de Oração", desc: "Moderação", icon: HandHeart },
      { id: "harpa-reports", label: "Relatos da Harpa", desc: "Erros reportados nos hinos", icon: Music2 },
    ],
  },
  {
    id: "ai",
    title: "Inteligência Artificial",
    subtitle: "Modelos e prompts",
    sectionIcon: Sparkles,
    tabs: [
      { id: "ai", label: "Configurações", desc: "Provedores e modelos", icon: BrainCircuit },
      { id: "ai-prompts", label: "IAs do App", desc: "Ativar, desativar e editar prompts", icon: Sparkles },
    ],
  },
  {
    id: "system",
    title: "Sistema",
    subtitle: "Acesso e ajustes",
    sectionIcon: Settings2,
    tabs: [
      { id: "app-features", label: "Funcionalidades", desc: "Ligar/desligar recursos", icon: Settings2 },
      { id: "users", label: "Usuários App", desc: "Membros cadastrados", icon: Users },
      { id: "roles", label: "Administradores", desc: "Permissões", icon: Shield },
    ],
  },
] as const;

const ALL_TOOLS = ADMIN_SECTIONS.flatMap(s =>
  s.tabs.map(t => ({ ...t, sectionId: s.id, section: s.title }))
);
const findTool = (id: string) => ALL_TOOLS.find(t => t.id === id);
const findSection = (id: string) => ADMIN_SECTIONS.find(s => s.id === id);

const isSameView = (a: View, b: View) =>
  a.kind === b.kind && (a.kind === "home" || ("id" in a && "id" in b && a.id === b.id));

const isAdminView = (value: unknown): value is View => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<View>;
  if (candidate.kind === "home") return true;
  if (candidate.kind === "category" && typeof candidate.id === "string") return !!findSection(candidate.id);
  if (candidate.kind === "tool" && typeof candidate.id === "string") return !!findTool(candidate.id);
  return false;
};

const writeAdminHistory = (view: View, mode: "push" | "replace") => {
  const state = { ...(window.history.state || {}), __adminView: view };
  if (mode === "replace") {
    window.history.replaceState(state, "", window.location.href);
  } else {
    window.history.pushState(state, "", window.location.href);
  }
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ kind: "home" });
  const [posts, setPosts] = useState<Post[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [postsRes, plansRes, usersRes] = await Promise.all([
      supabase.from("admin_posts").select("*").order("sort_order", { ascending: true }),
      supabase.from("admin_plans").select("*").order("sort_order", { ascending: true }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    ]);
    if (postsRes.data) setPosts(postsRes.data);
    if (plansRes.data) setPlans(plansRes.data);
    if (usersRes.data) setUsers(usersRes.data as UserProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Each admin screen is mirrored into the browser history. This makes the
  // phone/OS back button return one internal step at a time before leaving.
  useEffect(() => {
    const currentHistoryView = window.history.state?.__adminView;
    if (isAdminView(currentHistoryView)) {
      setView(currentHistoryView);
    } else {
      writeAdminHistory({ kind: "home" }, "replace");
    }

    const onPop = (event: PopStateEvent) => {
      const nextView = event.state?.__adminView;
      if (isAdminView(nextView)) setView(nextView);
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigate]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/admin"); };

  const navigateTo = (next: View) => {
    if (isSameView(view, next)) return;
    setView(next);
    writeAdminHistory(next, "push");
  };

  const openTool = (id: string) => navigateTo({ kind: "tool", id: id as ToolId });
  const openCategory = (id: string) => navigateTo({ kind: "category", id });
  const goHome = () => {
    if (view.kind === "home") return;
    navigateTo({ kind: "home" });
  };

  // In-app back button — delegate to browser history so it behaves exactly
  // like the phone/OS back button.
  const goBack = () => {
    window.history.back();
  };

  // ----------- HEADER -----------

  const currentTool = view.kind === "tool" ? findTool(view.id) : null;
  const currentCategory =
    view.kind === "category" ? findSection(view.id) :
    view.kind === "tool" && currentTool ? findSection(currentTool.sectionId) : null;

  const headerCrumb =
    view.kind === "home" ? "Administração" :
    view.kind === "category" ? currentCategory?.subtitle || "" :
    currentCategory?.title || "";
  const headerTitle =
    view.kind === "home" ? "Bíblia do Atalaia" :
    view.kind === "category" ? currentCategory?.title || "" :
    currentTool?.label || "";

  // ----------- VIEWS -----------

  // Home: only category cards, compact
  const HomeView = () => (
    <div className="space-y-3">
      <div className="mb-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--dark-muted))]">Categorias</p>
        <h2 className="text-xl font-bold text-[hsl(var(--dark-text))]">Escolha uma área</h2>
      </div>
      {ADMIN_SECTIONS.map((section) => {
        const SIcon = section.sectionIcon;
        return (
          <button
            key={section.id}
            onClick={() => openCategory(section.id)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] active:scale-[0.99]"
          >
            <span className="w-12 h-12 shrink-0 rounded-xl grid place-items-center bg-primary/15 text-primary">
              <SIcon className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-[hsl(var(--dark-text))] truncate">{section.title}</p>
              <p className="text-xs text-[hsl(var(--dark-muted))] truncate">{section.subtitle}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-bold text-[hsl(var(--dark-muted))] bg-[hsl(var(--dark-bg))] rounded-full px-2 py-0.5">
                {section.tabs.length}
              </span>
              <ChevronRight className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
            </div>
          </button>
        );
      })}

      <div className="pt-2 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate("/")}
          className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-[hsl(var(--dark-card))] text-sm font-semibold text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card-hover))] transition-colors"
        >
          <Home className="w-4 h-4" /> Bíblia
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-destructive/10 text-sm font-semibold text-destructive hover:bg-destructive/20 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>

      <button
        onClick={() => navigate("/atis")}
        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left bg-gradient-to-br from-[hsl(220,70%,45%)] to-[hsl(260,60%,40%)] text-white hover:brightness-110 transition-all"
      >
        <span className="w-12 h-12 shrink-0 rounded-xl grid place-items-center bg-white/15 backdrop-blur">
          <Bot className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold truncate">Painel Atis</p>
          <p className="text-xs opacity-90 truncate">Bot ministerial do WhatsApp</p>
        </div>
        <ChevronRight className="w-5 h-5 opacity-80 shrink-0" />
      </button>
    </div>
  );

  // Category: list of tools inside the section
  const CategoryView = ({ sectionId }: { sectionId: string }) => {
    const section = findSection(sectionId);
    if (!section) return null;
    const SIcon = section.sectionIcon;
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-5 bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] flex items-center gap-4">
          <span className="w-14 h-14 shrink-0 rounded-2xl grid place-items-center bg-white/15 text-white backdrop-blur">
            <SIcon className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-white/70">{section.subtitle}</p>
            <h2 className="text-lg font-bold text-white truncate">{section.title}</h2>
          </div>
        </div>

        <div className="space-y-2">
          {section.tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => openTool(t.id)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] transition-colors"
            >
              <span className="w-10 h-10 shrink-0 rounded-xl grid place-items-center bg-primary/15 text-primary">
                <t.icon className="w-4.5 h-4.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[hsl(var(--dark-text))] truncate">{t.label}</p>
                <p className="text-[11px] text-[hsl(var(--dark-muted))] truncate">{t.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 text-[hsl(var(--dark-muted))]" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Tool: renders the actual admin surface
  const ToolContent = ({ id }: { id: ToolId }) => {
    switch (id) {
      case "dashboard": return <AdminDashboard />;
      case "analytics": return <AdminAnalytics />;
      case "retention": return <AdminRetention />;
      case "verse": return <AdminDailyVerse />;
      case "push": return <AdminPushSender />;
      case "roles": return <AdminRoles />;
      case "log": return <AdminActivityLog />;
      case "cultos": return <AdminCultoSchedule />;
      case "ai": return <AdminAISettings />;
      case "ai-prompts": return <AdminAIInstructions />;
      case "app-features": return <AdminAppFeatures />;
      case "prayers": return <AdminPrayerRequests />;
      case "harpa-reports": return <AdminHarpaReports />;
      case "posts": return <AdminPosts posts={posts} fetchData={fetchData} />;
      case "plans": return <AdminPlans plans={plans} fetchData={fetchData} />;
      case "users": return <AdminUsers users={users} fetchData={fetchData} />;
    }
  };

  const showToolLoader = loading && view.kind === "tool" && ["posts", "plans", "users"].includes(view.id);

  return (
    <div className="min-h-screen bg-[hsl(var(--dark-bg))]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[hsl(var(--dark-bg))]/90 backdrop-blur border-b border-[hsl(var(--dark-card))]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {view.kind === "home" ? (
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] grid place-items-center shadow-lg shadow-primary/25 shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
          ) : (
            <button
              onClick={goBack}
              aria-label="Voltar"
              className="w-10 h-10 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] shrink-0 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--dark-muted))] truncate">
              {headerCrumb}
            </p>
            <h1 className="text-base font-bold truncate leading-tight text-[hsl(var(--dark-text))]">
              {headerTitle}
            </h1>
          </div>

          {view.kind !== "home" && (
            <button
              onClick={goHome}
              aria-label="Início"
              className="w-10 h-10 rounded-2xl grid place-items-center text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card))] hover:text-[hsl(var(--dark-text))] shrink-0 transition-colors"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="pb-24">
        <div className="max-w-2xl mx-auto px-4 py-5">
          {showToolLoader ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : view.kind === "home" ? (
            <HomeView />
          ) : view.kind === "category" ? (
            <CategoryView sectionId={view.id} />
          ) : (
            <ToolContent id={view.id} />
          )}
        </div>
      </main>

      {/* Bottom action bar — always visible, mobile-first */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[hsl(var(--dark-bg))]/95 backdrop-blur border-t border-[hsl(var(--dark-card))]">
        <div className="max-w-2xl mx-auto flex items-center justify-around h-16 px-2">
          <BottomButton
            active={view.kind === "home"}
            onClick={goHome}
            icon={LayoutGrid}
            label="Início"
          />
          <BottomButton
            active={view.kind === "tool" && view.id === "dashboard"}
            onClick={() => openTool("dashboard")}
            icon={LayoutDashboard}
            label="Dashboard"
          />
          <BottomButton
            active={view.kind === "tool" && view.id === "ai-prompts"}
            onClick={() => openTool("ai-prompts")}
            icon={Sparkles}
            label="IA"
          />
          <BottomButton
            active={view.kind === "category" && view.id === "system"}
            onClick={() => openCategory("system")}
            icon={MoreHorizontal}
            label="Mais"
          />
        </div>
      </nav>
    </div>
  );
};

const BottomButton = ({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: typeof Home; label: string }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative ${
      active ? "text-primary" : "text-[hsl(var(--dark-muted))]"
    }`}
  >
    {active && (
      <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
    )}
    <Icon className="w-5 h-5" />
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

export default AdminPanel;
