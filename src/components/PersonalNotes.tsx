import { useState, useEffect, useCallback } from "react";
import { StickyNote, Plus, X, Save, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PersonalNotesProps {
  bookAbbrev: string;
  chapter: number;
  verse?: number;
  enabled: boolean;
  label?: string;
  variant?: "compact" | "action-bar" | "inline";
}

interface Note {
  id: string;
  content: string;
  verse: number | null;
  created_at: string;
  updated_at: string;
}

const PersonalNotes = ({ bookAbbrev, chapter, verse, enabled, label, variant = "compact" }: PersonalNotesProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const query = supabase
      .from("user_notes")
      .select("*")
      .eq("user_id", user.id)
      .eq("book_abbrev", bookAbbrev)
      .eq("chapter", chapter)
      .order("created_at", { ascending: false });

    if (verse !== undefined) {
      query.eq("verse", verse);
    }

    const { data } = await query;
    setNotes((data as Note[]) || []);
    setLoading(false);
  }, [user, bookAbbrev, chapter, verse]);

  useEffect(() => {
    if (open) fetchNotes();
  }, [open, fetchNotes]);

  const handleSave = async () => {
    if (!user || !newNote.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("user_notes").insert({
      user_id: user.id,
      book_abbrev: bookAbbrev,
      chapter,
      verse: verse ?? null,
      content: newNote.trim(),
    });
    if (error) {
      toast.error("Erro ao salvar nota");
    } else {
      toast.success("Nota salva!");
      setNewNote("");
      fetchNotes();
    }
    setSaving(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("user_notes").update({ content: editContent.trim() }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar nota");
    } else {
      toast.success("Nota atualizada!");
      setEditingId(null);
      fetchNotes();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir esta nota?")) return;
    const { error } = await supabase.from("user_notes").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir nota");
    } else {
      toast.success("Nota excluída");
      fetchNotes();
    }
  };

  if (!enabled) return null;

  const requireAuth = () => {
    if (!user) {
      toast.info("Entre ou crie uma conta para usar as Anotações");
      navigate("/perfil");
      return false;
    }
    return true;
  };

  const handleOpen = () => {
    if (!requireAuth()) return;
    setOpen(true);
  };

  const noteCount = notes.length;

  return (
    <>
      {variant === "action-bar" ? (
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={handleOpen}
            className="relative h-11 w-11 rounded-xl bg-yellow-500/15 hover:bg-yellow-500/25 active:scale-95 transition-all flex items-center justify-center"
            title="Anotações"
            aria-label="Anotações"
          >
            <StickyNote className="w-[18px] h-[18px] text-yellow-400" />
            {noteCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-yellow-400 text-[9px] text-black font-bold flex items-center justify-center">
                {noteCount}
              </span>
            )}
          </button>
          {label && <span className="hidden lg:inline text-[10px] font-medium text-yellow-300/80">{label}</span>}
        </div>
      ) : (
        <button
          onClick={handleOpen}
          className="p-1 relative"
          title="Anotações"
        >
          <StickyNote className={`w-4 h-4 ${noteCount > 0 ? "text-yellow-400" : "text-[hsl(var(--dark-muted))]"}`} />
          {noteCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-yellow-400 text-[8px] text-black font-bold flex items-center justify-center">
              {noteCount}
            </span>
          )}
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card))] max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[hsl(var(--dark-text))]">
              📝 Anotações — {bookAbbrev.toUpperCase()} {chapter}{verse ? `:${verse}` : ""}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* New note */}
            <div className="space-y-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Escreva sua anotação..."
                className="bg-[hsl(var(--dark-card))] border-none min-h-[80px] text-sm"
                maxLength={2000}
              />
              <Button onClick={handleSave} disabled={saving || !newNote.trim()} size="sm" className="w-full">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Adicionar Nota
              </Button>
            </div>

            {/* Notes list */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-3">
                    {editingId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="bg-[hsl(var(--dark-bg))] border-none min-h-[60px] text-sm"
                          maxLength={2000}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleUpdate(note.id)} disabled={saving}>
                            <Save className="w-3 h-3 mr-1" /> Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}
                            className="bg-[hsl(var(--dark-bg))] border-none text-[hsl(var(--dark-text))]">
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[hsl(var(--dark-bg))]">
                          <p className="text-[10px] text-[hsl(var(--dark-muted))]">
                            {new Date(note.created_at).toLocaleDateString("pt-BR")}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                              className="text-[10px] text-primary"
                            >
                              Editar
                            </button>
                            <button onClick={() => handleDelete(note.id)} className="text-[10px] text-destructive">
                              Excluir
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Nenhuma anotação ainda</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default PersonalNotes;
