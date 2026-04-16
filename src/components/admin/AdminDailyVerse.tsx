import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit2, Save, X, BookOpen, Loader2, Calendar } from "lucide-react";

interface VerseQueueItem {
  id: string;
  verse_text: string;
  verse_ref: string;
  scheduled_date: string;
}

const AdminDailyVerse = () => {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [queue, setQueue] = useState<VerseQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<VerseQueueItem> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Load mode setting
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "daily_verse_mode")
      .single();
    if (settings) {
      const val = typeof settings.value === "string" ? settings.value : JSON.stringify(settings.value);
      setMode(val.replace(/"/g, "") as "auto" | "manual");
    }

    // Load queue
    const { data: queueData } = await supabase
      .from("daily_verse_queue")
      .select("*")
      .gte("scheduled_date", new Date().toISOString().split("T")[0])
      .order("scheduled_date", { ascending: true });
    setQueue(queueData || []);
    setLoading(false);
  };

  const toggleMode = async (checked: boolean) => {
    const newMode = checked ? "manual" : "auto";
    setMode(newMode);
    await supabase
      .from("admin_settings")
      .upsert({ key: "daily_verse_mode", value: JSON.stringify(newMode), updated_at: new Date().toISOString() }, { onConflict: "key" });
    toast.success(newMode === "manual" ? "Modo manual ativado" : "Modo automático ativado");
  };

  const saveVerse = async () => {
    if (!editing?.verse_text?.trim() || !editing?.verse_ref?.trim() || !editing?.scheduled_date) {
      toast.error("Preencha todos os campos");
      return;
    }
    const data = {
      verse_text: editing.verse_text.trim(),
      verse_ref: editing.verse_ref.trim(),
      scheduled_date: editing.scheduled_date,
    };

    if (editing.id) {
      const { error } = await supabase.from("daily_verse_queue").update(data).eq("id", editing.id);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Versículo atualizado!");
    } else {
      const { error } = await supabase.from("daily_verse_queue").insert(data);
      if (error) {
        if (error.code === "23505") toast.error("Já existe um versículo para esta data");
        else toast.error("Erro ao criar");
        return;
      }
      toast.success("Versículo agendado!");
    }
    setEditing(null);
    loadData();
  };

  const deleteVerse = async (id: string) => {
    await supabase.from("daily_verse_queue").delete().eq("id", id);
    toast.success("Removido da fila");
    loadData();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(null)}><X className="w-5 h-5" /></button>
          <h2 className="text-lg font-bold flex-1">{editing.id ? "Editar" : "Novo"} Versículo</h2>
          <Button size="sm" onClick={saveVerse}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
        </div>
        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">📅 Data</label>
          <Input type="date" value={editing.scheduled_date || ""}
            onChange={(e) => setEditing({ ...editing, scheduled_date: e.target.value })}
            min={new Date().toISOString().split("T")[0]}
            className="bg-[hsl(var(--dark-card))] border-none" />
        </div>
        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Referência (ex: João 3:16)</label>
          <Input value={editing.verse_ref || ""}
            onChange={(e) => setEditing({ ...editing, verse_ref: e.target.value })}
            className="bg-[hsl(var(--dark-card))] border-none" maxLength={100} />
        </div>
        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Texto do versículo</label>
          <Textarea value={editing.verse_text || ""}
            onChange={(e) => setEditing({ ...editing, verse_text: e.target.value })}
            className="bg-[hsl(var(--dark-card))] border-none min-h-[100px]" maxLength={2000} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Modo do Versículo do Dia</p>
            <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5">
              {mode === "auto" ? "Versículo escolhido automaticamente pelo sistema" : "Versículo definido manualmente pela fila abaixo"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[hsl(var(--dark-muted))]">{mode === "auto" ? "Auto" : "Manual"}</span>
            <Switch checked={mode === "manual"} onCheckedChange={toggleMode} />
          </div>
        </div>
      </div>

      {mode === "manual" && (
        <>
          <Button onClick={() => setEditing({ scheduled_date: new Date().toISOString().split("T")[0] })} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Agendar Versículo
          </Button>

          {queue.length === 0 ? (
            <div className="text-center py-10">
              <Calendar className="w-10 h-10 text-[hsl(var(--dark-muted))] mx-auto mb-3 opacity-40" />
              <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhum versículo agendado</p>
              <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">Quando a fila estiver vazia, o sistema usará o modo automático</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((item) => {
                const isToday = item.scheduled_date === new Date().toISOString().split("T")[0];
                return (
                  <div key={item.id} className={`bg-[hsl(var(--dark-card))] rounded-xl p-4 ${isToday ? "ring-1 ring-primary" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary">
                            {new Date(item.scheduled_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </span>
                          {isToday && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">Hoje</span>}
                        </div>
                        <p className="text-sm font-semibold mt-1">{item.verse_ref}</p>
                        <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5 line-clamp-2">{item.verse_text}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[hsl(var(--dark-card))]">
                      <button onClick={() => setEditing(item)} className="text-xs text-primary font-medium flex items-center gap-1">
                        <Edit2 className="w-3 h-3" /> Editar
                      </button>
                      <button onClick={() => deleteVerse(item.id)} className="text-xs text-destructive font-medium flex items-center gap-1 ml-auto">
                        <Trash2 className="w-3 h-3" /> Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {mode === "auto" && (
        <div className="bg-primary/10 rounded-xl p-4">
          <p className="text-xs text-primary font-semibold mb-1">💡 Modo Automático</p>
          <p className="text-xs text-[hsl(var(--dark-muted))]">
            O sistema escolhe um versículo diferente a cada dia automaticamente.
            Ative o modo manual para definir versículos específicos para datas específicas.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminDailyVerse;
