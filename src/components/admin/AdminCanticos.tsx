import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, Sparkles, Search, ArrowUp, ArrowDown,
  X, Save, Music2, Link2, ChevronDown, ChevronUp,
} from "lucide-react";

type LetraBloco = { tipo: "verso" | "refrao" | "ponte"; numero?: number; linhas: string[] };
type Playback = { label: string; url: string; sync_data?: any };
type Ministro = { id: string; nome: string; ativo: boolean };
type Cantico = {
  id: string;
  numero: number;
  titulo: string;
  letra_raw: string;
  letra_json: LetraBloco[];
  categoria: string | null;
  tom: string | null;
  capotraste: number | null;
  playbacks: Playback[];
  momentos_sugeridos: string[];
  referencia_biblica: string | null;
  publicado: boolean;
};

const CATEGORIAS = [
  "Louvor", "Adoração", "Ceia", "Batismo", "Natal", "Apelo",
  "Consagração", "Testemunho", "Guerra Espiritual", "Ação de Graças", "Oração", "Outros",
];

const MOMENTOS = ["Abertura", "Louvor", "Adoração", "Ofertório", "Ceia", "Apelo", "Encerramento"];

function emptyCantico(): Partial<Cantico> {
  return {
    titulo: "", letra_raw: "", letra_json: [], categoria: null,
    tom: null, capotraste: null, playbacks: [], momentos_sugeridos: [],
    referencia_biblica: null, publicado: true,
  };
}

