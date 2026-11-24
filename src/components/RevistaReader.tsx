import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, FileText, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const PDFJS_VERSION = "4.2.67";
export const PDFJS_LIB_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
export const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

const FLIP_MS = 650;

interface RevistaReaderProps {
  open: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title: string;
  revistaId?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
}

type FlipDir = "next" | "prev" | null;

export default function RevistaReader({ open, onClose, pdfUrl, title, revistaId, pageStart, pageEnd }: RevistaReaderProps) {
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [images, setImages] = useState<Record<number, string>>({});
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flip, setFlip] = useState<FlipDir>(null);

  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  // Intervalo editado aqui no leitor (sobrepõe as props até a próxima abertura)
  const [rangeOverride, setRangeOverride] = useState<{ start: number | null; end: number | null } | null>(null);
  const effStart = rangeOverride?.start ?? pageStart ?? null;
  const effEnd = rangeOverride?.end ?? pageEnd ?? null;

  const [editingRange, setEditingRange] = useState(false);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [savingRange, setSavingRange] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const pdfDocRef = useRef<any>(null);
  const pdfjsRef = useRef<any>(null);
  const renderingRef = useRef<Set<number>>(new Set());
  const cacheRef = useRef<Record<number, string>>({});
  const cancelledRef = useRef(false);
  const flipTimerRef = useRef<number | null>(null);

  const roRef = useRef<ResizeObserver | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  // Mede a área do palco para dimensionar a página (retrato 385:588).
  // Callback ref + ResizeObserver: o conteúdo do Dialog monta depois da
  // abertura (Radix Presence), então medir só no efeito de [open] falhava
  // e a página ficava com tamanho zero (tela cinza).
  const stageRefCb = useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setStageSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    roRef.current = ro;
  }, []);

  useEffect(() => {
    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
    };
  }, []);

  // Fallback para o tamanho da janela caso a medição falhe: a página
  // sempre renderiza com um tamanho válido.
  const availW = stageSize.w > 0 ? stageSize.w : (typeof window !== "undefined" ? window.innerWidth * 0.92 : 360);
  const availH = stageSize.h > 0 ? stageSize.h : (typeof window !== "undefined" ? window.innerHeight * 0.72 : 520);
  const pageW = Math.min(availW, availH * (385 / 588));
  const pageH = pageW / (385 / 588);

  const renderPage = useCallback(async (pageNum: number) => {
    const doc = pdfDocRef.current;
    if (!doc || cacheRef.current[pageNum] || renderingRef.current.has(pageNum)) return;
    renderingRef.current.add(pageNum);
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const scale = (520 * 1.75) / viewport.width;
      const v = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(v.width);
      canvas.height = Math.floor(v.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: v }).promise;
      if (cancelledRef.current) return;
      const url = canvas.toDataURL("image/jpeg", 0.85);
      cacheRef.current[pageNum] = url;
      setImages((prev) => ({ ...prev, [pageNum]: url }));
    } catch (e) {
      console.error("Erro ao renderizar página", pageNum, e);
    } finally {
      renderingRef.current.delete(pageNum);
    }
  }, []);

  // Carrega o documento ao abrir
  useEffect(() => {
    if (!open || !pdfUrl) return;
    cancelledRef.current = false;
    setLoadingDoc(true);
    setError(null);
    setImages({});
    cacheRef.current = {};
    setCurrentIdx(0);
    setFlip(null);
    setRangeOverride(null);
    setEditingRange(false);

    (async () => {
      try {
        if (!pdfjsRef.current) {
          // PDF.js carregado do CDN em tempo de execução (fora do bundle, sem nova dependência)
          const lib = await import(/* @vite-ignore */ PDFJS_LIB_URL);
          lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
          pdfjsRef.current = lib;
        }
        const doc = await pdfjsRef.current.getDocument({ url: pdfUrl }).promise;
        if (cancelledRef.current) {
          doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setLoadingDoc(false);
      } catch (e) {
        console.error("Erro ao abrir o PDF", e);
        if (!cancelledRef.current) {
          setError("Não consegui abrir a revista aqui. Tente de novo ou abra o PDF original.");
          setLoadingDoc(false);
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
      if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [open, pdfUrl]);

  // Lista de páginas derivada do total + intervalo (props ou edição local).
  // Separada do carregamento do documento para a edição não recarregar o PDF.
  useEffect(() => {
    if (totalPages <= 0) return;
    const start = Math.min(Math.max(effStart ?? 1, 1), totalPages);
    const end = Math.min(Math.max(effEnd ?? totalPages, start), totalPages);
    const list: number[] = [];
    for (let p = start; p <= end; p++) list.push(p);
    setPages(list);
    setCurrentIdx(0);
    setFlip(null);
  }, [totalPages, effStart, effEnd]);

  // Pré-renderiza a página atual e as vizinhas
  useEffect(() => {
    if (pages.length === 0) return;
    const cur = pages[currentIdx];
    void renderPage(cur);
    if (currentIdx + 1 < pages.length) void renderPage(pages[currentIdx + 1]);
    if (currentIdx - 1 >= 0) void renderPage(pages[currentIdx - 1]);
  }, [pages, currentIdx, renderPage]);

  const canPrev = currentIdx > 0;
  const canNext = currentIdx < pages.length - 1;

  const goNext = useCallback(() => {
    if (flip || !canNext) return;
    const target = pages[currentIdx + 1];
    if (!cacheRef.current[target]) {
      void renderPage(target);
      return;
    }
    setFlip("next");
    flipTimerRef.current = window.setTimeout(() => {
      setCurrentIdx((i) => i + 1);
      setFlip(null);
    }, FLIP_MS);
  }, [flip, canNext, pages, currentIdx, renderPage]);

  const goPrev = useCallback(() => {
    if (flip || !canPrev) return;
    const target = pages[currentIdx - 1];
    if (!cacheRef.current[target]) {
      void renderPage(target);
      return;
    }
    setFlip("prev");
    flipTimerRef.current = window.setTimeout(() => {
      setCurrentIdx((i) => i - 1);
      setFlip(null);
    }, FLIP_MS);
  }, [flip, canPrev, pages, currentIdx, renderPage]);

  // Teclado
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goNext, goPrev]);

  // Swipe
  const touchXRef = useRef<number | null>(null);
  const onTouchStart = (e: ReactTouchEvent) => {
    touchXRef.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    if (touchXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchXRef.current;
    touchXRef.current = null;
    if (dx < -50) goNext();
    else if (dx > 50) goPrev();
  };

  const currentPage = pages[currentIdx];
  const underPage = flip === "next" ? pages[currentIdx + 1] : currentPage;
  const turningPage = flip === "next" ? currentPage : flip === "prev" ? pages[currentIdx - 1] : null;
  const filtered = pages.length > 0 && (pages[0] !== 1 || pages[pages.length - 1] !== totalPages);

  // Edição do estudo do dia direto no leitor (só admin)
  const openRangeEditor = () => {
    setEditStart(effStart ? String(effStart) : "");
    setEditEnd(effEnd ? String(effEnd) : "");
    setRangeError(null);
    setEditingRange(true);
  };

  const saveRange = async (start: number | null, end: number | null) => {
    if (!revistaId) return;
    setSavingRange(true);
    setRangeError(null);
    // @ts-ignore — tipos gerados ainda não conhecem page_start/page_end
    const { error } = await supabase
      .from("admin_revistas")
      .update({ page_start: start, page_end: end })
      .eq("id", revistaId);
    setSavingRange(false);
    if (error) {
      console.error("Erro ao salvar páginas do dia", error);
      setRangeError("Não consegui salvar. Tente de novo.");
      return;
    }
    setRangeOverride({ start, end });
    setEditingRange(false);
    void queryClient.invalidateQueries({ queryKey: ["revistas-ativas"] });
  };

  const confirmRange = () => {
    const s = editStart.trim() === "" ? null : Number(editStart);
    const e = editEnd.trim() === "" ? null : Number(editEnd);
    if ((s !== null && (!Number.isFinite(s) || s < 1)) || (e !== null && (!Number.isFinite(e) || e < 1))) {
      setRangeError("Use números de página válidos.");
      return;
    }
    const start = s === null ? null : Math.min(s, totalPages);
    const end = e === null ? null : Math.min(e, totalPages);
    if (start !== null && end !== null && start > end) {
      setRangeError("A página inicial não pode ser maior que a final.");
      return;
    }
    void saveRange(start, end);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl w-[96vw] h-[92dvh] p-0 overflow-hidden flex flex-col bg-zinc-950 text-zinc-100 border border-white/10">
        <div className="flex items-center gap-3 pl-4 pr-12 py-3 border-b border-white/10 shrink-0">
          <DialogTitle className="flex-1 min-w-0 text-base font-bold truncate text-white">{title}</DialogTitle>
          <span className="text-xs text-zinc-400 shrink-0">
            {pages.length > 0 ? `Página ${currentPage} de ${totalPages}` : ""}
          </span>
        </div>

        <div
          ref={stageRefCb}
          className="flex-1 min-h-0 flex items-center justify-center bg-black/60 relative overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {loadingDoc ? (
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-sm">Carregando a revista…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <FileText className="w-10 h-10 text-zinc-400" />
              <p className="text-sm text-zinc-300">{error}</p>
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-amber-300 underline">
                  Abrir o PDF original
                </a>
              )}
            </div>
          ) : pages.length > 0 && pageW > 0 ? (
            <div style={{ width: pageW, height: pageH, perspective: "1600px" }} className="relative shrink-0">
              {/* página de baixo */}
              {images[underPage] ? (
                <img src={images[underPage]} alt={`Página ${underPage}`} className="absolute inset-0 w-full h-full object-cover rounded-sm shadow-2xl" draggable={false} />
              ) : (
                <div className="absolute inset-0 bg-white/5 rounded-sm flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                </div>
              )}
              {/* página virando */}
              {flip && turningPage && images[turningPage] && (
                <div className={`absolute inset-0 ${flip === "next" ? "revista-page-turn-next" : "revista-page-turn-prev"}`}>
                  <img src={images[turningPage]} alt="" className="absolute inset-0 w-full h-full object-cover rounded-sm shadow-2xl" draggable={false} />
                  <div className="revista-page-shade absolute inset-0 bg-black rounded-sm pointer-events-none" />
                </div>
              )}
              {/* zonas de toque: esquerda volta, direita avança */}
              <button aria-label="Página anterior" onClick={goPrev} disabled={!canPrev} className="absolute left-0 top-0 bottom-0 w-[30%] z-10" />
              <button aria-label="Próxima página" onClick={goNext} disabled={!canNext} className="absolute right-0 top-0 bottom-0 w-[30%] z-10" />
            </div>
          ) : null}
        </div>

        {editingRange && (
          <div className="px-4 py-3 border-t border-white/10 bg-zinc-900 shrink-0">
            <p className="text-xs font-semibold text-zinc-200 mb-2">Páginas do estudo do dia</p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">De</label>
              <input
                type="number" min={1} max={totalPages} value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                placeholder="1"
                className="h-10 w-20 rounded-lg bg-zinc-800 border border-white/15 text-white text-center text-sm outline-none focus:border-amber-400/60"
              />
              <label className="text-xs text-zinc-400">Até</label>
              <input
                type="number" min={1} max={totalPages} value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                placeholder={String(totalPages || "")}
                className="h-10 w-20 rounded-lg bg-zinc-800 border border-white/15 text-white text-center text-sm outline-none focus:border-amber-400/60"
              />
              <Button onClick={confirmRange} disabled={savingRange} className="h-10 px-4 rounded-xl bg-amber-400 text-zinc-950 font-bold hover:bg-amber-300 ml-auto">
                {savingRange ? "Salvando…" : "Salvar"}
              </Button>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <button onClick={() => void saveRange(null, null)} disabled={savingRange} className="text-[11px] font-semibold text-zinc-300 hover:text-white disabled:opacity-40">
                Revista inteira
              </button>
              <button onClick={() => setEditingRange(false)} disabled={savingRange} className="text-[11px] font-semibold text-zinc-400 hover:text-white disabled:opacity-40">
                Cancelar
              </button>
              {rangeError && <p className="text-[11px] text-red-400">{rangeError}</p>}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/10 shrink-0">
          <Button variant="ghost" onClick={goPrev} disabled={!canPrev || !!flip} className="h-10 px-4 rounded-xl border border-white/20 bg-white/5 text-zinc-100 font-semibold hover:bg-white/10 hover:text-white disabled:opacity-40">
            <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
          </Button>
          <div className="text-center">
            <p className="text-xs text-zinc-400">
              {pages.length > 0 ? `${currentIdx + 1} de ${pages.length} páginas` : ""}
            </p>
            {filtered && (
              <p className="text-[11px] text-amber-300/90">Estudo do dia: págs. {pages[0]}–{pages[pages.length - 1]}</p>
            )}
            {isAdmin && !editingRange && (
              <button onClick={openRangeEditor} className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300/90 hover:text-amber-200">
                <Pencil className="w-3 h-3" /> {filtered ? "Editar páginas do dia" : "Definir estudo do dia"}
              </button>
            )}
          </div>
          <Button variant="ghost" onClick={goNext} disabled={!canNext || !!flip} className="h-10 px-4 rounded-xl bg-amber-400 text-zinc-950 font-bold hover:bg-amber-300 hover:text-zinc-950 disabled:opacity-40">
            Próxima <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
