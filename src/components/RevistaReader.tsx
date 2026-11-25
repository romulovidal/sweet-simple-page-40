import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, FileText, Pencil, Share2, ImageDown, CornerUpLeft, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const PDFJS_VERSION = "4.2.67";
export const PDFJS_LIB_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
export const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

const FLIP_MS = 650;

// Zoom da página — vale SÓ dentro do leitor (transform no contêiner da
// página). A meta viewport global continua travada (user-scalable=no),
// então a interface fora da revista segue sem zoom nenhum.
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2;

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

  // Menu próprio do app (segurar a página / botão direito) — no lugar do menu do sistema
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [menuMode, setMenuMode] = useState<"main" | "goto">("main");
  const [goToPage, setGoToPage] = useState("");
  const longPressTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const menuJustOpenedRef = useRef(false);
  const stageElRef = useRef<HTMLDivElement | null>(null);

  const pdfDocRef = useRef<any>(null);
  const pdfjsRef = useRef<any>(null);
  const renderingRef = useRef<Set<number>>(new Set());
  const cacheRef = useRef<Record<number, string>>({});
  const cancelledRef = useRef(false);
  const flipTimerRef = useRef<number | null>(null);

  const roRef = useRef<ResizeObserver | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  // Estado do zoom da página (escala + deslocamento). viewRef é a fonte
  // para a matemática dos gestos; `view` espelha para a renderização.
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const [zoomAnim, setZoomAnim] = useState(false);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const panAnchorRef = useRef<{ cx: number; cy: number; x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const pinchHappenedRef = useRef(false);
  const mousePanRef = useRef(false);
  const wheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null);
  const zoomAtPointRef = useRef<(z: number, x: number, y: number) => void>(() => {});

  // Mede a área do palco para dimensionar a página (retrato 385:588).
  // Callback ref + ResizeObserver: o conteúdo do Dialog monta depois da
  // abertura (Radix Presence), então medir só no efeito de [open] falhava
  // e a página ficava com tamanho zero (tela cinza).
  const blockPinch = useCallback((e: Event) => e.preventDefault(), []);

  // Pinça de trackpad no desktop chega como wheel com ctrlKey.
  const onWheelZoom = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.01);
    zoomAtPointRef.current(viewRef.current.zoom * factor, e.clientX, e.clientY);
  }, []);

  const stageRefCb = useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    // iOS Safari: bloqueia o zoom NATIVO da pinça no palco do leitor (ele
    // ampliaria a interface inteira). O zoom da revista é manual, via
    // eventos de toque + transform — só na página, nada vaza pra fora.
    // Anexado aqui (não num efeito de [open]) porque o palco monta depois da abertura.
    if (stageElRef.current) {
      stageElRef.current.removeEventListener("gesturestart", blockPinch);
      if (wheelHandlerRef.current) stageElRef.current.removeEventListener("wheel", wheelHandlerRef.current);
    }
    stageElRef.current = el;
    if (!el) return;
    el.addEventListener("gesturestart", blockPinch);
    wheelHandlerRef.current = onWheelZoom;
    el.addEventListener("wheel", onWheelZoom, { passive: false });
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setStageSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    roRef.current = ro;
  }, [blockPinch, onWheelZoom]);

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

  // ---- Zoom da página (contido no leitor) ----
  // O deslocamento é limitado às bordas: a página ampliada nunca sai do palco.
  const clampPan = useCallback((zoom: number, x: number, y: number) => {
    const maxX = Math.max(0, (pageW * zoom - availW) / 2);
    const maxY = Math.max(0, (pageH * zoom - availH) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, [pageW, pageH, availW, availH]);

  const applyView = useCallback((zoom: number, x: number, y: number) => {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    const p = z <= MIN_ZOOM ? { x: 0, y: 0 } : clampPan(z, x, y);
    const next = { zoom: z, x: p.x, y: p.y };
    viewRef.current = next;
    setView(next);
  }, [clampPan]);

  const resetZoom = useCallback(() => {
    pinchRef.current = null;
    panAnchorRef.current = null;
    mousePanRef.current = false;
    lastTapRef.current = null;
    if (viewRef.current.zoom !== 1 || viewRef.current.x !== 0 || viewRef.current.y !== 0) {
      viewRef.current = { zoom: 1, x: 0, y: 0 };
      setView(viewRef.current);
    }
  }, []);

  // Amplia/reduz mantendo fixo na tela o ponto (px, py) — centro da pinça,
  // do toque duplo ou do cursor.
  const zoomAtPoint = useCallback((targetZoom: number, px: number, py: number) => {
    const el = stageElRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const cur = viewRef.current;
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
    if (z <= MIN_ZOOM) {
      applyView(1, 0, 0);
      return;
    }
    const ratio = z / cur.zoom;
    applyView(z, px - cx - (px - cx - cur.x) * ratio, py - cy - (py - cy - cur.y) * ratio);
  }, [applyView]);

  useEffect(() => {
    zoomAtPointRef.current = zoomAtPoint;
  }, [zoomAtPoint]);

  const toggleDoubleTapZoom = useCallback((px: number, py: number) => {
    setZoomAnim(true);
    if (viewRef.current.zoom > 1.01) applyView(1, 0, 0);
    else zoomAtPoint(DOUBLE_TAP_ZOOM, px, py);
  }, [applyView, zoomAtPoint]);

  // Fechar o leitor zera o zoom (reabrir começa em 1x).
  useEffect(() => {
    if (!open) resetZoom();
  }, [open, resetZoom]);

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
    resetZoom();
    setRangeOverride(null);
    setEditingRange(false);
    setMenu(null);

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
  }, [open, pdfUrl, resetZoom]);

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
    resetZoom(); // virar a página volta o zoom a 1x
    setFlip("next");
    flipTimerRef.current = window.setTimeout(() => {
      setCurrentIdx((i) => i + 1);
      setFlip(null);
    }, FLIP_MS);
  }, [flip, canNext, pages, currentIdx, renderPage, resetZoom]);

  const goPrev = useCallback(() => {
    if (flip || !canPrev) return;
    const target = pages[currentIdx - 1];
    if (!cacheRef.current[target]) {
      void renderPage(target);
      return;
    }
    resetZoom(); // virar a página volta o zoom a 1x
    setFlip("prev");
    flipTimerRef.current = window.setTimeout(() => {
      setCurrentIdx((i) => i - 1);
      setFlip(null);
    }, FLIP_MS);
  }, [flip, canPrev, pages, currentIdx, renderPage, resetZoom]);

  // Teclado
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menu) {
        setMenu(null);
        return;
      }
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goNext, goPrev, menu]);

  // Menu próprio do app: segurar a página (500 ms) ou botão direito abre o menu
  const openMenu = useCallback((clientX: number, clientY: number) => {
    const w = typeof window !== "undefined" ? window.innerWidth : 400;
    const h = typeof window !== "undefined" ? window.innerHeight : 700;
    setMenu({
      x: Math.max(8, Math.min(clientX, w - 240)),
      y: Math.max(8, Math.min(clientY, h - 270)),
    });
    setMenuMode("main");
    menuJustOpenedRef.current = true;
  }, []);

  const closeMenu = useCallback(() => {
    setMenu(null);
    setMenuMode("main");
  }, []);

  const cancelPress = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressStartRef.current = null;
  }, []);

  const startPress = useCallback((clientX: number, clientY: number) => {
    menuJustOpenedRef.current = false;
    pressStartRef.current = { x: clientX, y: clientY };
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      openMenu(clientX, clientY);
    }, 500);
  }, [openMenu]);

  // Swipe + segurar + zoom (pinça / arrastar com zoom / toque duplo)
  const touchXRef = useRef<number | null>(null);
  const touchDist = (t: ReactTouchEvent["touches"]) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  // Toque duplo: sem zoom, só vale na faixa central (as laterais viram a
  // página); com zoom, vale em qualquer ponto e volta a 1x.
  const handleTap = (x: number, y: number, zoomed: boolean) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && now - last.t < 300 && Math.hypot(x - last.x, y - last.y) < 48) {
      lastTapRef.current = null;
      if (!zoomed) {
        const el = stageElRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          const rel = (x - r.left) / r.width;
          if (rel < 0.3 || rel > 0.7) return;
        }
      }
      toggleDoubleTapZoom(x, y);
      return;
    }
    lastTapRef.current = { t: now, x, y };
  };

  const onTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { dist: touchDist(e.touches), zoom: viewRef.current.zoom };
      pinchHappenedRef.current = true;
      panAnchorRef.current = null;
      cancelPress();
      return;
    }
    touchXRef.current = e.touches[0].clientX;
    if (viewRef.current.zoom > 1) {
      panAnchorRef.current = {
        cx: e.touches[0].clientX, cy: e.touches[0].clientY,
        x: viewRef.current.x, y: viewRef.current.y,
      };
    }
    if (e.touches.length === 1) startPress(e.touches[0].clientX, e.touches[0].clientY);
    else cancelPress();
  };
  const onTouchMove = (e: ReactTouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = touchDist(e.touches);
      if (dist > 0 && pinchRef.current.dist > 0) {
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomAtPoint(pinchRef.current.zoom * (dist / pinchRef.current.dist), mx, my);
      }
      return;
    }
    // Com zoom, arrastar com um dedo move a página (não vira a página)
    if (e.touches.length === 1 && panAnchorRef.current && viewRef.current.zoom > 1) {
      const a = panAnchorRef.current;
      applyView(
        viewRef.current.zoom,
        a.x + (e.touches[0].clientX - a.cx),
        a.y + (e.touches[0].clientY - a.cy),
      );
    }
    const s = pressStartRef.current;
    if (!s) return;
    const dx = e.touches[0].clientX - s.x;
    const dy = e.touches[0].clientY - s.y;
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) cancelPress();
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    const s = pressStartRef.current;
    const t = e.changedTouches[0];
    const dy = s ? t.clientY - s.y : 0;
    cancelPress();
    // Fim da pinça: se sobrou um dedo, ele vira a âncora do arrastar (sem salto)
    if (pinchRef.current) {
      pinchRef.current = null;
      if (e.touches.length === 1 && viewRef.current.zoom > 1) {
        panAnchorRef.current = {
          cx: e.touches[0].clientX, cy: e.touches[0].clientY,
          x: viewRef.current.x, y: viewRef.current.y,
        };
      }
    }
    if (e.touches.length === 0) panAnchorRef.current = null;
    if (touchXRef.current === null) return;
    const dx = t.clientX - touchXRef.current;
    touchXRef.current = null;
    const wasPinch = pinchHappenedRef.current;
    pinchHappenedRef.current = false;
    if (wasPinch) return; // gesto de pinça nunca vira a página
    if (menuJustOpenedRef.current) return; // segurar abriu o menu: não é toque
    const isTap = Math.abs(dx) <= 12 && Math.abs(dy) <= 12;
    if (viewRef.current.zoom > 1) {
      // Com zoom: sem swipe de página; toque duplo volta a 1x
      if (isTap) handleTap(t.clientX, t.clientY, true);
      return;
    }
    if (dx < -50) { lastTapRef.current = null; goNext(); }
    else if (dx > 50) { lastTapRef.current = null; goPrev(); }
    else if (isTap) handleTap(t.clientX, t.clientY, false);
  };

  const onMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    if (viewRef.current.zoom > 1) {
      panAnchorRef.current = { cx: e.clientX, cy: e.clientY, x: viewRef.current.x, y: viewRef.current.y };
      mousePanRef.current = true;
    }
    startPress(e.clientX, e.clientY);
  };
  const onMouseMove = (e: ReactMouseEvent) => {
    if (!mousePanRef.current || !panAnchorRef.current) return;
    const a = panAnchorRef.current;
    if (Math.hypot(e.clientX - a.cx, e.clientY - a.cy) > 4) cancelPress();
    applyView(viewRef.current.zoom, a.x + (e.clientX - a.cx), a.y + (e.clientY - a.cy));
  };
  const onMouseUp = () => {
    mousePanRef.current = false;
    panAnchorRef.current = null;
    cancelPress();
  };
  const onDoubleClick = (e: ReactMouseEvent) => {
    e.preventDefault();
    // Nas zonas laterais (sem zoom) o clique duplo continua virando a página
    if (viewRef.current.zoom <= 1 && (e.target as HTMLElement).closest("button")) return;
    toggleDoubleTapZoom(e.clientX, e.clientY);
  };
  const onContextMenu = (e: ReactMouseEvent) => {
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  };

  // Ações do menu
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const sharePage = async () => {
    const page = currentPage;
    const dataUrl = cacheRef.current[page];
    closeMenu();
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `licao-pagina-${page}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${title} — página ${page}` });
      } else {
        await navigator.share({ title, text: `${title} — página ${page}`, url: window.location.href });
      }
    } catch {
      // Compartilhamento cancelado pelo usuário — sem erro visível
    }
  };

  const savePageImage = () => {
    const page = currentPage;
    const dataUrl = cacheRef.current[page];
    closeMenu();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `licao-pagina-${page}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const confirmGoTo = () => {
    const n = Number(goToPage);
    if (!Number.isFinite(n) || pages.length === 0) return;
    const clamped = Math.max(pages[0], Math.min(Math.floor(n), pages[pages.length - 1]));
    const idx = pages.indexOf(clamped);
    setCurrentIdx(idx >= 0 ? idx : 0);
    setFlip(null);
    resetZoom();
    closeMenu();
  };

  // Clique na zona de toque logo após abrir o menu pelo segurar não vira a página
  const zoneClick = (fn: () => void) => () => {
    if (menuJustOpenedRef.current) {
      menuJustOpenedRef.current = false;
      return;
    }
    fn();
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
      <DialogContent
        className="max-w-2xl w-[96vw] h-[92dvh] p-0 overflow-hidden flex flex-col bg-zinc-950 text-zinc-100 border border-white/10 select-none"
        style={{ touchAction: "none" }}
        onEscapeKeyDown={(e) => { if (menu) { e.preventDefault(); closeMenu(); } }}
      >
        <div className="flex items-center gap-3 pl-4 pr-12 py-3 border-b border-white/10 shrink-0">
          <DialogTitle className="flex-1 min-w-0 text-base font-bold truncate text-white">{title}</DialogTitle>
          <span className="text-xs text-zinc-400 shrink-0">
            {pages.length > 0 ? `Página ${currentPage} de ${totalPages}` : ""}
          </span>
        </div>

        <div
          ref={stageRefCb}
          className="flex-1 min-h-0 flex items-center justify-center bg-black/60 relative overflow-hidden"
          style={{ touchAction: "none" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onContextMenu={onContextMenu}
          onDoubleClick={onDoubleClick}
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
            <div
              style={{
                width: pageW, height: pageH, perspective: "1600px",
                // Zoom contido na página: escala + deslocamento só aqui dentro
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
                transformOrigin: "center center",
                transition: zoomAnim ? "transform 0.22s ease-out" : "none",
                willChange: "transform",
              }}
              className="relative shrink-0"
              onTransitionEnd={() => setZoomAnim(false)}
            >
              {/* página de baixo */}
              {images[underPage] ? (
                <img src={images[underPage]} alt={`Página ${underPage}`} className="absolute inset-0 w-full h-full object-cover rounded-sm shadow-2xl [-webkit-touch-callout:none]" draggable={false} onDragStart={(e) => e.preventDefault()} />
              ) : (
                <div className="absolute inset-0 bg-white/5 rounded-sm flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                </div>
              )}
              {/* página virando */}
              {flip && turningPage && images[turningPage] && (
                <div className={`absolute inset-0 ${flip === "next" ? "revista-page-turn-next" : "revista-page-turn-prev"}`}>
                  <img src={images[turningPage]} alt="" className="absolute inset-0 w-full h-full object-cover rounded-sm shadow-2xl [-webkit-touch-callout:none]" draggable={false} onDragStart={(e) => e.preventDefault()} />
                  <div className="revista-page-shade absolute inset-0 bg-black rounded-sm pointer-events-none" />
                </div>
              )}
              {/* zonas de toque: esquerda volta, direita avança.
                  Com zoom, desligam: arrastar move a página e toque não vira. */}
              <button aria-label="Página anterior" onClick={zoneClick(goPrev)} disabled={!canPrev} style={{ pointerEvents: view.zoom > 1 ? "none" : "auto" }} className="absolute left-0 top-0 bottom-0 w-[30%] z-10" />
              <button aria-label="Próxima página" onClick={zoneClick(goNext)} disabled={!canNext} style={{ pointerEvents: view.zoom > 1 ? "none" : "auto" }} className="absolute right-0 top-0 bottom-0 w-[30%] z-10" />
            </div>
          ) : null}
        </div>

        {/* Menu próprio do app (segurar a página / botão direito).
            O cartão vai por portal para o body: o DialogContent tem transform
            (centralização) + overflow-hidden, o que deslocava e cortava um
            menu `fixed` dentro dele — existia no DOM mas não aparecia. */}
        {menu && (
          <>
            <div
              className="absolute inset-0 z-40"
              onClick={closeMenu}
              onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}
            />
            {createPortal(
              <div
                className="fixed z-[60] w-[230px] rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden"
                style={{ left: menu.x, top: menu.y }}
              >
              {menuMode === "main" ? (
                <>
                  {canShare && (
                    <button onClick={sharePage} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-100 hover:bg-white/5 text-left">
                      <Share2 className="w-4 h-4 text-amber-300 shrink-0" /> Compartilhar página
                    </button>
                  )}
                  <button onClick={savePageImage} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-100 hover:bg-white/5 text-left">
                    <ImageDown className="w-4 h-4 text-amber-300 shrink-0" /> Salvar imagem da página
                  </button>
                  <button onClick={() => { setGoToPage(""); setMenuMode("goto"); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-100 hover:bg-white/5 text-left">
                    <CornerUpLeft className="w-4 h-4 text-amber-300 shrink-0" /> Ir para a página…
                  </button>
                  <div className="h-px bg-white/10" />
                  <button onClick={() => { closeMenu(); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-white/5 text-left">
                    <X className="w-4 h-4 text-zinc-400 shrink-0" /> Fechar leitor
                  </button>
                </>
              ) : (
                <div className="p-3">
                  <p className="text-xs font-semibold text-zinc-200 mb-2">
                    Ir para a página ({pages.length > 0 ? `${pages[0]}–${pages[pages.length - 1]}` : `1–${totalPages}`})
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={1} max={totalPages} value={goToPage}
                      onChange={(e) => setGoToPage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") confirmGoTo(); }}
                      placeholder={String(currentPage || "")}
                      autoFocus
                      className="h-10 flex-1 min-w-0 rounded-lg bg-zinc-800 border border-white/15 text-white text-center text-sm outline-none focus:border-amber-400/60"
                    />
                    <Button onClick={confirmGoTo} className="h-10 px-4 rounded-xl bg-amber-400 text-zinc-950 font-bold hover:bg-amber-300">
                      Ir
                    </Button>
                  </div>
                  <button onClick={() => setMenuMode("main")} className="mt-2 text-[11px] font-semibold text-zinc-400 hover:text-white">
                    Voltar
                  </button>
                </div>
              )}
              </div>,
              document.body,
            )}
          </>
        )}

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