export default function AdminCanticos() {
  const [list, setList] = useState<Cantico[]>([]);
  const [ministros, setMinistros] = useState<Ministro[]>([]);
  const [links, setLinks] = useState<Record<string, string[]>>({}); // cantico_id -> ministro_ids
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [editing, setEditing] = useState<Partial<Cantico> | null>(null);
  const [editingMinistros, setEditingMinistros] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, m, l] = await Promise.all([
      supabase.from("canticos").select("*").order("numero", { ascending: true }),
      supabase.from("canticos_ministros").select("id, nome, ativo").order("sort_order").order("nome"),
      supabase.from("canticos_ministros_link").select("cantico_id, ministro_id"),
    ]);
    if (c.error) toast.error(c.error.message);
    if (m.error) toast.error(m.error.message);
    if (l.error) toast.error(l.error.message);
    setList(((c.data as unknown) as Cantico[]) || []);
    setMinistros(((m.data as unknown) as Ministro[]) || []);
    const map: Record<string, string[]> = {};
    ((l.data as any[]) || []).forEach((r) => {
      map[r.cantico_id] = [...(map[r.cantico_id] || []), r.ministro_id];
    });
    setLinks(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    return list.filter((c) => {
      if (filterCat && c.categoria !== filterCat) return false;
      if (!qn) return true;
      if (String(c.numero).includes(qn)) return true;
      if (c.titulo.toLowerCase().includes(qn)) return true;
      if (c.letra_raw.toLowerCase().includes(qn)) return true;
      return false;
    });
  }, [list, q, filterCat]);

  const openNew = () => {
    setEditing(emptyCantico());
    setEditingMinistros([]);
  };

  const openEdit = (c: Cantico) => {
    setEditing({ ...c });
    setEditingMinistros(links[c.id] || []);
  };

  const processarIA = async () => {
    if (!editing?.letra_raw || editing.letra_raw.trim().length < 10) {
      return toast.error("Cole a letra antes de processar");
    }
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("classify-cantico", {
        body: { titulo: editing.titulo, letra: editing.letra_raw },
      });
      if (error) throw error;
      if (!data?.letra_json) throw new Error("Resposta inválida");
      setEditing({
        ...editing,
        letra_json: data.letra_json,
        categoria: editing.categoria || data.categoria,
      });
      toast.success(`IA processou: ${data.letra_json.length} blocos, categoria "${data.categoria}"`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao processar");
    } finally {
      setProcessing(false);
    }
  };

  const salvar = async () => {
    if (!editing) return;
    if (!editing.titulo?.trim() || !editing.letra_raw?.trim()) {
      return toast.error("Título e letra são obrigatórios");
    }
    if (!editing.letra_json || editing.letra_json.length === 0) {
      return toast.error("Processe a letra com a IA antes de salvar");
    }
    setSaving(true);
    try {
      let canticoId = editing.id;
      const payload = {
        titulo: editing.titulo.trim(),
        letra_raw: editing.letra_raw,
        letra_json: editing.letra_json,
        categoria: editing.categoria || "Outros",
        tom: editing.tom || null,
        capotraste: editing.capotraste ?? null,
        playbacks: editing.playbacks || [],
        momentos_sugeridos: editing.momentos_sugeridos || [],
        referencia_biblica: editing.referencia_biblica || null,
        publicado: editing.publicado ?? true,
      };

      if (canticoId) {
        const { error } = await supabase.from("canticos").update(payload).eq("id", canticoId);
        if (error) throw error;
      } else {
        const { data: nextNum } = await supabase.rpc("next_cantico_numero");
        const { data, error } = await supabase
          .from("canticos")
          .insert({ ...payload, numero: nextNum || 1 })
          .select("id")
          .single();
        if (error) throw error;
        canticoId = (data as any).id;
      }

      // vínculos ministros — apaga e recria
      if (canticoId) {
        await supabase.from("canticos_ministros_link").delete().eq("cantico_id", canticoId);
        if (editingMinistros.length > 0) {
          const rows = editingMinistros.map((mid) => ({ cantico_id: canticoId, ministro_id: mid }));
          const { error: linkErr } = await supabase.from("canticos_ministros_link").insert(rows);
          if (linkErr) throw linkErr;
        }
      }

      toast.success("Cântico salvo");
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remover = async (c: Cantico) => {
    if (!confirm(`Remover o cântico #${c.numero} "${c.titulo}"?`)) return;
    const { error } = await supabase.from("canticos").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    load();
  };

  const reordenar = async (idx: number, dir: -1 | 1) => {
    const cur = filtered[idx];
    const other = filtered[idx + dir];
    if (!cur || !other) return;
    await supabase.from("canticos").update({ numero: -1 }).eq("id", cur.id); // evita conflito UNIQUE
    await supabase.from("canticos").update({ numero: cur.numero }).eq("id", other.id);
    await supabase.from("canticos").update({ numero: other.numero }).eq("id", cur.id);
    load();
  };

  const addPlayback = () => {
    setEditing({
      ...editing,
      playbacks: [...(editing?.playbacks || []), { label: "Playback", url: "" }],
    });
  };

  const updatePlayback = (i: number, patch: Partial<Playback>) => {
    const arr = [...(editing?.playbacks || [])];
    arr[i] = { ...arr[i], ...patch };
    setEditing({ ...editing, playbacks: arr });
  };

  const removePlayback = (i: number) => {
    const arr = [...(editing?.playbacks || [])];
    arr.splice(i, 1);
    setEditing({ ...editing, playbacks: arr });
  };

  const toggleMomento = (m: string) => {
    const cur = editing?.momentos_sugeridos || [];
    setEditing({
      ...editing,
      momentos_sugeridos: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m],
    });
  };

  const toggleMinistro = (id: string) => {
    setEditingMinistros((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dark-muted))]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por número, título ou letra…"
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="h-10 px-3 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm"
        >
          <option value="">Todas categorias</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={openNew}
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-[hsl(var(--dark-muted))]">
          <Music2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Nenhum cântico {list.length ? "encontrado" : "cadastrado"}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c, idx) => (
            <li key={c.id} className="p-3 rounded-xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {c.numero}
                </div>
                <button onClick={() => openEdit(c)} className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium truncate">{c.titulo}</div>
                  <div className="text-xs text-[hsl(var(--dark-muted))] flex items-center gap-2 flex-wrap mt-0.5">
                    {c.categoria && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c.categoria}</span>}
                    {c.tom && <span>Tom {c.tom}</span>}
                    {(c.playbacks?.length ?? 0) > 0 && <span>{c.playbacks.length} playback(s)</span>}
                    {!c.publicado && <span className="text-amber-400">Rascunho</span>}
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => reordenar(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-md hover:bg-[hsl(var(--dark-card-hover))] disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => reordenar(idx, 1)} disabled={idx === filtered.length - 1} className="p-1.5 rounded-md hover:bg-[hsl(var(--dark-card-hover))] disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => remover(c)} className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditorModal
          editing={editing}
          setEditing={setEditing}
          editingMinistros={editingMinistros}
          toggleMinistro={toggleMinistro}
          ministros={ministros}
          processarIA={processarIA}
          processing={processing}
          salvar={salvar}
          saving={saving}
          onClose={() => setEditing(null)}
          addPlayback={addPlayback}
          updatePlayback={updatePlayback}
          removePlayback={removePlayback}
          toggleMomento={toggleMomento}
        />
      )}
    </div>
  );
}

