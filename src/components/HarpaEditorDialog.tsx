import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, ChevronUp, ChevronDown, Save, RotateCcw, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { applyLocalOverride, toRawSecoes, type HarpaHino, type RawSecao } from "@/data/harpa";

type Props = {
  hino: HarpaHino;
  onClose: () => void;
  /** Recebe o hino já normalizado após salvar/restaurar. */
  onSaved: (hino: HarpaHino) => void;
};

type Section = { tipo: "estrofe" | "refrao"; text: string };

const toSections = (h: HarpaHino): Section[] =>
  toRawSecoes(h).map((s) => ({ tipo: s.tipo, text: s.linhas.join("\n") }));

// Numeração das estrofes é sempre recalculada: refrões nunca recebem número.
function buildSecoes(sections: Section[]): RawSecao[] {
  let n = 0;
  return sections
    .map((s) => {
      const linhas = s.text
        .split("\n")
        .map((l) => l.replace(/\s+$/g, "").replace(/^\s*[-–—]+\s*/, "").trim())
        .filter((l) => l.length > 0);
      if (s.tipo === "refrao") return { tipo: "refrao" as const, linhas };
      n += 1;
      return { tipo: "estrofe" as const, numero: n, linhas };
    })
    .filter((s) => s.linhas.length > 0);
}

