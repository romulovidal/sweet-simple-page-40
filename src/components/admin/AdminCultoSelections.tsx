import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Calendar as CalendarIcon,
  Music2,
  X,
  ExternalLink,
  GripVertical,
  Pencil,
  Eye,
  EyeOff,
  Timer,
} from "lucide-react";
import { loadHarpa, type HarpaHino } from "@/data/harpa";
import CultoCueMarker from "@/components/admin/CultoCueMarker";

type CultoItem = {
  hino_number: number;
  youtube_url?: string | null;
  note?: string | null;
  /** Marcações (segundos) por slide — sincroniza a letra com o playback. */
  cues?: (number | null)[] | null;
};

type CultoSelection = {
  id: string;
  title: string;
  culto_date: string; // yyyy-mm-dd
  schedule_id: string | null;
  items: CultoItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Schedule = {
  id: string;
  name: string;
  day_of_week: number;
  time: string;
  is_active: boolean;
};

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type PlaybackLib = Record<number, { youtube_url: string | null; cues: (number | null)[] | null }>;

const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
};

const fmtDate = (iso: string) => {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

export default function AdminCultoSelections() {
  const [rows, setRows] = useState<CultoSelection[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [hinos, setHinos] = useState<HarpaHino[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CultoSelection | null>(null);
  const [creating, setCreating] = useState(false);
  const [lib, setLib] = useState<PlaybackLib>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [selRes, schedRes, libRes] = await Promise.all([
      (supabase as any)
        .from("culto_selections")
        .select("*")
        .order("culto_date", { ascending: false }),
      supabase.from("culto_schedules").select("*").order("day_of_week"),
      (supabase as any).from("harpa_playbacks").select("hino_number, youtube_url, cues"),
    ]);
    if (selRes.data) setRows(selRes.data as CultoSelection[]);
    if (schedRes.data) setSchedules(schedRes.data as Schedule[]);
    if (libRes?.data) {
      const map: PlaybackLib = {};
      (libRes.data as any[]).forEach((r) => {
        map[r.hino_number] = { youtube_url: r.youtube_url, cues: r.cues };
      });
      setLib(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    loadHarpa().then(setHinos).catch(() => {});
  }, [fetchAll]);

  const hinoMap = useMemo(() => {
    const m = new Map<number, HarpaHino>();
    hinos.forEach((h) => m.set(h.number, h));
    return m;
  }, [hinos]);

  const startCreate = () => {
    setEditing({
      id: "",
      title: "Culto",
      culto_date: todayISO(),
      schedule_id: null,
      items: [],
      is_active: true,
      created_at: "",
      updated_at: "",
    });
    setCreating(true);
  };

  const removeRow = async (id: string) => {
    if (!confirm("Excluir esta seleção?")) return;
    const { error } = await (supabase as any).from("culto_selections").delete().eq("id", id);
    if (error) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Seleção excluída");
    fetchAll();
  };

  const toggleActive = async (row: CultoSelection) => {
    const { error } = await (supabase as any)
      .from("culto_selections")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) {
      toast.error("Falha ao atualizar");
      return;
    }
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[hsl(var(--dark-muted))]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Seleção de Hinos por Culto</h2>
          <p className="text-xs text-[hsl(var(--dark-muted))]">
            Monte a sequência de hinos com playback do YouTube para cada culto.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition"
        >
          <Plus className="w-4 h-4" /> Nova seleção
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 text-[hsl(var(--dark-muted))] bg-[hsl(var(--dark-card))] rounded-2xl">
          <Music2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma seleção cadastrada ainda.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const sched = schedules.find((s) => s.id === row.schedule_id);
            return (
              <li
                key={row.id}
                className="p-4 rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold truncate">{row.title}</p>
                      {sched && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                          {DOW[sched.day_of_week]} · {sched.time.slice(0, 5)}
                        </span>
                      )}
                      {!row.is_active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))] font-semibold">
                          oculta
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-0.5">
                      {fmtDate(row.culto_date)} · {row.items.length} hino
                      {row.items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleActive(row)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--dark-card-hover))] transition"
                    title={row.is_active ? "Ocultar dos usuários" : "Mostrar aos usuários"}
                  >
                    {row.is_active ? (
                      <Eye className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-[hsl(var(--destructive))]" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(row);
                      setCreating(false);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--dark-card-hover))] transition"
                  >
                    <Pencil className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                  </button>
                  <button
                    onClick={() => removeRow(row.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))] transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {row.items.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {row.items.map((it, i) => {
                      const h = hinoMap.get(it.hino_number);
                      return (
                        <li
                          key={i}
                          className="text-[11px] px-2 py-1 rounded-full bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] flex items-center gap-1"
                        >
                          <span className="text-primary font-bold">{it.hino_number}</span>
                          <span className="text-[hsl(var(--dark-muted))] truncate max-w-[140px]">
                            {h?.title || "hino"}
                          </span>
                          {it.youtube_url && (
                            <ExternalLink className="w-3 h-3 text-[hsl(var(--dark-muted))]" />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <SelectionEditor
          value={editing}
          isNew={creating}
          schedules={schedules}
          hinos={hinos}
          lib={lib}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            fetchAll();
          }}
        />
      )}
    </div>
  );
}

function SelectionEditor({
  value,
  isNew,
  schedules,
  hinos,
  lib,
  onClose,
  onSaved,
}: {
  value: CultoSelection;
  isNew: boolean;
  schedules: Schedule[];
  hinos: HarpaHino[];
  lib: PlaybackLib;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(value.title);
  const [date, setDate] = useState(value.culto_date);
  const [scheduleId, setScheduleId] = useState<string | null>(value.schedule_id);
  const [items, setItems] = useState<CultoItem[]>(value.items || []);
  const [isActive, setIsActive] = useState(value.is_active);
  const [saving, setSaving] = useState(false);
  const [addNumber, setAddNumber] = useState("");
  const [marking, setMarking] = useState<number | null>(null);

  const hinoMap = useMemo(() => {
    const m = new Map<number, HarpaHino>();
    hinos.forEach((h) => m.set(h.number, h));
    return m;
  }, [hinos]);

  const addHino = () => {
    const n = Number(addNumber);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Informe um número válido");
      return;
    }
    if (!hinoMap.get(n)) {
      toast.error(`Hino ${n} não existe`);
      return;
    }
    if (items.some((it) => it.hino_number === n)) {
      toast.error("Hino já adicionado");
      return;
    }
    const saved = lib[n];
    setItems((prev) => [
      ...prev,
      {
        hino_number: n,
        youtube_url: saved?.youtube_url || null,
        cues: saved?.cues && saved.cues.length ? saved.cues : null,
      },
    ]);
    if (saved?.youtube_url) {
      toast.success(
        saved.cues && saved.cues.length
          ? `Playback e marcações do hino ${n} reaproveitados`
          : `Playback salvo do hino ${n} reaproveitado`
      );
    }
    setAddNumber("");
  };

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= items.length) return;
    setItems((prev) => {
      const arr = [...prev];
      const [x] = arr.splice(from, 1);
      arr.splice(to, 0, x);
      return arr;
    });
  };

  const updateItem = (i: number, patch: Partial<CultoItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!title.trim()) {
      toast.error("Informe um título");
      return;
    }
    if (!date) {
      toast.error("Informe uma data");
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      culto_date: date,
      schedule_id: scheduleId,
      items,
      is_active: isActive,
    };
    const { error } = isNew
      ? await (supabase as any).from("culto_selections").insert(payload)
      : await (supabase as any).from("culto_selections").update(payload).eq("id", value.id);
    if (error) {
      setSaving(false);
      toast.error(error.message || "Falha ao salvar");
      return;
    }

    // Guarda playbacks + marcações na biblioteca para reutilizar em cultos futuros
    const libRows = items
      .filter((it) => it.youtube_url)
      .map((it) => ({
        hino_number: it.hino_number,
        youtube_url: it.youtube_url,
        cues: (it.cues || []).filter((c) => c !== undefined),
      }));
    if (libRows.length) {
      await (supabase as any)
        .from("harpa_playbacks")
        .upsert(libRows, { onConflict: "hino_number" });
    }
    setSaving(false);
    toast.success("Seleção salva");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[92vh] bg-[hsl(var(--dark-bg))] rounded-t-2xl sm:rounded-2xl border border-[hsl(var(--dark-card-hover))] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--dark-card-hover))]">
          <h3 className="text-base font-bold">{isNew ? "Nova seleção" : "Editar seleção"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[hsl(var(--dark-card))]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--dark-muted))]">Título</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Culto de Domingo"
                className="mt-1 w-full h-10 px-3 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm focus:outline-none focus:border-primary/60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--dark-muted))]">Data</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm focus:outline-none focus:border-primary/60"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--dark-muted))]">Vincular ao culto (opcional)</span>
            <select
              value={scheduleId || ""}
              onChange={(e) => setScheduleId(e.target.value || null)}
              className="mt-1 w-full h-10 px-3 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm focus:outline-none focus:border-primary/60"
            >
              <option value="">— Livre (sem vínculo) —</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({DOW[s.day_of_week]} {s.time.slice(0, 5)})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span>Visível para os usuários no app</span>
          </label>

          <div className="pt-2 border-t border-[hsl(var(--dark-card-hover))]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold">Hinos ({items.length})</p>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={addNumber}
                onChange={(e) => setAddNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHino()}
                placeholder="Nº do hino"
                className="flex-1 h-10 px-3 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm focus:outline-none focus:border-primary/60"
              />
              <button
                onClick={addHino}
                className="px-4 h-10 rounded-lg bg-primary/15 text-primary text-sm font-semibold hover:bg-primary/25 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-[hsl(var(--dark-muted))] text-center py-6">
                Nenhum hino ainda. Adicione pelo número.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((it, i) => {
                  const h = hinoMap.get(it.hino_number);
                  return (
                    <li
                      key={i}
                      className="p-3 rounded-xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <button
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            className="w-6 h-5 rounded flex items-center justify-center text-xs text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-bg))] disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => move(i, 1)}
                            disabled={i === items.length - 1}
                            className="w-6 h-5 rounded flex items-center justify-center text-xs text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-bg))] disabled:opacity-30"
                          >
                            ▼
                          </button>
                        </div>
                        <span className="w-9 h-9 rounded-lg bg-primary/15 text-primary font-bold flex items-center justify-center text-xs">
                          {it.hino_number}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {h?.title || <span className="text-[hsl(var(--destructive))]">Hino não encontrado</span>}
                          </p>
                          <p className="text-[10px] text-[hsl(var(--dark-muted))]">Posição {i + 1}</p>
                        </div>
                        <button
                          onClick={() => removeItem(i)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="url"
                        value={it.youtube_url || ""}
                        onChange={(e) => updateItem(i, { youtube_url: e.target.value.trim() || null })}
                        placeholder="URL do YouTube (playback) — opcional"
                        className="mt-2 w-full h-9 px-3 rounded-lg bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-xs focus:outline-none focus:border-primary/60"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => setMarking(i)}
                          disabled={!it.youtube_url || !h}
                          className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary/15 text-primary text-[11px] font-semibold hover:bg-primary/25 disabled:opacity-40"
                          title="Marcar o tempo de cada estrofe no playback"
                        >
                          <Timer className="w-3.5 h-3.5" /> Marcar estrofes
                        </button>
                        <span className="text-[10px] text-[hsl(var(--dark-muted))]">
                          {it.cues && it.cues.some((c) => typeof c === "number")
                            ? `${it.cues.filter((c) => typeof c === "number").length} marcações`
                            : "sem marcações"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[hsl(var(--dark-card-hover))] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 h-10 rounded-lg text-sm font-semibold text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card))]"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>

      {marking !== null && hinoMap.get(items[marking]?.hino_number) && (
        <CultoCueMarker
          hino={hinoMap.get(items[marking].hino_number)!}
          youtubeUrl={items[marking].youtube_url}
          cues={items[marking].cues}
          onClose={() => setMarking(null)}
          onSave={(cues) => updateItem(marking, { cues: cues.length ? cues : null })}
        />
      )}
    </div>
  );
}
