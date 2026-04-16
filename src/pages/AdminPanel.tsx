import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  LogOut, Plus, Trash2, Edit2, Save, X, ChevronLeft, Eye, EyeOff,
  FileText, Video, BookOpen, Heart, Megaphone, Loader2, ChevronDown, Calendar, Users,
  LayoutDashboard, Bell, Shield, Clock, Download, BookMarked, Menu,
} from "lucide-react";
import { bibleBooks } from "@/data/bible";
import type { Database } from "@/integrations/supabase/types";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminDailyVerse from "@/components/admin/AdminDailyVerse";
import AdminPushSender from "@/components/admin/AdminPushSender";
import AdminRoles from "@/components/admin/AdminRoles";
import AdminActivityLog from "@/components/admin/AdminActivityLog";
import AdminCultoSchedule from "@/components/admin/AdminCultoSchedule";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Post = Database["public"]["Tables"]["admin_posts"]["Row"];
type Plan = Database["public"]["Tables"]["admin_plans"]["Row"];
type PlanReading = Database["public"]["Tables"]["admin_plan_readings"]["Row"];

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

const POST_TYPES = [
  { value: "versiculo", label: "Versículo", icon: BookOpen },
  { value: "oracao", label: "Oração", icon: Heart },
  { value: "video", label: "Vídeo YouTube", icon: Video },
  { value: "devocional", label: "Devocional", icon: FileText },
  { value: "anuncio", label: "Anúncio", icon: Megaphone },
];

const PLAN_CATEGORIES = ["Geral", "Iniciante", "Salmos", "Evangelhos", "Cartas", "Profetas", "Devocional", "Temático"];

type TabType = "dashboard" | "posts" | "plans" | "verse" | "push" | "cultos" | "users" | "roles" | "log";

const BOTTOM_TABS: { id: TabType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Início", icon: LayoutDashboard },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "plans", label: "Planos", icon: BookOpen },
  { id: "verse", label: "Versículo", icon: BookMarked },
  { id: "push", label: "Push", icon: Bell },
];