function EditorModal(props: {
  editing: Partial<Cantico>;
  setEditing: (c: Partial<Cantico> | null) => void;
  editingMinistros: string[];
  toggleMinistro: (id: string) => void;
  ministros: Ministro[];
  processarIA: () => void;
  processing: boolean;
  salvar: () => void;
  saving: boolean;
  onClose: () => void;
  addPlayback: () => void;
  updatePlayback: (i: number, p: Partial<Playback>) => void;
  removePlayback: (i: number) => void;
  toggleMomento: (m: string) => void;
}) {
  const {
    editing, setEditing, editingMinistros, toggleMinistro, ministros,
    processarIA, processing, salvar, saving, onClose,
    addPlayback, updatePlayback, removePlayback, toggleMomento,
  } = props;
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-3xl max-h-[90vh] bg-[hsl(var(--dark-card))] rounded-t-2xl sm:rounded-2xl border border-[hsl(var(--dark-card-hover))] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--dark-card-hover))] shrink-0">
          <h3 className="text-lg font-semibold">
            {editing.id ? `Editar cântico #${(editing as any).numero}` : "Novo cântico"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[hsl(var(--dark-card))]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-[hsl(var(--dark-muted))]">Título</label>
            <input
              value={editing.titulo || ""}
              onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
              className="w-full mt-1 h-10 px-3 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[hsl(var(--dark-muted))]">Letra (cole o texto completo)</label>
              <button
                onClick={processarIA}
                disabled={processing || !editing.letra_raw}
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Processar com IA (Groq)
              </button>
            </div>
            <textarea
              value={editing.letra_raw || ""}
              onChange={(e) => setEditing({ ...editing, letra_raw: e.target.value })}
              rows={8}
              className="w-full p-3 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm font-mono"
              placeholder={"Cole a letra aqui...\n\nVerso 1\nlinha 1\nlinha 2\n\nCoro\nlinha 1\nlinha 2"}
            />
          </div>

          {editing.letra_json && editing.letra_json.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5">
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <span className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Preview estruturado ({editing.letra_json.length} blocos)
                </span>
                {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showPreview && (
                <div className="px-3 pb-3 space-y-3">
                  {editing.letra_json.map((b, i) => (
                    <div key={i} className="text-sm">
                      <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
                        {b.tipo === "refrao" ? "Refrão" : b.tipo === "ponte" ? "Ponte" : `Verso ${b.numero ?? i + 1}`}
                      </div>
                      {b.linhas.map((l, j) => <div key={j}>{l}</div>)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--dark-muted))]">Categoria</label>
              <select
                value={editing.categoria || ""}
                onChange={(e) => setEditing({ ...editing, categoria: e.target.value || null })}
                className="w-full mt-1 h-10 px-2 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm"
              >
                <option value="">—</option>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--dark-muted))]">Tom</label>
              <input
                value={editing.tom || ""}
                onChange={(e) => setEditing({ ...editing, tom: e.target.value || null })}
                placeholder="ex: G, Am"
                className="w-full mt-1 h-10 px-2 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--dark-muted))]">Capotraste</label>
              <input
                type="number"
                min={0} max={12}
                value={editing.capotraste ?? ""}
                onChange={(e) => setEditing({ ...editing, capotraste: e.target.value ? Number(e.target.value) : null })}
                className="w-full mt-1 h-10 px-2 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--dark-muted))]">Ref. bíblica</label>
              <input
                value={editing.referencia_biblica || ""}
                onChange={(e) => setEditing({ ...editing, referencia_biblica: e.target.value || null })}
                placeholder="Sl 23"
                className="w-full mt-1 h-10 px-2 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[hsl(var(--dark-muted))]">Momentos sugeridos</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {MOMENTOS.map((m) => {
                const on = (editing.momentos_sugeridos || []).includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMomento(m)}
                    className={`px-2.5 h-7 rounded-full text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))]"}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[hsl(var(--dark-muted))]">Ministros</label>
            {ministros.length === 0 ? (
              <div className="mt-1 text-xs text-[hsl(var(--dark-muted))]">Cadastre ministros na aba anterior primeiro.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ministros.filter((m) => m.ativo || editingMinistros.includes(m.id)).map((m) => {
                  const on = editingMinistros.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMinistro(m.id)}
                      className={`px-2.5 h-7 rounded-full text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))]"}`}
                    >
                      {m.nome}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[hsl(var(--dark-muted))]">Playbacks</label>
              <button
                onClick={addPlayback}
                className="h-7 px-2 rounded-md bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-xs flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
            {(editing.playbacks || []).length === 0 ? (
              <div className="text-xs text-[hsl(var(--dark-muted))]">Nenhum playback</div>
            ) : (
              <div className="space-y-2">
                {editing.playbacks!.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={p.label}
                      onChange={(e) => updatePlayback(i, { label: e.target.value })}
                      placeholder="Rótulo"
                      className="w-28 h-9 px-2 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-xs"
                    />
                    <div className="flex-1 relative">
                      <Link2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--dark-muted))]" />
                      <input
                        value={p.url}
                        onChange={(e) => updatePlayback(i, { url: e.target.value })}
                        placeholder="URL do YouTube ou MP3"
                        className="w-full h-9 pl-8 pr-2 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-xs"
                      />
                    </div>
                    <button onClick={() => removePlayback(i)} className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.publicado ?? true}
              onChange={(e) => setEditing({ ...editing, publicado: e.target.checked })}
            />
            Publicado (visível para todos os usuários)
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[hsl(var(--dark-card-hover))] shrink-0">
          <button onClick={onClose} className="h-10 px-4 rounded-lg text-sm bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}