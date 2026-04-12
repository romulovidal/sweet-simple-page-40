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
} from "lucide-react";
import { bibleBooks } from "@/data/bible";
import type { Database } from "@/integrations/supabase/types";

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

const AdminPanel = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"posts" | "plans">("posts");
  const [posts, setPosts] = useState<Post[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [editingPlan, setEditingPlan] = useState<Partial<Plan & { devotional?: string; total_days?: number }> | null>(null);
  const [planReadings, setPlanReadings] = useState<PlanReading[]>([]);
  const [viewingPlanId, setViewingPlanId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [postsRes, plansRes] = await Promise.all([
      supabase.from("admin_posts").select("*").order("sort_order", { ascending: true }),
      supabase.from("admin_plans").select("*").order("sort_order", { ascending: true }),
    ]);
    if (postsRes.data) setPosts(postsRes.data);
    if (plansRes.data) setPlans(plansRes.data);
    setLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/admin"); };

  // ---- POSTS ----
  const savePost = async () => {
    if (!editingPost?.title?.trim() || !editingPost?.content?.trim()) { toast.error("Título e conteúdo são obrigatórios"); return; }
    const data = {
      title: editingPost.title.trim(), content: editingPost.content.trim(),
      type: editingPost.type || "devocional", youtube_url: editingPost.youtube_url?.trim() || null,
      bible_reference: editingPost.bible_reference?.trim() || null, image_url: editingPost.image_url?.trim() || null,
      is_active: editingPost.is_active ?? true, sort_order: editingPost.sort_order ?? 0,
    };
    if (editingPost.id) {
      const { error } = await supabase.from("admin_posts").update(data).eq("id", editingPost.id);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Postagem atualizada!");
    } else {
      const { error } = await supabase.from("admin_posts").insert(data);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Postagem criada!");
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
    // Auto-open readings view for the plan
    if (planId) {
      fetchReadings(planId);
    }
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

  const addReading = async (planId: string, reading: { bookAbbrev: string; chapter: number; title: string; verseStart?: number; verseEnd?: number }) => {
    const nextDay = planReadings.length + 1;
    const { error } = await supabase.from("admin_plan_readings").insert({
      plan_id: planId, day_number: nextDay, book_abbrev: reading.bookAbbrev.trim(),
      chapter: reading.chapter, title: reading.title.trim(),
      verse_start: reading.verseStart || null, verse_end: reading.verseEnd || null,
    });
    if (error) { toast.error("Erro ao adicionar leitura"); return; }
    toast.success(`Dia ${nextDay} adicionado`);
    fetchReadings(planId);
  };

  const deleteReading = async (id: string) => {
    await supabase.from("admin_plan_readings").delete().eq("id", id);
    if (viewingPlanId) fetchReadings(viewingPlanId);
  };

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
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {POST_TYPES.map((t) => (
                <button key={t.value} onClick={() => setEditingPost({ ...editingPost, type: t.value })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    editingPost.type === t.value ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"
                  }`}>
                  <t.icon className="w-3 h-3" /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Título</label>
            <Input value={editingPost.title || ""} onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
              className="bg-[hsl(var(--dark-card))] border-none" maxLength={200} />
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Conteúdo</label>
            <Textarea value={editingPost.content || ""} onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
              className="bg-[hsl(var(--dark-card))] border-none min-h-[120px]" maxLength={5000} />
          </div>
          {editingPost.type === "video" && (
            <div>
              <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">URL do YouTube</label>
              <Input value={editingPost.youtube_url || ""} onChange={(e) => setEditingPost({ ...editingPost, youtube_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..." className="bg-[hsl(var(--dark-card))] border-none" maxLength={500} />
            </div>
          )}
          {(editingPost.type === "versiculo" || editingPost.type === "oracao") && (
            <div>
              <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Referência Bíblica</label>
              <Input value={editingPost.bible_reference || ""} onChange={(e) => setEditingPost({ ...editingPost, bible_reference: e.target.value })}
                placeholder="Ex: João 3:16" className="bg-[hsl(var(--dark-card))] border-none" maxLength={100} />
            </div>
          )}
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Ordem de exibição</label>
            <Input type="number" value={editingPost.sort_order ?? 0}
              onChange={(e) => setEditingPost({ ...editingPost, sort_order: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-card))] border-none w-24" />
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
              <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Emoji</label>
              <Input value={editingPlan.image_emoji || "📖"}
                onChange={(e) => setEditingPlan({ ...editingPlan, image_emoji: e.target.value })}
                className="bg-[hsl(var(--dark-card))] border-none w-16 text-center text-2xl" maxLength={4} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Título do Plano *</label>
              <Input value={editingPlan.title || ""}
                onChange={(e) => setEditingPlan({ ...editingPlan, title: e.target.value })}
                placeholder="Ex: 21 Dias nos Salmos" className="bg-[hsl(var(--dark-card))] border-none" maxLength={200} />
            </div>
          </div>

          {/* Total Days */}
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Quantos dias tem o plano? *
            </label>
            <div className="flex items-center gap-3">
              <Input type="number" value={totalDays}
                onChange={(e) => setEditingPlan({ ...editingPlan, total_days: parseInt(e.target.value) || 1 } as typeof editingPlan)}
                min={1} max={365} className="bg-[hsl(var(--dark-card))] border-none w-24" />
              <span className="text-xs text-[hsl(var(--dark-muted))]">dias de leitura</span>
            </div>
            <div className="flex gap-2 mt-2">
              {[7, 14, 21, 30, 60, 90].map((d) => (
                <button key={d} onClick={() => setEditingPlan({ ...editingPlan, total_days: d } as typeof editingPlan)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    totalDays === d ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"
                  }`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Descrição *</label>
            <Textarea value={editingPlan.description || ""}
              onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
              placeholder="Breve descrição do plano..." className="bg-[hsl(var(--dark-card))] border-none" maxLength={1000} />
          </div>

          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Devocional / Introdução</label>
            <Textarea value={(editingPlan as { devotional?: string }).devotional || ""}
              onChange={(e) => setEditingPlan({ ...editingPlan, devotional: e.target.value } as typeof editingPlan)}
              placeholder="Texto devocional de abertura do plano..."
              className="bg-[hsl(var(--dark-card))] border-none min-h-[100px]" maxLength={5000} />
          </div>

          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {PLAN_CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setEditingPlan({ ...editingPlan, category: cat })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    editingPlan.category === cat ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Ordem</label>
            <Input type="number" value={editingPlan.sort_order ?? 0}
              onChange={(e) => setEditingPlan({ ...editingPlan, sort_order: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-card))] border-none w-24" />
          </div>

          <div className="bg-primary/10 rounded-xl p-4">
            <p className="text-xs text-primary font-semibold mb-1">💡 Próximo passo</p>
            <p className="text-xs text-[hsl(var(--dark-muted))]">
              Ao salvar, você será direcionado para adicionar as leituras dia a dia, 
              linkando cada dia com o livro, capítulo e versículos da Bíblia.
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
    const progress = totalDays > 0 ? Math.round((planReadings.length / totalDays) * 100) : 0;

    return (
      <div className="min-h-screen pb-10">
        <header className="px-5 pt-8 pb-4 border-b border-[hsl(var(--dark-card))]">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewingPlanId(null)}><ChevronLeft className="w-5 h-5" /></button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">{plan?.title}</h1>
              <p className="text-xs text-[hsl(var(--dark-muted))]">
                {planReadings.length}/{totalDays} dias preenchidos • {progress}%
              </p>
            </div>
            <button onClick={() => plan && setEditingPlan(plan)} className="text-xs text-primary font-semibold">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
          {totalDays > 0 && (
            <div className="w-full h-2 bg-[hsl(var(--dark-card))] rounded-full overflow-hidden mt-3">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          )}
          {planReadings.length < totalDays && (
            <p className="text-[10px] text-amber-400 mt-2">
              ⚠️ Faltam {totalDays - planReadings.length} dias para completar o plano
            </p>
          )}
          {planReadings.length >= totalDays && totalDays > 0 && (
            <p className="text-[10px] text-green-400 mt-2">✅ Plano completo! Todos os {totalDays} dias foram preenchidos.</p>
          )}
        </header>

        <div className="px-5 py-4">
          {/* Add reading - only if not complete */}
          {(totalDays === 0 || planReadings.length < totalDays) && (
            <SmartAddReadingForm
              onAdd={(reading) => addReading(viewingPlanId, reading)}
              dayNumber={planReadings.length + 1}
              totalDays={totalDays}
            />
          )}

          {/* Existing readings */}
          <div className="space-y-2 mt-4">
            {planReadings.map((r) => {
              const book = bibleBooks.find((b) => b.apiAbbrev === r.book_abbrev);
              const vs = (r as Record<string, unknown>).verse_start as number | null;
              const ve = (r as Record<string, unknown>).verse_end as number | null;
              const verseRange = vs ? `${vs}${ve ? `-${ve}` : ""}` : "";
              const readingTitle = (r as Record<string, unknown>).title as string;
              return (
                <div key={r.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{r.day_number}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {readingTitle && <p className="text-xs font-semibold text-primary truncate">{readingTitle}</p>}
                      <p className="text-sm">
                        {book?.name || r.book_abbrev} {r.chapter}
                        {verseRange && <span className="text-[hsl(var(--dark-muted))]">:{verseRange}</span>}
                      </p>
                    </div>
                    <button onClick={() => deleteReading(r.id)} className="text-destructive p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {planReadings.length === 0 && (
              <div className="text-center py-10">
                <BookOpen className="w-10 h-10 text-[hsl(var(--dark-muted))] mx-auto mb-3 opacity-40" />
                <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhuma leitura adicionada</p>
                <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">
                  Adicione {totalDays > 0 ? `as ${totalDays} leituras` : "as leituras"} linkando com os capítulos da Bíblia
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- MAIN LIST ----
  return (
    <div className="min-h-screen pb-10">
      <header className="px-5 pt-8 pb-4 flex items-center justify-between border-b border-[hsl(var(--dark-card))]">
        <div>
          <h1 className="text-xl font-bold">Painel Admin</h1>
          <p className="text-xs text-[hsl(var(--dark-muted))]">A Bíblia do Atalaia</p>
        </div>
        <button onClick={handleLogout} className="text-[hsl(var(--dark-muted))]"><LogOut className="w-5 h-5" /></button>
      </header>

      <div className="px-5 flex gap-4 border-b border-[hsl(var(--dark-card))]">
        {(["posts", "plans"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-3 text-sm font-semibold transition-colors ${
              tab === t ? "text-foreground border-b-2 border-primary" : "text-[hsl(var(--dark-muted))]"
            }`}>
            {t === "posts" ? "Postagens" : "Planos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="px-5 py-4">
          {tab === "posts" ? (
            <>
              <Button onClick={() => setEditingPost({ type: "devocional", is_active: true, sort_order: 0 })} className="w-full mb-4">
                <Plus className="w-4 h-4 mr-2" /> Nova Postagem
              </Button>
              <div className="space-y-2">
                {posts.map((post) => {
                  const typeInfo = POST_TYPES.find((t) => t.value === post.type);
                  const Icon = typeInfo?.icon || FileText;
                  return (
                    <div key={post.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">{post.title}</p>
                            {!post.is_active && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">Oculto</span>}
                          </div>
                          <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5 line-clamp-2">{post.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-background">
                        <button onClick={() => setEditingPost(post)} className="text-xs text-primary font-medium flex items-center gap-1">
                          <Edit2 className="w-3 h-3" /> Editar
                        </button>
                        <button onClick={() => togglePostActive(post)} className="text-xs text-[hsl(var(--dark-muted))] font-medium flex items-center gap-1 ml-auto">
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
                {posts.length === 0 && <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-10">Nenhuma postagem ainda</p>}
              </div>
            </>
          ) : (
            <>
              <Button onClick={() => setEditingPlan({ is_active: true, sort_order: 0, image_emoji: "📖", category: "Geral", total_days: 7 } as Partial<Plan>)} className="w-full mb-4">
                <Plus className="w-4 h-4 mr-2" /> Novo Plano
              </Button>
              <div className="space-y-2">
                {plans.map((plan) => {
                  const td = (plan as Record<string, unknown>).total_days as number || 0;
                  return (
                    <div key={plan.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{plan.image_emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{plan.title}</p>
                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{plan.category}</span>
                            {!plan.is_active && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">Oculto</span>}
                          </div>
                          <p className="text-xs text-[hsl(var(--dark-muted))] line-clamp-1">{plan.description}</p>
                          <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">
                            <Calendar className="w-3 h-3 inline mr-1" />{td} dias
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-background">
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
                {plans.length === 0 && <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-10">Nenhum plano ainda</p>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Smart reading form with book selector
const SmartAddReadingForm = ({ onAdd, dayNumber, totalDays }: {
  onAdd: (reading: { bookAbbrev: string; chapter: number; title: string; verseStart?: number; verseEnd?: number }) => void;
  dayNumber: number;
  totalDays: number;
}) => {
  const [title, setTitle] = useState("");
  const [selectedBook, setSelectedBook] = useState("");
  const [chapter, setChapter] = useState("");
  const [verseStart, setVerseStart] = useState("");
  const [verseEnd, setVerseEnd] = useState("");
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [bookSearch, setBookSearch] = useState("");

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
  };

  return (
    <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-primary">📅 Dia {dayNumber}</p>
        {totalDays > 0 && <p className="text-[10px] text-[hsl(var(--dark-muted))]">de {totalDays}</p>}
      </div>

      <div>
        <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Título do dia (opcional)</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: A Criação do Mundo" className="bg-background border-none" maxLength={100} />
      </div>

      <div>
        <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">📖 Livro da Bíblia *</label>
        <button onClick={() => setShowBookPicker(!showBookPicker)}
          className="w-full flex items-center justify-between bg-background rounded-md px-3 py-2 text-sm">
          <span className={selectedBookData ? "" : "text-[hsl(var(--dark-muted))]"}>
            {selectedBookData ? `${selectedBookData.name} (${selectedBookData.chapters} cap.)` : "Selecionar livro..."}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showBookPicker ? "rotate-180" : ""}`} />
        </button>
        {showBookPicker && (
          <div className="mt-1 bg-background rounded-xl border border-[hsl(var(--dark-card))] max-h-48 overflow-y-auto">
            <div className="p-2 sticky top-0 bg-background">
              <Input value={bookSearch} onChange={(e) => setBookSearch(e.target.value)}
                placeholder="Buscar livro..." className="bg-[hsl(var(--dark-card))] border-none text-xs h-8" />
            </div>
            {filteredBooks.map((book) => (
              <button key={book.apiAbbrev}
                onClick={() => { setSelectedBook(book.apiAbbrev); setShowBookPicker(false); setBookSearch(""); setChapter(""); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-[hsl(var(--dark-card))] transition-colors ${
                  selectedBook === book.apiAbbrev ? "text-primary font-semibold" : ""
                }`}>
                {book.name} <span className="text-[hsl(var(--dark-muted))]">({book.chapters} cap.)</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chapter selector with quick buttons when book is selected */}
      {selectedBookData && (
        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Capítulo *</label>
          <div className="flex gap-2 items-center mb-2">
            <Input type="number" value={chapter} onChange={(e) => setChapter(e.target.value)}
              min={1} max={selectedBookData.chapters} placeholder={`1-${selectedBookData.chapters}`}
              className="bg-background border-none w-24" />
            <span className="text-xs text-[hsl(var(--dark-muted))]">de {selectedBookData.chapters}</span>
          </div>
          {selectedBookData.chapters <= 30 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: selectedBookData.chapters }, (_, i) => i + 1).map((ch) => (
                <button key={ch} onClick={() => setChapter(String(ch))}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    chapter === String(ch) ? "bg-primary text-primary-foreground" : "bg-background text-[hsl(var(--dark-muted))]"
                  }`}>
                  {ch}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedBookData && (
        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Capítulo *</label>
          <Input type="number" value={chapter} onChange={(e) => setChapter(e.target.value)}
            min={1} placeholder="—" className="bg-background border-none w-24" />
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Versículo início (opcional)</label>
          <Input type="number" value={verseStart} onChange={(e) => setVerseStart(e.target.value)}
            min={1} placeholder="—" className="bg-background border-none" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Versículo fim (opcional)</label>
          <Input type="number" value={verseEnd} onChange={(e) => setVerseEnd(e.target.value)}
            min={1} placeholder="—" className="bg-background border-none" />
        </div>
      </div>

      <Button onClick={handleSubmit} className="w-full" size="sm">
        <Plus className="w-4 h-4 mr-1" /> Adicionar Dia {dayNumber}{totalDays > 0 ? ` de ${totalDays}` : ""}
      </Button>
    </div>
  );
};

export default AdminPanel;
