import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, ChevronLeft, BookOpen, Calendar, ChevronDown } from "lucide-react";
import { bibleBooks } from "@/data/bible";
import type { Database } from "@/integrations/supabase/types";

type Plan = Database["public"]["Tables"]["admin_plans"]["Row"];
type PlanReading = Database["public"]["Tables"]["admin_plan_readings"]["Row"];

const PLAN_CATEGORIES = ["Geral", "Iniciante", "Salmos", "Evangelhos", "Cartas", "Profetas", "Devocional", "Temático"];

interface AdminPlansProps {
  plans: Plan[];
  fetchData: () => void;
}

const AdminPlans = ({ plans, fetchData }: AdminPlansProps) => {
  const [editingPlan, setEditingPlan] = useState<Partial<Plan & { devotional?: string; total_days?: number }> | null>(null);
  const [planReadings, setPlanReadings] = useState<PlanReading[]>([]);
  const [viewingPlanId, setViewingPlanId] = useState<string | null>(null);

  const fetchReadings = async (planId: string) => {
    setViewingPlanId(planId);
    const { data } = await supabase.from("admin_plan_readings").select("*").eq("plan_id", planId).order("day_number", { ascending: true });
    setPlanReadings(data || []);
  };

  const savePlan = async () => {
    if (!editingPlan?.title?.trim() || !editingPlan?.description?.trim()) {
      toast.error("Título e descrição são obrigatórios");
      return;
    }
    const data = {
      title: editingPlan.title.trim(),
      description: editingPlan.description.trim(),
      image_emoji: editingPlan.image_emoji || "📖",
      category: editingPlan.category || "Geral",
      is_active: editingPlan.is_active ?? true,
      sort_order: editingPlan.sort_order ?? 0,
      devotional: editingPlan.devotional || "",
      total_days: editingPlan.total_days || 7,
    };
    let planId = editingPlan.id;
    if (planId) {
      const { error } = await supabase.from("admin_plans").update(data).eq("id", planId);
      if (error) { 
        console.error("[ADMIN PLANS] Update error:", error);
        toast.error(`Erro ao salvar: ${error.message}${error.code === '42501' ? ' (Sem permissão de escrita)' : ''}`); 
        return; 
      }
      toast.success("Plano atualizado!");
    } else {
      const { data: newPlan, error } = await supabase.from("admin_plans").insert(data).select().single();
      if (error || !newPlan) { 
        console.error("[ADMIN PLANS] Insert error:", error);
        toast.error(`Erro ao criar: ${error?.message || 'Erro desconhecido'}${error?.code === '42501' ? ' (Sem permissão de escrita)' : ''}`); 
        return; 
      }
      planId = newPlan.id;
      toast.success("Plano criado! Agora adicione as leituras.");
    }
    setEditingPlan(null);
    fetchData();
    if (planId) fetchReadings(planId);
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("admin_plans").delete().eq("id", id);
    if (error) { 
      console.error("[ADMIN PLANS] Delete error:", error);
      toast.error(`Erro ao excluir: ${error.message}`); 
      return; 
    }
    toast.success("Plano excluído"); fetchData();
  };

  const addReading = async (planId: string, reading: { dayNumber: number; bookAbbrev: string; chapter: number; title: string; verseStart?: number; verseEnd?: number }) => {
    const { error } = await supabase.from("admin_plan_readings").insert({
      plan_id: planId,
      day_number: reading.dayNumber,
      book_abbrev: reading.bookAbbrev.trim(),
      chapter: reading.chapter,
      title: reading.title.trim(),
      verse_start: reading.verseStart || null,
      verse_end: reading.verseEnd || null,
    });
    if (error) { 
      console.error("[ADMIN PLANS] Add reading error:", error);
      toast.error(`Erro ao adicionar leitura: ${error.message}`); 
      return; 
    }
    toast.success(`Leitura adicionada ao Dia ${reading.dayNumber}`);
    fetchReadings(planId);
  };

  const deleteReading = async (id: string) => {
    const { error } = await supabase.from("admin_plan_readings").delete().eq("id", id);
    if (error) {
      console.error("[ADMIN PLANS] Delete reading error:", error);
      toast.error(`Erro ao excluir leitura: ${error.message}`);
      return;
    }
    if (viewingPlanId) fetchReadings(viewingPlanId);
  };

  if (editingPlan) {
    const totalDays = editingPlan.total_days || 7;
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
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Quantos dias tem o plano? *
            </label>
            <div className="flex items-center gap-3">
              <Input type="number" value={totalDays}
                onChange={(e) => setEditingPlan({ ...editingPlan, total_days: parseInt(e.target.value) || 1 })}
                min={1} max={365} className="bg-[hsl(var(--dark-card))] border-none w-24" />
              <span className="text-xs text-[hsl(var(--dark-muted))]">dias de leitura</span>
            </div>
            <div className="flex gap-2 mt-2">
              {[7, 14, 21, 30, 60, 90].map((d) => (
                <button key={d} onClick={() => setEditingPlan({ ...editingPlan, total_days: d })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    totalDays === d ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"
                  }`}>{d}d</button>
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
            <Textarea value={editingPlan.devotional || ""}
              onChange={(e) => setEditingPlan({ ...editingPlan, devotional: e.target.value })}
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
                  }`}>{cat}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Ordem</label>
            <Input type="number" value={editingPlan.sort_order ?? 0}
              onChange={(e) => setEditingPlan({ ...editingPlan, sort_order: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-card))] border-none w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (viewingPlanId) {
    const plan = plans.find((p) => p.id === viewingPlanId);
    const totalDays = plan?.total_days as number || 0;
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
              <p className="text-xs text-[hsl(var(--dark-muted))]">{filledDays}/{totalDays} dias preenchidos • {progress}%</p>
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
        </header>
        <div className="px-5 py-4 space-y-4">
          {existingDays.map((dayNum) => {
            const dayReadings = dayGroups[dayNum];
            return (
              <div key={dayNum} className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-primary">📅 Dia {String(dayNum).padStart(2, "0")}</p>
                </div>
                {dayReadings.map((r) => {
                  const book = bibleBooks.find((b) => b.apiAbbrev === r.book_abbrev);
                  const vs = r.verse_start;
                  const ve = r.verse_end;
                  const verseRange = vs ? `${vs}${ve ? `-${ve}` : ""}` : "";
                  return (
                    <div key={r.id} className="flex items-center gap-3 bg-[hsl(var(--dark-bg))] rounded-lg p-2.5">
                      <div className="flex-1 min-w-0">
                        {r.title && <p className="text-[10px] font-semibold text-primary truncate">{r.title}</p>}
                        <p className="text-sm">
                          {book?.name || r.book_abbrev} {r.chapter}
                          {verseRange && <span className="text-[hsl(var(--dark-muted))]">:{verseRange}</span>}
                        </p>
                      </div>
                      <button onClick={() => deleteReading(r.id)} className="text-destructive p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                <SmartAddReadingForm
                  onAdd={(reading) => addReading(viewingPlanId!, { ...reading, dayNumber: dayNum })}
                  dayNumber={dayNum} totalDays={totalDays} isAddToDay
                />
              </div>
            );
          })}
          {canAddNewDay && (
            <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
              <SmartAddReadingForm
                onAdd={(reading) => addReading(viewingPlanId!, { ...reading, dayNumber: nextNewDay })}
                dayNumber={nextNewDay} totalDays={totalDays}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setEditingPlan({ is_active: true, sort_order: 0, image_emoji: "📖", category: "Geral", total_days: 7 })} className="w-full mb-4">
        <Plus className="w-4 h-4 mr-2" /> Novo Plano
      </Button>
      <div className="space-y-2">
        {plans.map((plan) => (
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
                <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1"><Calendar className="w-3 h-3 inline mr-1" />{plan.total_days} dias</p>
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
        ))}
      </div>
    </>
  );
};

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
    <div className={`${isAddToDay ? "" : "bg-[hsl(var(--dark-card))] rounded-xl p-4"} space-y-3`}>
      {!isAddToDay && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-primary">📅 Novo Dia {String(dayNumber).padStart(2, "0")}</p>
        </div>
      )}
      <div>
        <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Título do dia (opcional)</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: A Criação do Mundo" className="bg-[hsl(var(--dark-bg))] border-none" maxLength={100} />
      </div>
      <div>
        <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">📖 Livro da Bíblia *</label>
        <button onClick={() => setShowBookPicker(!showBookPicker)}
          className="w-full flex items-center justify-between bg-[hsl(var(--dark-bg))] rounded-md px-3 py-2 text-sm">
          <span className={selectedBookData ? "" : "text-[hsl(var(--dark-muted))]"}>
            {selectedBookData ? `${selectedBookData.name} (${selectedBookData.chapters} cap.)` : "Selecionar livro..."}
          </span>
          <ChevronDown className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
        </button>
        {showBookPicker && (
          <div className="mt-2 bg-[hsl(var(--dark-bg))] rounded-xl border border-[hsl(var(--dark-card))] max-h-52 overflow-y-auto">
            <div className="p-2 sticky top-0 bg-[hsl(var(--dark-bg))]">
              <Input value={bookSearch} onChange={(e) => setBookSearch(e.target.value)}
                placeholder="Buscar livro..." className="bg-[hsl(var(--dark-card))] border-none text-sm h-8" />
            </div>
            <div className="px-1 pb-1">
              {filteredBooks.map((b) => (
                <button key={b.apiAbbrev}
                  onClick={() => { setSelectedBook(b.apiAbbrev); setShowBookPicker(false); setBookSearch(""); }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[hsl(var(--dark-card))] transition-colors ${
                    selectedBook === b.apiAbbrev ? "bg-primary/15 text-primary font-medium" : ""
                  }`}>
                  {b.name} <span className="text-[hsl(var(--dark-muted))] text-xs">({b.chapters} cap.)</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Capítulo *</label>
          <Input type="number" value={chapter} onChange={(e) => setChapter(e.target.value)}
            placeholder="1" min={1} max={selectedBookData?.chapters || 150}
            className="bg-[hsl(var(--dark-bg))] border-none" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Vers. início</label>
          <Input type="number" value={verseStart} onChange={(e) => setVerseStart(e.target.value)}
            placeholder="—" min={1} className="bg-[hsl(var(--dark-bg))] border-none" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Vers. fim</label>
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

export default AdminPlans;