export default function HarpaEditorDialog({ hino, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(hino.title);
  const [sections, setSections] = useState<Section[]>(() => toSections(hino));
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setTitle(hino.title);
    setSections(toSections(hino));
  }, [hino]);

  const secoes = useMemo(() => buildSecoes(sections), [sections]);
  const estrofes = secoes.filter((s) => s.tipo === "estrofe").length;
  const refroes = secoes.filter((s) => s.tipo === "refrao").length;

  const update = (i: number, patch: Partial<Section>) =>
    setSections((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const move = (i: number, dir: -1 | 1) =>
    setSections((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const copy = [...arr];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const remove = (i: number) => setSections((arr) => arr.filter((_, idx) => idx !== i));

  const add = (tipo: "estrofe" | "refrao") =>
    setSections((arr) => [...arr, { tipo, text: "" }]);

  const handleSave = async () => {
    const t = title.trim();
    if (!t) return toast.error("Informe o título do hino");
    if (secoes.length === 0) return toast.error("Adicione ao menos uma estrofe");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("harpa_overrides").upsert(
      {
        number: hino.number,
        title: t,
        secoes,
        updated_by: userData?.user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "number" }
    );
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar: " + error.message);
      return;
    }
    const updated = applyLocalOverride({ number: hino.number, title: t, secoes });
    onSaved(updated);
    toast.success(`Hino ${hino.number} atualizado`);
    onClose();
  };

  const handleRestore = async () => {
    if (!confirm("Restaurar o texto original deste hino e descartar as edições?")) return;
    setRestoring(true);
    const { error } = await (supabase as any)
      .from("harpa_overrides")
      .delete()
      .eq("number", hino.number);
    setRestoring(false);
    if (error) {
      toast.error("Não foi possível restaurar: " + error.message);
      return;
    }
    try {
      const raw = localStorage.getItem("harpa:overrides:v1");
      if (raw) {
        const rows = (JSON.parse(raw) as { number: number }[]).filter((r) => r.number !== hino.number);
        localStorage.setItem("harpa:overrides:v1", JSON.stringify(rows));
      }
    } catch {}
    toast.success("Original restaurado. Recarregando…");
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[hsl(var(--dark-bg))] overflow-y-auto">
      <header className="sticky top-0 z-10 bg-[hsl(var(--dark-bg))]/95 backdrop-blur border-b border-[hsl(var(--dark-card))]">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
            aria-label="Fechar editor"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold leading-tight truncate">Editar hino {hino.number}</h2>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] uppercase tracking-wide">
              {estrofes} estrofe{estrofes === 1 ? "" : "s"} · {refroes} coro{refroes === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={() => setPreview((v) => !v)}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition ${
              preview ? "bg-primary/20 text-primary" : "hover:bg-[hsl(var(--dark-card))]"
            }`}
            aria-label="Pré-visualizar"
            title="Pré-visualizar"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-60 active:scale-95 transition"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 pb-24 space-y-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[hsl(var(--dark-muted))]">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--dark-card))] outline-none border border-transparent focus:border-primary/40 text-sm font-semibold"
            placeholder="Título do hino"
          />
        </label>

        {preview ? (
          <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-4">
            {secoes.map((s, i) => (
              <div
                key={i}
                className={
                  s.tipo === "refrao"
                    ? "border-l-2 border-[hsl(var(--destructive))] pl-3"
                    : ""
                }
              >
                <p
                  className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${
                    s.tipo === "refrao" ? "text-[hsl(var(--destructive))]" : "text-primary"
                  }`}
                >
                  {s.tipo === "refrao"
                    ? refroes > 1
                      ? `Coro ${secoes.slice(0, i + 1).filter((x) => x.tipo === "refrao").length}`
                      : "Coro"
                    : `Estrofe ${s.numero}`}
                </p>
                {s.linhas.map((l, j) => (
                  <p key={j} className="text-sm leading-relaxed">
                    {l}
                  </p>
                ))}
              </div>
            ))}
          </div>
        ) : (
          sections.map((s, i) => {
            const num =
              s.tipo === "estrofe"
                ? sections.slice(0, i + 1).filter((x) => x.tipo === "estrofe").length
                : sections.slice(0, i + 1).filter((x) => x.tipo === "refrao").length;
            const totalRefroes = sections.filter((x) => x.tipo === "refrao").length;
            return (
              <div key={i} className="rounded-2xl bg-[hsl(var(--dark-card))] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <select
                    value={s.tipo}
                    onChange={(e) => update(i, { tipo: e.target.value as Section["tipo"] })}
                    className="text-[11px] font-bold uppercase tracking-wide bg-[hsl(var(--dark-bg))] rounded-full px-3 py-1.5 outline-none"
                  >
                    <option value="estrofe">Estrofe</option>
                    <option value="refrao">{totalRefroes > 1 ? `Coro ${num}` : "Coro"}</option>
                  </select>
                  <span className="text-[11px] text-[hsl(var(--dark-muted))]">
                    {s.tipo === "estrofe"
                      ? `nº ${num}`
                      : totalRefroes > 1
                        ? `coro ${num} de ${totalRefroes} — vale a partir daqui`
                        : "repetido após cada estrofe"}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === sections.length - 1}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(i)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-[hsl(var(--destructive))] hover:bg-[hsl(var(--dark-card-hover))]"
                      aria-label="Remover seção"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <textarea
                  value={s.text}
                  onChange={(e) => update(i, { text: e.target.value })}
                  rows={Math.max(4, s.text.split("\n").length)}
                  placeholder="Uma linha do hino por linha do texto…"
                  className="w-full bg-[hsl(var(--dark-bg))] rounded-xl px-3 py-2 text-sm leading-relaxed outline-none border border-transparent focus:border-primary/40 resize-y"
                />
              </div>
            );
          })
        )}

        {!preview && (
          <div className="flex gap-2">
            <button
              onClick={() => add("estrofe")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-primary/15 text-primary text-xs font-bold hover:bg-primary/25 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Estrofe
            </button>
            <button
              onClick={() => add("refrao")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-[hsl(var(--dark-card))] text-xs font-bold hover:bg-[hsl(var(--dark-card-hover))] transition"
            >
              <Plus className="w-3.5 h-3.5" /> Coro
            </button>
          </div>
        )}

        <button
          onClick={handleRestore}
          disabled={restoring}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[11px] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--dark-card))] transition disabled:opacity-50"
        >
          {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Restaurar texto original
        </button>
      </main>
    </div>
  );
}
