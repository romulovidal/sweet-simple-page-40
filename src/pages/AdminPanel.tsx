import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Loader2, Calendar, Users, LayoutDashboard, Bell, Shield,
  Clock, BookMarked, Menu, Home, Sparkles, BrainCircuit,
  Settings2, MessageCircleQuestion, HandHeart, FileText, BookOpen, Search, ChevronRight
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminDailyVerse from "@/components/admin/AdminDailyVerse";
import AdminPushSender from "@/components/admin/AdminPushSender";
import AdminRoles from "@/components/admin/AdminRoles";
import AdminActivityLog from "@/components/admin/AdminActivityLog";
import AdminCultoSchedule from "@/components/admin/AdminCultoSchedule";
import AdminExegetAI from "@/components/admin/AdminExegetAI";
import AdminAISettings from "@/components/admin/AdminAISettings";
import AdminAppFeatures from "@/components/admin/AdminAppFeatures";
import AdminAskBiblePrompt from "@/components/admin/AdminAskBiblePrompt";
import AdminPrayerRequests from "@/components/admin/AdminPrayerRequests";
import AdminAIPrompts from "@/components/admin/AdminAIPrompts";
import AdminPosts from "@/components/admin/AdminPosts";
import AdminPlans from "@/components/admin/AdminPlans";
import AdminUsers, { type UserProfile } from "@/components/admin/AdminUsers";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Post = Database["public"]["Tables"]["admin_posts"]["Row"];
type Plan = Database["public"]["Tables"]["admin_plans"]["Row"];

type TabType = "dashboard" | "posts" | "plans" | "verse" | "push" | "cultos" | "users" | "roles" | "log" | "exegetai" | "ai" | "ai-prompts" | "app-features" | "ask-bible-prompt" | "prayers";

const ADMIN_SECTIONS = [
  {
    title: "Visão Geral",
    subtitle: "Métricas e atividade",
    accent: "from-sky-500/25 to-sky-500/5",
    ring: "ring-sky-400/40",
    icon: "text-sky-300",
    tabs: [
      { id: "dashboard", label: "Dashboard", desc: "Métricas e resumo", icon: LayoutDashboard },
      { id: "log", label: "Atividade", desc: "Histórico de ações", icon: Clock },
    ],
  },
  {
    title: "Conteúdo",
    subtitle: "Publicações e planos",
    accent: "from-emerald-500/25 to-emerald-500/5",
    ring: "ring-emerald-400/40",
    icon: "text-emerald-300",
    tabs: [
      { id: "posts", label: "Posts", desc: "Feed devocional", icon: FileText },
      { id: "plans", label: "Planos de Leitura", desc: "Trilhas bíblicas", icon: BookOpen },
      { id: "verse", label: "Versículo do Dia", desc: "Push diário", icon: BookMarked },
      { id: "cultos", label: "Escala de Cultos", desc: "Lembretes de culto", icon: Calendar },
    ],
  },
  {
    title: "Comunidade",
    subtitle: "Interação e avisos",
    accent: "from-rose-500/25 to-rose-500/5",
    ring: "ring-rose-400/40",
    icon: "text-rose-300",
    tabs: [
      { id: "push", label: "Notificações Push", desc: "Envio manual", icon: Bell },
      { id: "prayers", label: "Pedidos de Oração", desc: "Moderação", icon: HandHeart },
    ],
  },
  {
    title: "Inteligência Artificial",
    subtitle: "Modelos e prompts",
    accent: "from-violet-500/25 to-violet-500/5",
    ring: "ring-violet-400/40",
    icon: "text-violet-300",
    tabs: [
      { id: "ai", label: "Configurações", desc: "Provedores e modelos", icon: BrainCircuit },
      { id: "ai-prompts", label: "Instruções", desc: "Prompts globais", icon: Sparkles },
      { id: "exegetai", label: "ExegetAI", desc: "Estudo profundo", icon: Sparkles },
      { id: "ask-bible-prompt", label: "Pergunte à Bíblia", desc: "Chat bíblico", icon: MessageCircleQuestion },
    ],
  },
  {
    title: "Sistema",
    subtitle: "Acesso e ajustes",
    accent: "from-amber-500/25 to-amber-500/5",
    ring: "ring-amber-400/40",
    icon: "text-amber-300",
    tabs: [
      { id: "app-features", label: "Funcionalidades", desc: "Ligar/desligar recursos", icon: Settings2 },
      { id: "users", label: "Usuários App", desc: "Membros cadastrados", icon: Users },
      { id: "roles", label: "Administradores", desc: "Permissões", icon: Shield },
    ],
  },
];

