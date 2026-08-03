import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, BookOpen, Link as LinkIcon, Image as ImageIcon, FileText, ChevronRight, Calendar, Quote, MessageSquare, Music, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Revista {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  pdf_url: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

const AdminRevistas = () => {
  const [revistas, setRevistas] = useState<Revista[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRevista, setEditingRevista] = useState<Partial<Revista> | null>(null);

  const [aulas, setAulas] = useState<any[]>([]);
  const [selectedRevistaId, setSelectedRevistaId] = useState<string | null>(null);
  const [editingAula, setEditingAula] = useState<any | null>(null);

  const fetchRevistas = async () => {
    setLoading(true);
    // @ts-ignore
    const { data, error } = await supabase
      .from("admin_revistas")
      .select("*")
      .order("sort_order", { ascending: true });
    
    if (error) {
      console.error("Error fetching revistas:", error);
      toast.error("Erro ao carregar revistas");
    } else {
      // Cast to any then to Revista[] to bypass complex PostgREST return type issues 
      // when the table is not yet in the generated types.
      setRevistas((data as any) || []);
    }
    setLoading(false);
  };

  const fetchAulas = async (revistaId: string) => {
    // @ts-ignore
    const { data, error } = await supabase
      .from("revista_aulas")
      .select("*")
      .eq("revista_id", revistaId)
      .order("lesson_number");
    
    if (error) toast.error("Erro ao carregar aulas");
    else setAulas(data || []);
  };

  useEffect(() => {
    fetchRevistas();
  }, []);

  useEffect(() => {
    if (selectedRevistaId) {
      fetchAulas(selectedRevistaId);
    }
  }, [selectedRevistaId]);

  const saveAula = async () => {
    if (!editingAula?.title?.trim() || !selectedRevistaId) return;

    const data = {
      ...editingAula,
      revista_id: selectedRevistaId,
    };

    if (editingAula.id) {
      // @ts-ignore
      const { error } = await supabase.from("revista_aulas").update(data).eq("id", editingAula.id);
      if (error) toast.error("Erro ao atualizar aula");
      else toast.success("Aula atualizada");
    } else {
      // @ts-ignore
      const { error } = await supabase.from("revista_aulas").insert(data);
      if (error) toast.error("Erro ao criar aula");
      else toast.success("Aula criada");
    }

    setEditingAula(null);
    fetchAulas(selectedRevistaId);
  };

  const deleteAula = async (id: string) => {
    if (!confirm("Excluir esta aula?")) return;
    // @ts-ignore
    const { error } = await supabase.from("revista_aulas").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else if (selectedRevistaId) fetchAulas(selectedRevistaId);
  };

  const saveRevista = async () => {
    if (!editingRevista?.title?.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    const data = {
      title: editingRevista.title.trim(),
      description: editingRevista.description?.trim() || null,
      image_url: editingRevista.image_url?.trim() || null,
      pdf_url: editingRevista.pdf_url?.trim() || null,
      is_active: editingRevista.is_active ?? true,
      sort_order: editingRevista.sort_order ?? 0,
    };

    if (editingRevista.id) {
      // @ts-ignore
      const { error } = await supabase.from("admin_revistas").update(data).eq("id", editingRevista.id);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Revista atualizada");
    } else {
      // @ts-ignore
      const { error } = await supabase.from("admin_revistas").insert(data);
      if (error) toast.error("Erro ao criar");
      else toast.success("Revista criada");
    }

    setEditingRevista(null);
    fetchRevistas();
  };

  const deleteRevista = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta revista?")) return;
    // @ts-ignore
    const { error } = await supabase.from("admin_revistas").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Revista excluída");
      fetchRevistas();
    }
  };

  if (editingRevista) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditingRevista(null)} className="p-2 hover:bg-[hsl(var(--dark-card-hover))] rounded-full transition-colors">
            <X className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
          </button>
          <h2 className="text-xl font-bold text-[hsl(var(--dark-text))]">
            {editingRevista.id ? "Editar Revista" : "Nova Revista"}
          </h2>
        </header>

        <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-2 block">Título da Edição</label>
            <Input 
              value={editingRevista.title || ""} 
              onChange={(e) => setEditingRevista({ ...editingRevista, title: e.target.value })}
              placeholder="Ex: Revista 01 - A Fé Cristã"
              className="bg-[hsl(var(--dark-bg))] border-none h-12 rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-2 block">Descrição / Resumo</label>
            <Textarea 
              value={editingRevista.description || ""} 
              onChange={(e) => setEditingRevista({ ...editingRevista, description: e.target.value })}
              placeholder="Breve descrição do conteúdo da revista..."
              className="bg-[hsl(var(--dark-bg))] border-none min-h-[100px] rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-2 block flex items-center gap-2">
                <ImageIcon className="w-3 h-3" /> URL da Capa (Imagem)
              </label>
              <Input 
                value={editingRevista.image_url || ""} 
                onChange={(e) => setEditingRevista({ ...editingRevista, image_url: e.target.value })}
                placeholder="https://exemplo.com/capa.jpg"
                className="bg-[hsl(var(--dark-bg))] border-none h-12 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-2 block flex items-center gap-2">
                <LinkIcon className="w-3 h-3" /> URL do PDF / Leitura
              </label>
              <Input 
                value={editingRevista.pdf_url || ""} 
                onChange={(e) => setEditingRevista({ ...editingRevista, pdf_url: e.target.value })}
                placeholder="https://exemplo.com/revista.pdf"
                className="bg-[hsl(var(--dark-bg))] border-none h-12 rounded-xl"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <Button onClick={saveRevista} className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold">
              <Save className="w-4 h-4 mr-2" /> Salvar Revista
            </Button>
            <Button variant="outline" onClick={() => setEditingRevista(null)} className="h-12 px-6 rounded-xl border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))]">
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedRevistaId) {
    const revista = revistas.find(r => r.id === selectedRevistaId);
    
    if (editingAula) {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <header className="flex items-center gap-3 mb-6">
            <button onClick={() => setEditingAula(null)} className="p-2 hover:bg-[hsl(var(--dark-card-hover))] rounded-full transition-colors">
              <X className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
            </button>
            <h2 className="text-xl font-bold text-[hsl(var(--dark-text))]">
              {editingAula.id ? "Editar Aula" : "Nova Aula"}
            </h2>
          </header>

          <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <label className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase mb-2 block">Nº Lição</label>
                <Input 
                  type="number"
                  value={editingAula.lesson_number || ""} 
                  onChange={(e) => setEditingAula({ ...editingAula, lesson_number: parseInt(e.target.value) })}
                  className="bg-[hsl(var(--dark-bg))] border-none h-12 rounded-xl"
                />
              </div>
              <div className="col-span-3">
                <label className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase mb-2 block">Título da Lição</label>
                <Input 
                  value={editingAula.title || ""} 
                  onChange={(e) => setEditingAula({ ...editingAula, title: e.target.value })}
                  className="bg-[hsl(var(--dark-bg))] border-none h-12 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase mb-2 block">Data Sugerida</label>
              <Input 
                value={editingAula.date || ""} 
                onChange={(e) => setEditingAula({ ...editingAula, date: e.target.value })}
                placeholder="Ex: 5 de Outubro de 2025"
                className="bg-[hsl(var(--dark-bg))] border-none h-12 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase mb-2 block">Texto Áureo</label>
              <Textarea 
                value={editingAula.golden_text || ""} 
                onChange={(e) => setEditingAula({ ...editingAula, golden_text: e.target.value })}
                className="bg-[hsl(var(--dark-bg))] border-none min-h-[80px] rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase mb-2 block">Verdade Prática</label>
              <Textarea 
                value={editingAula.practical_truth || ""} 
                onChange={(e) => setEditingAula({ ...editingAula, practical_truth: e.target.value })}
                className="bg-[hsl(var(--dark-bg))] border-none min-h-[80px] rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase mb-2 block">Leitura Bíblica em Classe</label>
              <Textarea 
                value={editingAula.bible_reading_in_class || ""} 
                onChange={(e) => setEditingAula({ ...editingAula, bible_reading_in_class: e.target.value })}
                className="bg-[hsl(var(--dark-bg))] border-none min-h-[120px] rounded-xl"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button onClick={saveAula} className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold">
                <Save className="w-4 h-4 mr-2" /> Salvar Aula
              </Button>
              <Button variant="outline" onClick={() => setEditingAula(null)} className="h-12 px-6 rounded-xl border-[hsl(var(--dark-card-hover))]">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <button onClick={() => setSelectedRevistaId(null)} className="p-2 hover:bg-[hsl(var(--dark-card-hover))] rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[hsl(var(--dark-text))]">{revista?.title}</h2>
            <p className="text-sm text-[hsl(var(--dark-muted))]">Gerenciando {aulas.length} aulas</p>
          </div>
          <Button onClick={() => setEditingAula({ title: "", lesson_number: aulas.length + 1 })} className="ml-auto rounded-xl h-10 px-4">
            <Plus className="w-4 h-4 mr-2" /> Nova Aula
          </Button>
        </header>

        <div className="grid grid-cols-1 gap-3">
          {aulas.map((aula) => (
            <div key={aula.id} className="bg-[hsl(var(--dark-card))] rounded-2xl p-4 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  {aula.lesson_number}
                </div>
                <div>
                  <h3 className="font-bold text-[hsl(var(--dark-text))]">{aula.title}</h3>
                  <p className="text-xs text-[hsl(var(--dark-muted))]">{aula.date || "Sem data"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingAula(aula)} className="p-2 hover:bg-primary/10 rounded-lg text-primary transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => deleteAula(aula.id)} className="p-2 hover:bg-destructive/10 rounded-lg text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {aulas.length === 0 && (
            <div className="text-center py-12 bg-[hsl(var(--dark-card))] rounded-3xl border-2 border-dashed border-[hsl(var(--dark-card-hover))]">
              <p className="text-[hsl(var(--dark-muted))] font-medium">Nenhuma aula cadastrada nesta revista</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[hsl(var(--dark-text))]">Revista de Estudos</h2>
          <p className="text-sm text-[hsl(var(--dark-muted))]">Gerencie as edições da revista bíblica</p>
        </div>
        <Button onClick={() => setEditingRevista({ title: "", is_active: true, sort_order: revistas.length })} className="rounded-xl h-10 px-4">
          <Plus className="w-4 h-4 mr-2" /> Nova Edição
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {revistas.map((revista) => (
          <div key={revista.id} className="bg-[hsl(var(--dark-card))] rounded-2xl p-4 flex items-center gap-4 group">
            <div className="w-16 h-20 rounded-lg bg-[hsl(var(--dark-bg))] flex items-center justify-center overflow-hidden shrink-0 border border-[hsl(var(--dark-card-hover))]">
              {revista.image_url ? (
                <img src={revista.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <BookOpen className="w-6 h-6 text-[hsl(var(--dark-muted))]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[hsl(var(--dark-text))] truncate">{revista.title}</h3>
              <p className="text-xs text-[hsl(var(--dark-muted))] line-clamp-2 mt-1">{revista.description || "Sem descrição"}</p>
              <div className="flex items-center gap-3 mt-2">
                <button onClick={() => setSelectedRevistaId(revista.id)} className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
                  <FileText className="w-3 h-3" /> Gerenciar Aulas
                </button>
                <button onClick={() => setEditingRevista(revista)} className="text-[11px] font-bold text-[hsl(var(--dark-muted))] flex items-center gap-1 hover:underline">
                  <Edit2 className="w-3 h-3" /> Editar Info
                </button>
                <button onClick={() => deleteRevista(revista.id)} className="text-[11px] font-bold text-destructive flex items-center gap-1 hover:underline">
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && revistas.length === 0 && (
          <div className="text-center py-12 bg-[hsl(var(--dark-card))] rounded-3xl border-2 border-dashed border-[hsl(var(--dark-card-hover))]">
            <BookOpen className="w-12 h-12 text-[hsl(var(--dark-muted))] mx-auto mb-3 opacity-20" />
            <p className="text-[hsl(var(--dark-muted))] font-medium">Nenhuma revista cadastrada</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRevistas;
