import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, BookOpen, Link as LinkIcon, FileText, Image as ImageIcon } from "lucide-react";

interface Revista {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  pdf_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const AdminRevistas = () => {
  const [revistas, setRevistas] = useState<Revista[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRevista, setEditingRevista] = useState<Partial<Revista> | null>(null);

  const fetchRevistas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_revistas")
      .select("*")
      .order("sort_order", { ascending: true });
    
    if (error) {
      toast.error("Erro ao carregar revistas");
    } else {
      setRevistas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRevistas();
  }, []);

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
      const { error } = await supabase.from("admin_revistas").update(data).eq("id", editingRevista.id);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Revista atualizada");
    } else {
      const { error } = await supabase.from("admin_revistas").insert(data);
      if (error) toast.error("Erro ao criar");
      else toast.success("Revista criada");
    }

    setEditingRevista(null);
    fetchRevistas();
  };

  const deleteRevista = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta revista?")) return;
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
                <button onClick={() => setEditingRevista(revista)} className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
                  <Edit2 className="w-3 h-3" /> Editar
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
