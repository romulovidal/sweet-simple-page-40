import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  LogOut, Loader2, Calendar, Users, LayoutDashboard, Bell, Shield,
  Clock, BookMarked, Menu, Home, Sparkles, BrainCircuit,
  Settings2, MessageCircleQuestion, HandHeart, FileText, BookOpen
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
    title: "Geral",
    tabs: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "app-features", label: "Funcionalidades", icon: Settings2 },
      { id: "log", label: "Logs", icon: Clock },
    ]
  },
  {
    title: "Conteúdo",
    tabs: [
      { id: "posts", label: "Posts", icon: FileText },
      { id: "plans", label: "Planos de Leitura", icon: BookOpen },
      { id: "verse", label: "Versículo do Dia", icon: BookMarked },
      { id: "cultos", label: "Escala de Cultos", icon: Calendar },
    ]
  },
  {
    title: "Interação",
    tabs: [
      { id: "push", label: "Notificações Push", icon: Bell },
      { id: "prayers", label: "Pedidos de Oração", icon: HandHeart },
    ]
  },
  {
    title: "Inteligência Espiritual",
    tabs: [
      { id: "ai", label: "Configurações", icon: BrainCircuit },
      { id: "ai-prompts", label: "Instruções", icon: Sparkles },
      { id: "exegetai", label: "ExegettAI", icon: Sparkles },
      { id: "ask-bible-prompt", label: "Pergunte à Bíblia", icon: MessageCircleQuestion },
    ]
  },
  {
    title: "Sistema e Acesso",
    tabs: [
      { id: "users", label: "Usuários App", icon: Users },
      { id: "roles", label: "Administradores", icon: Shield },
    ]
  }
];

const ALL_TABS = ADMIN_SECTIONS.flatMap(s => s.tabs);
const BOTTOM_TABS = [
  { id: "dashboard", label: "Início", icon: LayoutDashboard },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "plans", label: "Planos", icon: BookOpen },
  { id: "verse", label: "Versículo", icon: BookMarked },
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>("dashboard");
  const [posts, setPosts] = useState<Post[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const currentTabLabel = ALL_TABS.find(t => t.id === tab)?.label || "Painel Admin";

  // ---- MAIN PANEL (Mobile-first with bottom nav) ----
  return (
    <div className="min-h-screen pb-20 flex flex-col">
      {/* Top header */}
      <header className="px-5 pt-6 pb-3 flex items-center justify-between border-b border-[hsl(var(--dark-card))] sticky top-0 z-20 bg-[hsl(var(--dark-bg))]">
        <div className="flex items-center gap-3">
          {/* Hamburger menu */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="p-1.5 rounded-lg hover:bg-[hsl(var(--dark-card))] transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card))] p-0 flex flex-col">
              <SheetHeader className="px-5 pt-6 pb-4 border-b border-[hsl(var(--dark-card))] shrink-0">
                <SheetTitle className="text-left text-lg font-bold text-primary">Menu Administrativo</SheetTitle>
                <p className="text-[10px] text-[hsl(var(--dark-muted))] text-left uppercase tracking-wider">A Bíblia do Atalaia</p>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                {ADMIN_SECTIONS.map((section) => (
                  <div key={section.title} className="space-y-1.5">
                    <h3 className="px-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--dark-muted))] mb-2">
                      {section.title}
                    </h3>
                    {section.tabs.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setTab(t.id as any); setMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          tab === t.id 
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                            : "text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))]"
                        }`}
                      >
                        <t.icon className={`w-4.5 h-4.5 ${tab === t.id ? "animate-pulse" : "opacity-70"}`} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="p-4 bg-[hsl(var(--dark-card))]/30 border-t border-[hsl(var(--dark-card))] shrink-0 space-y-2">
                <button
                  onClick={() => { setMenuOpen(false); navigate("/"); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Voltar para a Bíblia
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold leading-tight text-primary uppercase tracking-tight">
              {currentTabLabel}
            </h1>
            <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium">Administração</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors">
            <Home className="w-4 h-4" />
            Bíblia
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (tab === "posts" || tab === "plans" || tab === "users") ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="px-5 py-4">
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
        )}
      </div>

      {/* Bottom Navigation - mobile app style */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[hsl(var(--dark-bg))] border-t border-[hsl(var(--dark-card))]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {BOTTOM_TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  active ? "text-primary" : "text-[hsl(var(--dark-muted))]"
                }`}
              >
                <t.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                <span className={`text-[10px] font-medium ${active ? "text-primary" : ""}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

// Smart reading form with book selector
export default AdminPanel;