const MORE_TABS: { id: TabType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "cultos", label: "Cultos", icon: Calendar },
  { id: "users", label: "Usuários", icon: Users },
  { id: "roles", label: "Administradores", icon: Shield },
  { id: "log", label: "Log de Atividades", icon: Clock },
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>("dashboard");
  const [posts, setPosts] = useState<Post[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [editingPlan, setEditingPlan] = useState<Partial<Plan & { devotional?: string; total_days?: number }> | null>(null);
  const [planReadings, setPlanReadings] = useState<PlanReading[]>([]);
  const [viewingPlanId, setViewingPlanId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
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
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/admin"); };

  const exportUsersCSV = () => {
    const headers = ["Nome", "Data de Cadastro"];
    const rows = users.map(u => [u.display_name || "Sem nome", new Date(u.created_at).toLocaleDateString("pt-BR")]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  // ---- POSTS ----
  const savePost = async () => {
    if (!editingPost?.title?.trim() || !editingPost?.content?.trim()) { toast.error("Título e conteúdo são obrigatórios"); return; }
    const data = {
      title: editingPost.title.trim(), content: editingPost.content.trim(),
      type: editingPost.type || "devocional", youtube_url: editingPost.youtube_url?.trim() || null,
      bible_reference: editingPost.bible_reference?.trim() || null, image_url: editingPost.image_url?.trim() || null,
      is_active: editingPost.is_active ?? true, sort_order: editingPost.sort_order ?? 0,
    };
    const isNew = !editingPost.id;
    if (editingPost.id) {
      const { error } = await supabase.from("admin_posts").update(data).eq("id", editingPost.id);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Postagem atualizada!");
    } else {
      const { error } = await supabase.from("admin_posts").insert(data);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Postagem criada!");
    }
    // Auto-send push notification for new active posts
    if (isNew && data.is_active) {
      try {
        const postTypeLabel = POST_TYPES.find(t => t.value === data.type)?.label || "Post";
        await supabase.functions.invoke("send-push", {
          body: {
            title: `📢 ${postTypeLabel}: ${data.title.substring(0, 60)}`,
            body: data.content.substring(0, 120) + (data.content.length > 120 ? "..." : ""),
            url: "/",
            ttl: 60 * 60 * 24,
            urgency: "high",
            type: "post",
          },
        });
        toast.success("Notificação push enviada automaticamente!");
      } catch (e) {
        console.error("Push auto-send error:", e);
        toast.error("Post criado, mas falha ao enviar push");
      }
    }
    setEditingPost(null); fetchData();
  };

  const deletePost = async (id: string) => {
    const { error } = await supabase.from("admin_posts").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Postagem excluída"); fetchData();
  };

  const togglePostActive = async (post: Post) => {
    await supabase.from("admin_posts").update({ is_active: !post.is_active }).eq("id", post.id);
    fetchData();
  };

  // ---- PLANS ----
  const savePlan = async () => {
    if (!editingPlan?.title?.trim() || !editingPlan?.description?.trim()) { toast.error("Título e descrição são obrigatórios"); return; }
    const data = {
      title: editingPlan.title.trim(), description: editingPlan.description.trim(),
      image_emoji: editingPlan.image_emoji || "📖", category: editingPlan.category || "Geral",
      is_active: editingPlan.is_active ?? true, sort_order: editingPlan.sort_order ?? 0,
      devotional: (editingPlan as { devotional?: string }).devotional || "",
      total_days: (editingPlan as { total_days?: number }).total_days || 7,
    };
    let planId = editingPlan.id;
    if (planId) {
      const { error } = await supabase.from("admin_plans").update(data).eq("id", planId);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Plano atualizado!");
    } else {
      const { data: newPlan, error } = await supabase.from("admin_plans").insert(data).select().single();
      if (error || !newPlan) { toast.error("Erro ao criar"); return; }
      planId = newPlan.id;
      toast.success("Plano criado! Agora adicione as leituras.");
    }
    setEditingPlan(null);
    fetchData();
    if (planId) fetchReadings(planId);
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("admin_plans").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Plano excluído"); fetchData();
  };

  // ---- PLAN READINGS ----
  const fetchReadings = async (planId: string) => {
    setViewingPlanId(planId);
    const { data } = await supabase.from("admin_plan_readings").select("*").eq("plan_id", planId).order("day_number", { ascending: true });
    setPlanReadings(data || []);
  };

  const addReading = async (planId: string, reading: { dayNumber: number; bookAbbrev: string; chapter: number; title: string; verseStart?: number; verseEnd?: number }) => {
    const { error } = await supabase.from("admin_plan_readings").insert({
      plan_id: planId, day_number: reading.dayNumber, book_abbrev: reading.bookAbbrev.trim(),
      chapter: reading.chapter, title: reading.title.trim(),
      verse_start: reading.verseStart || null, verse_end: reading.verseEnd || null,
    });
    if (error) { toast.error("Erro ao adicionar leitura"); return; }
    toast.success(`Leitura adicionada ao Dia ${reading.dayNumber}`);
    fetchReadings(planId);
  };

  const deleteReading = async (id: string) => {
    await supabase.from("admin_plan_readings").delete().eq("id", id);
    if (viewingPlanId) fetchReadings(viewingPlanId);
  };

  const isMoreTab = MORE_TABS.some(t => t.id === tab);
  const currentTabLabel = [...BOTTOM_TABS, ...MORE_TABS].find(t => t.id === tab)?.label || "";

  // ---- POST FORM ----
  if (editingPost) {
    return (
      <div className="min-h-screen pb-10">
        <header className="px-5 pt-8 pb-4 flex items-center gap-3 border-b border-[hsl(var(--dark-card))]">
          <button onClick={() => setEditingPost(null)}><X className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold flex-1">{editingPost.id ? "Editar" : "Nova"} Postagem</h1>
          <Button size="sm" onClick={savePost}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
        </header>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {POST_TYPES.map((t) => (
                <button key={t.value} onClick={() => setEditingPost({ ...editingPost, type: t.value })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    editingPost.type === t.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                  <t.icon className="w-3 h-3" /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Título</label>
            <Input value={editingPost.title || ""} onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
              className="bg-muted border-none" maxLength={200} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Conteúdo</label>
            <Textarea value={editingPost.content || ""} onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
              className="bg-muted border-none min-h-[120px]" maxLength={5000} />
          </div>
          {editingPost.type === "video" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL do YouTube</label>
              <Input value={editingPost.youtube_url || ""} onChange={(e) => setEditingPost({ ...editingPost, youtube_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..." className="bg-muted border-none" maxLength={500} />
            </div>
          )}
          {(editingPost.type === "versiculo" || editingPost.type === "oracao") && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Referência Bíblica</label>
              <Input value={editingPost.bible_reference || ""} onChange={(e) => setEditingPost({ ...editingPost, bible_reference: e.target.value })}
                placeholder="Ex: João 3:16" className="bg-muted border-none" maxLength={100} />
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ordem de exibição</label>
            <Input type="number" value={editingPost.sort_order ?? 0}
              onChange={(e) => setEditingPost({ ...editingPost, sort_order: parseInt(e.target.value) || 0 })}
              className="bg-muted border-none w-24" />
          </div>
        </div>
      </div>
    );
  }

  // ---- PLAN FORM ----
  if (editingPlan) {
    const totalDays = (editingPlan as { total_days?: number }).total_days || 7;
    return (
      <div className="min-h-screen pb-10">
        <header className="px-5 pt-8 pb-4 flex items-center gap-3 border-b border-[hsl(var(--dark-card))]">
          <button onClick={() => setEditingPlan(null)}><X className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold flex-1">{editingPlan.id ? "Editar" : "Novo"} Plano</h1>
          <Button size="sm" onClick={savePlan}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
        </header>
        <div className="px-5 py-4 space-y-5">
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Emoji</label>
              <Input value={editingPlan.image_emoji || "📖"}
                onChange={(e) => setEditingPlan({ ...editingPlan, image_emoji: e.target.value })}
                className="bg-muted border-none w-16 text-center text-2xl" maxLength={4} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Título do Plano *</label>
              <Input value={editingPlan.title || ""}
                onChange={(e) => setEditingPlan({ ...editingPlan, title: e.target.value })}
                placeholder="Ex: 21 Dias nos Salmos" className="bg-muted border-none" maxLength={200} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Quantos dias tem o plano? *
            </label>
            <div className="flex items-center gap-3">
              <Input type="number" value={totalDays}
                onChange={(e) => setEditingPlan({ ...editingPlan, total_days: parseInt(e.target.value) || 1 } as typeof editingPlan)}
                min={1} max={365} className="bg-muted border-none w-24" />
              <span className="text-xs text-muted-foreground">dias de leitura</span>
            </div>
            <div className="flex gap-2 mt-2">
              {[7, 14, 21, 30, 60, 90].map((d) => (
                <button key={d} onClick={() => setEditingPlan({ ...editingPlan, total_days: d } as typeof editingPlan)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    totalDays === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>{d}d</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Descrição *</label>
            <Textarea value={editingPlan.description || ""}
              onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
              placeholder="Breve descrição do plano..." className="bg-muted border-none" maxLength={1000} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Devocional / Introdução</label>
            <Textarea value={(editingPlan as { devotional?: string }).devotional || ""}
              onChange={(e) => setEditingPlan({ ...editingPlan, devotional: e.target.value } as typeof editingPlan)}
              placeholder="Texto devocional de abertura do plano..."
              className="bg-muted border-none min-h-[100px]" maxLength={5000} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {PLAN_CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setEditingPlan({ ...editingPlan, category: cat })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    editingPlan.category === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>{cat}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ordem</label>
            <Input type="number" value={editingPlan.sort_order ?? 0}
              onChange={(e) => setEditingPlan({ ...editingPlan, sort_order: parseInt(e.target.value) || 0 })}
              className="bg-muted border-none w-24" />
          </div>
          <div className="bg-primary/10 rounded-xl p-4">
            <p className="text-xs text-primary font-semibold mb-1">💡 Próximo passo</p>
            <p className="text-xs text-muted-foreground">
              Ao salvar, você será direcionado para adicionar as leituras dia a dia.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- PLAN READINGS VIEW ----
  if (viewingPlanId) {
    const plan = plans.find((p) => p.id === viewingPlanId);
    const totalDays = (plan as Record<string, unknown>)?.total_days as number || 0;
    const dayGroups: Record<number, PlanReading[]> = {};
    planReadings.forEach((r) => {
      if (!dayGroups[r.day_number]) dayGroups[r.day_number] = [];
      dayGroups[r.day_number].push(r);
    });
    const existingDays = Object.keys(dayGroups).map(Number).sort((a, b) => a - b);
    const filledDays = existingDays.length;
    const progress = totalDays > 0 ? Math.round((filledDays / totalDays) * 100) : 0;
    const nextNewDay = existingDays.length > 0 ? Math.max(...existingDays) + 1 : 1;
    const canAddNewDay = totalDays === 0 || filledDays < totalDays;

    return (
      <div className="min-h-screen pb-10">
        <header className="px-5 pt-8 pb-4 border-b border-[hsl(var(--dark-card))]">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewingPlanId(null)}><ChevronLeft className="w-5 h-5" /></button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">{plan?.title}</h1>
              <p className="text-xs text-muted-foreground">{filledDays}/{totalDays} dias preenchidos • {progress}%</p>
            </div>
            <button onClick={() => plan && setEditingPlan(plan)} className="text-xs text-primary font-semibold">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
          {totalDays > 0 && (
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-3">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          )}
          {filledDays < totalDays && totalDays > 0 && (
            <p className="text-[10px] text-amber-400 mt-2">⚠️ Faltam {totalDays - filledDays} dias para completar o plano</p>
          )}
          {filledDays >= totalDays && totalDays > 0 && (
            <p className="text-[10px] text-green-400 mt-2">✅ Plano completo!</p>
          )}
        </header>
        <div className="px-5 py-4 space-y-4">
          {existingDays.map((dayNum) => {
            const dayReadings = dayGroups[dayNum];
            return (
              <div key={dayNum} className="bg-muted rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-primary">📅 Dia {String(dayNum).padStart(2, "0")}</p>
                  <p className="text-[10px] text-muted-foreground">{dayReadings.length} leitura{dayReadings.length > 1 ? "s" : ""}</p>
                </div>
                {dayReadings.map((r) => {
                  const book = bibleBooks.find((b) => b.apiAbbrev === r.book_abbrev);
                  const vs = (r as Record<string, unknown>).verse_start as number | null;
                  const ve = (r as Record<string, unknown>).verse_end as number | null;
                  const verseRange = vs ? `${vs}${ve ? `-${ve}` : ""}` : "";
                  const readingTitle = (r as Record<string, unknown>).title as string;
                  return (
                    <div key={r.id} className="flex items-center gap-3 bg-[hsl(var(--dark-bg))] rounded-lg p-2.5">
                      <div className="flex-1 min-w-0">
                        {readingTitle && <p className="text-[10px] font-semibold text-primary truncate">{readingTitle}</p>}
                        <p className="text-sm">
                          {book?.name || r.book_abbrev} {r.chapter}
                          {verseRange && <span className="text-muted-foreground">:{verseRange}</span>}
                        </p>
                      </div>
                      <button onClick={() => deleteReading(r.id)} className="text-destructive p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                <SmartAddReadingForm
                  onAdd={(reading) => addReading(viewingPlanId, { ...reading, dayNumber: dayNum })}
                  dayNumber={dayNum} totalDays={totalDays} isAddToDay
                />
              </div>
            );
          })}
          {canAddNewDay && (
            <div className="bg-muted rounded-xl p-4">
              <SmartAddReadingForm
                onAdd={(reading) => addReading(viewingPlanId, { ...reading, dayNumber: nextNewDay })}
                dayNumber={nextNewDay} totalDays={totalDays}
              />
            </div>
          )}
          {planReadings.length === 0 && !canAddNewDay && (
            <div className="text-center py-10">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">Nenhuma leitura adicionada</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- MAIN PANEL (Mobile-first with bottom nav) ----
  return (
    <div className="min-h-screen pb-20 flex flex-col">
      {/* Top header */}
      <header className="px-5 pt-6 pb-3 flex items-center justify-between border-b border-[hsl(var(--dark-card))] sticky top-0 z-20 bg-[hsl(var(--dark-bg))]">
        <div className="flex items-center gap-3">
          {/* Hamburger menu */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card))] p-0">
              <SheetHeader className="px-5 pt-6 pb-4 border-b border-[hsl(var(--dark-card))]">
                <SheetTitle className="text-left text-base text-[hsl(var(--dark-text))]">Menu Admin</SheetTitle>
              </SheetHeader>
              <div className="px-3 py-4 space-y-1">
                {MORE_TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTab(t.id); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      tab === t.id ? "bg-primary text-primary-foreground" : "text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))]"
                    }`}
                  >
                    <t.icon className="w-5 h-5" />
                    {t.label}
                  </button>
                ))}
                <div className="border-t border-[hsl(var(--dark-card))] my-3" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sair
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <div>
            <h1 className="text-lg font-bold leading-tight text-[hsl(var(--dark-text))]">
              {isMoreTab ? currentTabLabel : "Painel Admin"}
            </h1>
            {!isMoreTab && <p className="text-[11px] text-[hsl(var(--dark-muted))]">A Bíblia do Atalaia</p>}
          </div>
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

            {tab === "posts" && (
              <>
                <Button onClick={() => setEditingPost({ type: "devocional", is_active: true, sort_order: 0 })} className="w-full mb-4">
                  <Plus className="w-4 h-4 mr-2" /> Nova Postagem
                </Button>
                <div className="space-y-2">
                  {posts.map((post) => {
                    const typeInfo = POST_TYPES.find((t) => t.value === post.type);
                    const Icon = typeInfo?.icon || FileText;
                    return (
                      <div key={post.id} className="bg-muted rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm truncate">{post.title}</p>
                              {!post.is_active && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">Oculto</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.content}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[hsl(var(--dark-card))]">
                          <button onClick={() => setEditingPost(post)} className="text-xs text-primary font-medium flex items-center gap-1">
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>
                          <button onClick={() => togglePostActive(post)} className="text-xs text-muted-foreground font-medium flex items-center gap-1 ml-auto">
                            {post.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            {post.is_active ? "Ocultar" : "Mostrar"}
                          </button>
                          <button onClick={() => deletePost(post.id)} className="text-xs text-destructive font-medium flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> Excluir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {posts.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhuma postagem ainda</p>}
                </div>
              </>
            )}

            {tab === "plans" && (
              <>
                <Button onClick={() => setEditingPlan({ is_active: true, sort_order: 0, image_emoji: "📖", category: "Geral", total_days: 7 } as Partial<Plan>)} className="w-full mb-4">
                  <Plus className="w-4 h-4 mr-2" /> Novo Plano
                </Button>
                <div className="space-y-2">
                  {plans.map((plan) => {
                    const td = (plan as Record<string, unknown>).total_days as number || 0;
                    return (
                      <div key={plan.id} className="bg-muted rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{plan.image_emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{plan.title}</p>
                              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{plan.category}</span>
                              {!plan.is_active && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">Oculto</span>}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{plan.description}</p>
                            <p className="text-[10px] text-muted-foreground mt-1"><Calendar className="w-3 h-3 inline mr-1" />{td} dias</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[hsl(var(--dark-card))]">
                          <button onClick={() => fetchReadings(plan.id)} className="text-xs text-primary font-medium flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> Leituras
                          </button>
                          <button onClick={() => setEditingPlan(plan)} className="text-xs text-primary font-medium flex items-center gap-1">
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>
                          <button onClick={() => deletePlan(plan.id)} className="text-xs text-destructive font-medium flex items-center gap-1 ml-auto">
                            <Trash2 className="w-3 h-3" /> Excluir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {plans.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhum plano ainda</p>}
                </div>
              </>
            )}

            {tab === "users" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">{users.length} usuário{users.length !== 1 ? "s" : ""}</p>
                  <Button size="sm" variant="outline" onClick={exportUsersCSV}>
                    <Download className="w-3 h-3 mr-1" /> CSV
                  </Button>
                </div>
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className="bg-muted rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{u.display_name || "Sem nome"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Cadastro: {new Date(u.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      {editingUser?.id === u.id ? (
                        <div className="mt-3 pt-3 border-t border-[hsl(var(--dark-card))] space-y-2">
                          <Input value={editUserName} onChange={(e) => setEditUserName(e.target.value)}
                            placeholder="Nome do usuário" className="bg-[hsl(var(--dark-bg))] border-none text-sm" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={async () => {
                              const { error } = await supabase.from("profiles").update({ display_name: editUserName }).eq("id", u.id);
                              if (error) { toast.error("Erro ao salvar"); return; }
                              toast.success("Nome atualizado!"); setEditingUser(null); fetchData();
                            }}><Save className="w-3 h-3 mr-1" /> Salvar</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[hsl(var(--dark-card))]">
                          <button onClick={() => { setEditingUser(u); setEditUserName(u.display_name || ""); }}
                            className="text-xs text-primary font-medium flex items-center gap-1">
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm("Excluir este usuário e todos os dados dele?")) return;
                            await supabase.from("user_plan_progress").delete().eq("user_id", u.user_id);
                            await supabase.from("user_saved_verses").delete().eq("user_id", u.user_id);
                            await supabase.from("user_streaks").delete().eq("user_id", u.user_id);
                            await supabase.from("profiles").delete().eq("id", u.id);
                            toast.success("Usuário removido"); fetchData();
                          }} className="text-xs text-destructive font-medium flex items-center gap-1 ml-auto">
                            <Trash2 className="w-3 h-3" /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhum usuário cadastrado</p>}
                </div>
              </>
            )}
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
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
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
const SmartAddReadingForm = ({ onAdd, dayNumber, totalDays, isAddToDay }: {
  onAdd: (reading: { bookAbbrev: string; chapter: number; title: string; verseStart?: number; verseEnd?: number }) => void;
  dayNumber: number;
  totalDays: number;
  isAddToDay?: boolean;
}) => {
  const [title, setTitle] = useState("");
  const [selectedBook, setSelectedBook] = useState("");
  const [chapter, setChapter] = useState("");
  const [verseStart, setVerseStart] = useState("");
  const [verseEnd, setVerseEnd] = useState("");
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [expanded, setExpanded] = useState(!isAddToDay);

  const selectedBookData = bibleBooks.find((b) => b.apiAbbrev === selectedBook);
  const filteredBooks = bibleBooks.filter((b) =>
    b.name.toLowerCase().includes(bookSearch.toLowerCase()) || b.apiAbbrev.includes(bookSearch.toLowerCase())
  );

  const handleSubmit = () => {
    if (!selectedBook || !chapter.trim()) { toast.error("Selecione o livro e capítulo"); return; }
    onAdd({
      bookAbbrev: selectedBook, chapter: parseInt(chapter) || 1, title: title.trim(),
      verseStart: verseStart ? parseInt(verseStart) : undefined,
      verseEnd: verseEnd ? parseInt(verseEnd) : undefined,
    });
    setTitle(""); setChapter(""); setVerseStart(""); setVerseEnd("");
    if (isAddToDay) setExpanded(false);
  };

  if (isAddToDay && !expanded) {
    return (
      <button onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-primary font-medium hover:bg-primary/10 rounded-lg transition-colors">
        <Plus className="w-3 h-3" /> Adicionar leitura ao Dia {String(dayNumber).padStart(2, "0")}
      </button>
    );
  }

  return (
    <div className={`${isAddToDay ? "" : "bg-muted rounded-xl p-4"} space-y-3`}>
      {!isAddToDay && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-primary">📅 Novo Dia {String(dayNumber).padStart(2, "0")}</p>
          {totalDays > 0 && <p className="text-[10px] text-muted-foreground">de {totalDays}</p>}
        </div>
      )}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Título do dia (opcional)</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: A Criação do Mundo" className="bg-[hsl(var(--dark-bg))] border-none" maxLength={100} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">📖 Livro da Bíblia *</label>
        <button onClick={() => setShowBookPicker(!showBookPicker)}
          className="w-full flex items-center justify-between bg-[hsl(var(--dark-bg))] rounded-md px-3 py-2 text-sm">
          <span className={selectedBookData ? "" : "text-muted-foreground"}>
            {selectedBookData ? `${selectedBookData.name} (${selectedBookData.chapters} cap.)` : "Selecionar livro..."}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        {showBookPicker && (
          <div className="mt-2 bg-[hsl(var(--dark-bg))] rounded-xl border border-[hsl(var(--dark-card))] max-h-52 overflow-y-auto">
            <div className="p-2 sticky top-0 bg-[hsl(var(--dark-bg))]">
              <Input value={bookSearch} onChange={(e) => setBookSearch(e.target.value)}
                placeholder="Buscar livro..." className="bg-muted border-none text-sm h-8" />
            </div>
            <div className="px-1 pb-1">
              {filteredBooks.map((b) => (
                <button key={b.apiAbbrev}
                  onClick={() => { setSelectedBook(b.apiAbbrev); setShowBookPicker(false); setBookSearch(""); }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors ${
                    selectedBook === b.apiAbbrev ? "bg-primary/15 text-primary font-medium" : ""
                  }`}>
                  {b.name} <span className="text-muted-foreground text-xs">({b.chapters} cap.)</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Capítulo *</label>
          <Input type="number" value={chapter} onChange={(e) => setChapter(e.target.value)}
            placeholder="1" min={1} max={selectedBookData?.chapters || 150}
            className="bg-[hsl(var(--dark-bg))] border-none" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Vers. início</label>
          <Input type="number" value={verseStart} onChange={(e) => setVerseStart(e.target.value)}
            placeholder="—" min={1} className="bg-[hsl(var(--dark-bg))] border-none" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Vers. fim</label>
          <Input type="number" value={verseEnd} onChange={(e) => setVerseEnd(e.target.value)}
            placeholder="—" min={1} className="bg-[hsl(var(--dark-bg))] border-none" />
        </div>
      </div>
      <Button onClick={handleSubmit} className="w-full" size="sm">
        <Plus className="w-3 h-3 mr-1" /> Adicionar Leitura
      </Button>
    </div>
  );
};

export default AdminPanel;