const ALL_TABS = ADMIN_SECTIONS.flatMap(s => s.tabs.map(t => ({ ...t, section: s.title, accent: s.accent, ring: s.ring, iconColor: s.icon })));
const findMeta = (id: string) => ALL_TABS.find(t => t.id === id);
const BOTTOM_TABS = [
  { id: "dashboard", label: "Início", icon: LayoutDashboard },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "plans", label: "Planos", icon: BookOpen },
  { id: "ai", label: "IA", icon: Sparkles },
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>("dashboard");
  const [posts, setPosts] = useState<Post[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

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

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/admin"); };

  const currentMeta = findMeta(tab);
  const currentTabLabel = currentMeta?.label || "Painel Admin";
  const currentSection = currentMeta?.section || "";

  const filteredSections = ADMIN_SECTIONS.map((s) => ({
    ...s,
    tabs: s.tabs.filter((t) =>
      !search.trim()
        ? true
        : (t.label + " " + (t as any).desc).toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((s) => s.tabs.length > 0);

  const NavList = ({ compact = false }: { compact?: boolean }) => (
    <div className="space-y-5">
      {filteredSections.map((section) => (
        <div key={section.title}>
          <div className="flex items-center gap-2 px-2 mb-2">
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${section.icon}`} />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[hsl(var(--dark-muted))]">
              {section.title}
            </h3>
          </div>
          <div className="space-y-1">
            {section.tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id as any); setMenuOpen(false); }}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    active
                      ? `bg-gradient-to-r ${section.accent} ring-1 ${section.ring} shadow-sm`
                      : "hover:bg-[hsl(var(--dark-card))]/60"
                  }`}
                >
                  <span className={`w-9 h-9 shrink-0 rounded-xl grid place-items-center bg-[hsl(var(--dark-card))]/70 ${section.icon}`}>
                    <t.icon className="w-4.5 h-4.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-semibold truncate ${active ? "text-[hsl(var(--dark-text))]" : "text-[hsl(var(--dark-text))]/90"}`}>
                      {t.label}
                    </span>
                    {!compact && (t as any).desc && (
                      <span className="block text-[11px] text-[hsl(var(--dark-muted))] truncate">
                        {(t as any).desc}
                      </span>
                    )}
                  </span>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${active ? "text-[hsl(var(--dark-text))] translate-x-0.5" : "text-[hsl(var(--dark-muted))]/50 group-hover:translate-x-0.5"}`} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {filteredSections.length === 0 && (
        <p className="text-center text-xs text-[hsl(var(--dark-muted))] py-8">Nada encontrado.</p>
      )}
    </div>
  );

  const SearchBox = () => (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--dark-muted))]" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar seção..."
        className="w-full h-10 pl-9 pr-3 rounded-xl bg-[hsl(var(--dark-card))]/70 border border-[hsl(var(--dark-card-hover))]/60 text-sm placeholder:text-[hsl(var(--dark-muted))] focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );

  const Brand = () => (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 grid place-items-center shadow-lg shadow-amber-500/20">
        <Shield className="w-5 h-5 text-amber-950" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--dark-muted))]">Administração</p>
        <p className="text-sm font-bold leading-tight bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
          Bíblia do Atalaia
        </p>
      </div>
    </div>
  );

  const FooterActions = () => (
    <div className="space-y-1.5">
      <button
        onClick={() => { setMenuOpen(false); navigate("/"); }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))]/60 transition-colors"
      >
        <Home className="w-4 h-4" />
        Voltar para a Bíblia
      </button>
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sair
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[hsl(var(--dark-bg))]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-72 flex-col border-r border-[hsl(var(--dark-card))] bg-[hsl(var(--dark-bg))]/95 backdrop-blur z-30">
        <div className="px-5 pt-6 pb-4 border-b border-[hsl(var(--dark-card))]">
          <Brand />
        </div>
        <div className="px-4 pt-4 pb-3">
          <SearchBox />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavList />
        </nav>
        <div className="p-3 border-t border-[hsl(var(--dark-card))]">
          <FooterActions />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col lg:pl-72 pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-[hsl(var(--dark-bg))]/90 backdrop-blur border-b border-[hsl(var(--dark-card))]">
          <div className="px-5 lg:px-8 py-4 flex items-center gap-3">
            {/* Mobile hamburger */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button className="lg:hidden p-2 rounded-xl hover:bg-[hsl(var(--dark-card))] transition-colors" aria-label="Abrir menu">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-sm bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card))] p-0 flex flex-col">
                <SheetHeader className="px-5 pt-6 pb-4 border-b border-[hsl(var(--dark-card))] shrink-0">
                  <SheetTitle className="text-left">
                    <Brand />
                  </SheetTitle>
                </SheetHeader>
                <div className="px-4 pt-3">
                  <SearchBox />
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <NavList />
                </div>
                <div className="p-3 border-t border-[hsl(var(--dark-card))] shrink-0">
                  <FooterActions />
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--dark-muted))] truncate">
                {currentSection}
              </p>
              <h1 className="text-base lg:text-lg font-bold text-[hsl(var(--dark-text))] truncate leading-tight">
                {currentTabLabel}
              </h1>
            </div>

            <button
              onClick={() => navigate("/")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <Home className="w-4 h-4" />
              Bíblia
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {loading && (tab === "posts" || tab === "plans" || tab === "users") ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="px-5 lg:px-8 py-5 lg:py-8 max-w-5xl mx-auto w-full">
              {/* Section hero card */}
              {currentMeta && (
                <div className={`mb-5 rounded-2xl p-4 lg:p-5 bg-gradient-to-r ${currentMeta.accent} ring-1 ${currentMeta.ring} flex items-center gap-4`}>
                  <span className={`w-12 h-12 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))]/70 ${currentMeta.iconColor}`}>
                    <currentMeta.icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--dark-muted))]">{currentSection}</p>
                    <h2 className="text-base lg:text-lg font-bold text-[hsl(var(--dark-text))] truncate">{currentTabLabel}</h2>
                    {(currentMeta as any).desc && (
                      <p className="text-xs text-[hsl(var(--dark-muted))] truncate">{(currentMeta as any).desc}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {tab === "dashboard" && <AdminDashboard />}
                {tab === "verse" && <AdminDailyVerse />}
                {tab === "push" && <AdminPushSender />}
                {tab === "roles" && <AdminRoles />}
                {tab === "log" && <AdminActivityLog />}
                {tab === "cultos" && <AdminCultoSchedule />}
                {tab === "exegetai" && <AdminExegetAI />}
                {tab === "ai" && <AdminAISettings />}
                {tab === "ai-prompts" && <AdminAIPrompts />}
                {tab === "app-features" && <AdminAppFeatures />}
                {tab === "ask-bible-prompt" && <AdminAskBiblePrompt />}
                {tab === "prayers" && <AdminPrayerRequests />}
                {tab === "posts" && <AdminPosts posts={posts} fetchData={fetchData} />}
                {tab === "plans" && <AdminPlans plans={plans} fetchData={fetchData} />}
                {tab === "users" && <AdminUsers users={users} fetchData={fetchData} />}
              </div>
            </div>
          )}
        </main>

        {/* Bottom Navigation - mobile only */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[hsl(var(--dark-bg))]/95 backdrop-blur border-t border-[hsl(var(--dark-card))]">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
            {BOTTOM_TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative ${
                    active ? "text-primary" : "text-[hsl(var(--dark-muted))]"
                  }`}
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                  )}
                  <t.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setMenuOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[hsl(var(--dark-muted))]"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium">Mais</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default AdminPanel;
