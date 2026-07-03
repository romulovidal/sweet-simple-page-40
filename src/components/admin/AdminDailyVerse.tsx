import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit2, Save, X, Loader2, Calendar, Languages, Clock, Sparkles, BookOpen, Eraser, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BIBLE_VERSIONS,
  DAILY_VERSE_VERSION_KEY,
  DEFAULT_DAILY_VERSION,
  getChapterVerses,
  getVersesTextByNumbers,
  formatVerseRange,
} from "@/lib/dailyVerseVersion";
import { bibleBooks } from "@/data/bible";


interface VerseQueueItem {
  id: string;
  verse_text: string;
  verse_ref: string;
  scheduled_date: string;
}

const AdminDailyVerse = () => {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [version, setVersion] = useState<string>(DEFAULT_DAILY_VERSION);
  const [pushTime, setPushTime] = useState<string>("08:00");
  const [motivationalEnabled, setMotivationalEnabled] = useState(true);
  const [motivationalTime, setMotivationalTime] = useState("10:00");
  const [queue, setQueue] = useState<VerseQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<VerseQueueItem> | null>(null);
  const [resending, setResending] = useState(false);

  const resendDailyVerse = async () => {
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-verse-push", {
        method: "POST",
        body: {},
      });
      if (error) throw error;
      toast.success(
        `Push reenviado! ${data?.sent || 0} entregues${data?.failed ? `, ${data.failed} falhas` : ""} • ${data?.verse || ""}`
      );
    } catch (e) {
      console.error(e);
      toast.error("Erro ao reenviar versículo do dia");
    } finally {
      setResending(false);
    }
  };

  // Selector state
  const [selectedBook, setSelectedBook] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const [chapterVerses, setChapterVerses] = useState<string[]>([]);
  const [fetchingText, setFetchingText] = useState(false);

  const selectedBookData = useMemo(() => 
    bibleBooks.find(b => b.name === selectedBook), 
    [selectedBook]
  );


  const chapters = useMemo(() => 
    selectedBookData ? Array.from({ length: selectedBookData.chapters }, (_, i) => i + 1) : [],
    [selectedBookData]
  );


  const loadData = useCallback(async () => {
    setLoading(true);
    const [
      { data: modeRow }, 
      { data: versionRow }, 
      { data: timeRow }, 
      { data: motEnabledRow },
      { data: motTimeRow },
      { data: queueData }
    ] = await Promise.all([
      supabase.from("admin_settings").select("value").eq("key", "daily_verse_mode").maybeSingle(),
      supabase.from("admin_settings").select("value").eq("key", DAILY_VERSE_VERSION_KEY).maybeSingle(),
      supabase.from("admin_settings").select("value").eq("key", "daily_verse_push_time").maybeSingle(),
      supabase.from("admin_settings").select("value").eq("key", "motivational_push_enabled").maybeSingle(),
      supabase.from("admin_settings").select("value").eq("key", "motivational_push_time").maybeSingle(),
      supabase
        .from("daily_verse_queue")
        .select("*")
        .gte("scheduled_date", new Date().toISOString().split("T")[0])
        .order("scheduled_date", { ascending: true }),
    ]);

    if (modeRow) {
      const val = typeof modeRow.value === "string" ? modeRow.value : JSON.stringify(modeRow.value);
      setMode(val.replace(/"/g, "") as "auto" | "manual");
    }
    if (versionRow) {
      const val = typeof versionRow.value === "string" ? versionRow.value : JSON.stringify(versionRow.value);
      setVersion((val.replace(/"/g, "") || DEFAULT_DAILY_VERSION).toLowerCase());
    }
    if (timeRow) {
      const val = typeof timeRow.value === "string" ? timeRow.value : JSON.stringify(timeRow.value);
      setPushTime(val.replace(/"/g, "") || "08:00");
    }
    if (motEnabledRow) {
      const val = typeof motEnabledRow.value === "string" ? motEnabledRow.value : JSON.stringify(motEnabledRow.value);
      setMotivationalEnabled(val.replace(/"/g, "") === "true");
    }
    if (motTimeRow) {
      const val = typeof motTimeRow.value === "string" ? motTimeRow.value : JSON.stringify(motTimeRow.value);
      setMotivationalTime(val.replace(/"/g, "") || "10:00");
    }
    setQueue(queueData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleMode = async (checked: boolean) => {
    const newMode = checked ? "manual" : "auto";
    setMode(newMode);
    await supabase
      .from("admin_settings")
      .upsert({ key: "daily_verse_mode", value: JSON.stringify(newMode), updated_at: new Date().toISOString() }, { onConflict: "key" });
    toast.success(newMode === "manual" ? "Modo manual ativado" : "Modo automático ativado");
  };

  const changeVersion = async (newVersion: string) => {
    setVersion(newVersion);
    await supabase
      .from("admin_settings")
      .upsert({ key: DAILY_VERSE_VERSION_KEY, value: JSON.stringify(newVersion), updated_at: new Date().toISOString() }, { onConflict: "key" });
    toast.success(`Versão alterada para ${BIBLE_VERSIONS.find(v => v.id === newVersion)?.shortName}`);
  };

  const changePushTime = async (newTime: string) => {
    setPushTime(newTime);
    await supabase
      .from("admin_settings")
      .upsert({ key: "daily_verse_push_time", value: JSON.stringify(newTime), updated_at: new Date().toISOString() }, { onConflict: "key" });
    toast.success(`Horário do push alterado para ${newTime}`);
  };

  const toggleMotivational = async (checked: boolean) => {
    setMotivationalEnabled(checked);
    await supabase
      .from("admin_settings")
      .upsert({ key: "motivational_push_enabled", value: JSON.stringify(checked), updated_at: new Date().toISOString() }, { onConflict: "key" });
    toast.success(checked ? "Mensagens motivacionais ativadas" : "Mensagens motivacionais desativadas");
  };

  const changeMotivationalTime = async (newTime: string) => {
    setMotivationalTime(newTime);
    await supabase
      .from("admin_settings")
      .upsert({ key: "motivational_push_time", value: JSON.stringify(newTime), updated_at: new Date().toISOString() }, { onConflict: "key" });
    toast.success(`Horário motivacional alterado para ${newTime}`);
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

  useEffect(() => {
    const loadChapter = async () => {
      if (selectedBook && selectedChapter) {
        const verses = await getChapterVerses(selectedBook, parseInt(selectedChapter), version);
        setChapterVerses(verses);
      } else {
        setChapterVerses([]);
      }
    };
    loadChapter();
  }, [selectedBook, selectedChapter, version]);


  useEffect(() => {
    if (selectedBook && selectedChapter && selectedVerses.length > 0) {
      const range = formatVerseRange(selectedVerses);
      const ref = `${selectedBook} ${selectedChapter}:${range}`;
      const fetchText = async () => {
        setFetchingText(true);
        try {
          const text = await getVersesTextByNumbers(
            selectedBook,
            parseInt(selectedChapter),
            selectedVerses,
            version,
          );
          setEditing((prev) => ({ ...prev, verse_ref: ref, verse_text: text }));
        } catch (e) {
          console.error(e);
        } finally {
          setFetchingText(false);
        }
      };
      fetchText();
    }
  }, [selectedBook, selectedChapter, selectedVerses, version]);

  const toggleVerse = (n: number) => {
    setSelectedVerses((prev) =>
      prev.includes(n) ? prev.filter((v) => v !== n) : [...prev, n].sort((a, b) => a - b),
    );
  };

  const selectAllVerses = () => {
    setSelectedVerses(chapterVerses.map((_, i) => i + 1));
  };

  const clearVerses = () => setSelectedVerses([]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (editing) {
    return (
      <div className="space-y-4 pb-32">
        <div className="sticky top-0 z-20 -mx-5 px-5 py-3 bg-[hsl(var(--dark-bg))]/95 backdrop-blur border-b border-[hsl(var(--dark-card))] flex items-center gap-3">
          <button aria-label="Fechar" onClick={() => {
            setEditing(null);
            setSelectedBook("");
            setSelectedChapter("");
            setSelectedVerses([]);
            setChapterVerses([]);
          }}><X className="w-5 h-5" /></button>
          <h2 className="text-lg font-bold flex-1">{editing.id ? "Editar" : "Novo"} Versículo</h2>
          <Button size="sm" onClick={saveVerse} disabled={fetchingText} className="hidden sm:inline-flex">
            {fetchingText ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar
          </Button>
        </div>

        <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))]">Seletor Rápido</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-[hsl(var(--dark-muted))] mb-1 block uppercase">Livro</label>
              <Select value={selectedBook} onValueChange={(v) => {
                setSelectedBook(v);
                setSelectedChapter("");
                setSelectedVerses([]);
              }}>
                <SelectTrigger className="bg-[hsl(var(--dark-bg))] border-none h-11 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {bibleBooks.map((b) => (
                    <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[10px] text-[hsl(var(--dark-muted))] mb-1 block uppercase">Capítulo</label>
              <Select 
                value={selectedChapter} 
                onValueChange={(v) => {
                  setSelectedChapter(v);
                  setSelectedVerses([]);
                }}
                disabled={!selectedBook}
              >
                <SelectTrigger className="bg-[hsl(var(--dark-bg))] border-none h-11 text-sm">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {chapters.map((c) => (
                    <SelectItem key={c} value={c.toString()}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] text-[hsl(var(--dark-muted))] mb-1 block uppercase font-bold">
                Selecionados
              </label>
              <div className="flex items-center gap-2 h-11 px-3 rounded-md bg-[hsl(var(--dark-bg))]">
                <span className="text-sm font-bold text-primary tabular-nums truncate">
                  {selectedVerses.length > 0
                    ? `v. ${formatVerseRange(selectedVerses)}`
                    : "nenhum"}
                </span>
                <span className="text-[10px] text-[hsl(var(--dark-muted))] ml-auto whitespace-nowrap">
                  ({selectedVerses.length}/{chapterVerses.length || "?"})
                </span>
              </div>
            </div>
          </div>

          {/* Chapter verse grid — click to multi-select */}
          {selectedChapter && chapterVerses.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-[hsl(var(--dark-card-hover))]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-[hsl(var(--dark-muted))] uppercase tracking-wider">
                  Clique nos versículos ({selectedBook} {selectedChapter})
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllVerses}
                    className="text-xs px-3 py-1.5 min-h-[32px] rounded-md bg-[hsl(var(--dark-bg))] hover:bg-primary/10 text-[hsl(var(--dark-muted))] hover:text-primary transition-colors"
                  >
                    Todos
                  </button>
                  <button
                    onClick={clearVerses}
                    disabled={selectedVerses.length === 0}
                    className="text-xs px-3 py-1.5 min-h-[32px] rounded-md bg-[hsl(var(--dark-bg))] hover:bg-destructive/10 text-[hsl(var(--dark-muted))] hover:text-destructive transition-colors disabled:opacity-40 flex items-center gap-1"
                  >
                    <Eraser className="w-3.5 h-3.5" /> Limpar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2">
                {chapterVerses.map((_, i) => {
                  const n = i + 1;
                  const selected = selectedVerses.includes(n);
                  return (
                    <button
                      key={n}
                      onClick={() => toggleVerse(n)}
                      aria-label={`Versículo ${n}${selected ? " (selecionado)" : ""}`}
                      aria-pressed={selected}
                      className={`min-h-[44px] min-w-[44px] aspect-square text-sm font-bold rounded-lg transition-all touch-manipulation flex items-center justify-center ${
                        selected
                          ? "bg-primary text-primary-foreground scale-105 shadow-md shadow-primary/30"
                          : "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] hover:bg-primary/20 hover:text-primary"
                      }`}
                      title={chapterVerses[i]?.slice(0, 80)}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] text-[hsl(var(--dark-muted))] italic">
                Dica: clique em vários números para agrupar (ex: 1, 2, 3 vira "1-3"; 1, 3, 5 vira "1,3,5").
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">📅 Data de Exibição</label>
            <Input type="date" value={editing.scheduled_date || ""}
              onChange={(e) => setEditing({ ...editing, scheduled_date: e.target.value })}
              min={new Date().toISOString().split("T")[0]}
              className="bg-[hsl(var(--dark-card))] border-none" />
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Referência Manual</label>
            <Input value={editing.verse_ref || ""}
              onChange={(e) => setEditing({ ...editing, verse_ref: e.target.value })}
              placeholder="Ex: João 3:16"
              className="bg-[hsl(var(--dark-card))] border-none" maxLength={100} />
          </div>
        </div>

        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Texto do versículo (carregado automaticamente)</label>
          <div className="relative">
            <Textarea value={editing.verse_text || ""}
              onChange={(e) => setEditing({ ...editing, verse_text: e.target.value })}
              placeholder="O texto aparecerá aqui ao selecionar acima..."
              className="bg-[hsl(var(--dark-card))] border-none min-h-[120px] pr-10" maxLength={2000} />
            {fetchingText && (
              <div className="absolute top-3 right-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>

        {/* Floating bottom action bar — always reachable on mobile/tablet */}
        <div className="sm:hidden fixed left-0 right-0 bottom-16 z-30 px-4 py-3 bg-[hsl(var(--dark-bg))]/95 backdrop-blur border-t border-[hsl(var(--dark-card))]">
          <Button onClick={saveVerse} disabled={fetchingText} className="w-full h-12 text-base">
            {fetchingText ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar Versículo
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* Reenviar push do versículo do dia */}
      <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-[hsl(var(--dark-text))]">Reenviar Versículo do Dia</span>
        </div>
        <p className="text-xs text-[hsl(var(--dark-muted))] mb-3 leading-relaxed">
          Dispara agora o push com o mesmo versículo exibido hoje no app.
        </p>
        <Button onClick={resendDailyVerse} disabled={resending} className="w-full" size="sm">
          {resending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          {resending ? "Enviando..." : "Reenviar push agora"}
        </Button>
      </div>

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

      {/* Settings section */}
      <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-6">
        {/* Bible Version */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm">Versão da Bíblia</p>
          </div>
          <p className="text-xs text-[hsl(var(--dark-muted))]">
            Versão usada no versículo do dia (app + push).
          </p>
          <Select value={version} onValueChange={changeVersion}>
            <SelectTrigger className="bg-[hsl(var(--dark-bg))] border-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BIBLE_VERSIONS.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.shortName} — {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border-t border-[hsl(var(--dark-card-hover))]" />

        {/* Push Notification Time */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm">Horário da Notificação</p>
          </div>
          <p className="text-xs text-[hsl(var(--dark-muted))]">
            Horário em que o push automático do versículo será enviado diariamente.
          </p>
          <div className="flex items-center gap-3">
            <Input
              type="time"
              value={pushTime}
              onChange={(e) => changePushTime(e.target.value)}
              className="bg-[hsl(var(--dark-bg))] border-none w-32"
            />
            <span className="text-xs text-[hsl(var(--dark-muted))] italic">
              (Horário de Brasília)
            </span>
          </div>
        </div>
      </div>

      {/* Motivational Push Settings Section */}
      <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-4 border border-primary/20 shadow-lg shadow-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <div>
               <p className="font-bold text-sm text-[hsl(var(--dark-text))]">Não deixe de ler Hoje!</p>
               <p className="text-xs text-[hsl(var(--dark-muted))]">Envio de lembretes edificantes para manter a constância na Palavra.</p>
            </div>
          </div>
          <Switch checked={motivationalEnabled} onCheckedChange={toggleMotivational} />
        </div>

        {motivationalEnabled && (
          <div className="flex items-center gap-4 pl-7 pt-3 border-t border-[hsl(var(--dark-card-hover))]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Horário de envio:</span>
            </div>
            <Input
              type="time"
              value={motivationalTime}
              onChange={(e) => changeMotivationalTime(e.target.value)}
              className="bg-[hsl(var(--dark-bg))] border-primary/30 w-32 h-9 text-sm font-bold text-primary focus:ring-1 focus:ring-primary"
            />
            <span className="text-[10px] text-[hsl(var(--dark-muted))] italic bg-white/5 px-2 py-1 rounded">
              Brasília
            </span>
          </div>
        )}
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
