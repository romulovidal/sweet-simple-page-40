import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from "react";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import type { HarpaHino } from "@/data/harpa";
import HarpaMiniPlayer from "@/components/HarpaMiniPlayer";

type Props = {
  hino: HarpaHino;
  onClose: () => void;
  /** Optional admin-curated YouTube URL. Enables audio playback in presentation mode. */
  videoUrl?: string | null;
  /** Called when the video ends (used to auto-advance in a culto sequence). */
  onAudioEnded?: () => void;
};

// Modo apresentação: uma estrofe por vez, fonte gigante, fundo preto.
// Ideal para púlpito/projetor. Navegação: setas, espaço, PageUp/PageDown, Esc.
export default function HarpaPresenter({ hino, onClose, videoUrl, onAudioEnded }: Props) {
  const [step, setStep] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const [rotateFallback, setRotateFallback] = useState(false);

  // Sequência de "telas": título + cada estrofe (com coro repetido entre estrofes)
  const slides = useMemo(() => {
    const arr: { kind: "title" | "chorus" | "verse"; index?: number; lines: string[] }[] = [
      { kind: "title", lines: [hino.title] },
    ];
    const chorus = hino.strophes.find((s) => s.chorus);
    for (const s of hino.strophes) {
      if (s.chorus) continue;
      arr.push({ kind: "verse", index: s.index, lines: s.lines });
      if (chorus) arr.push({ kind: "chorus", lines: chorus.lines });
    }
    // Se o hino for só coro (raro), garante que apareça
    if (arr.length === 1 && chorus) arr.push({ kind: "chorus", lines: chorus.lines });
    return arr;
  }, [hino]);

  useEffect(() => {
    setStep(0);
  }, [hino.number]);

  const next = useCallback(() => setStep((s) => Math.min(slides.length - 1, s + 1)), [slides.length]);
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // Fullscreen + travar paisagem. Robusto para iOS (sem fullscreen/lock) e
  // Android (fullscreen precisa vir ANTES do lock).
  useEffect(() => {
    let cancelled = false;
    let entered = false;
    let locked = false;

    const onFsChange = () => {
      // Só fecha se realmente entramos em fullscreen e depois saímos
      if (entered && !document.fullscreenElement) onClose();
    };

    (async () => {
      const el = document.documentElement;
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
          if (cancelled) return;
          entered = true;
          document.addEventListener("fullscreenchange", onFsChange);
        }
      } catch {
        // fullscreen negado — segue sem
      }
      try {
        // @ts-ignore
        if (screen.orientation?.lock) {
          // @ts-ignore
          await screen.orientation.lock("landscape");
          locked = true;
        } else {
          // iOS Safari e afins: aplica fallback via CSS rotate quando em retrato
          const portrait = window.innerHeight > window.innerWidth;
          if (portrait) setRotateFallback(true);
        }
      } catch {
        // lock rejeitado (ex: iOS) — usa fallback
        const portrait = window.innerHeight > window.innerWidth;
        if (portrait) setRotateFallback(true);
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("fullscreenchange", onFsChange);
      if (locked) {
        try {
          // @ts-ignore
          screen.orientation?.unlock?.();
        } catch {}
      }
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [onClose]);

  // Wake lock — mantém a tela ligada durante o culto
  useEffect(() => {
    let wake: any = null;
    (async () => {
      try {
        // @ts-ignore
        wake = await navigator.wakeLock?.request?.("screen");
      } catch {}
    })();
    return () => {
      try {
        wake?.release?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown" || e.key === "ArrowDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "ArrowUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  const current = slides[step];
  const isChorus = current.kind === "chorus";
  const isTitle = current.kind === "title";

  // Auto-fit: mede o container e reduz a fonte até TUDO caber sem scroll.
  const contentBoxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fitFont, setFitFont] = useState(48);

  useLayoutEffect(() => {
    const box = contentBoxRef.current;
    const el = contentRef.current;
    if (!box || !el) return;

    const fit = () => {
      // Reseta para o tamanho máximo e diminui até caber
      const maxH = box.clientHeight;
      const maxW = box.clientWidth;
      if (maxH <= 0 || maxW <= 0) return;
      // Ponto inicial: altura por linha ~ maxH / (linhas + 1)
      const lineCount = Math.max(current.lines.length, 1);
      let size = isTitle
        ? Math.min(maxH * 0.35, maxW * 0.12, 96)
        : Math.min(maxH / (lineCount + 1.2), maxW * 0.09, 72);
      const min = isTitle ? 20 : 14;
      // Ajusta iterativamente enquanto transbordar
      el.style.fontSize = `${size}px`;
      let guard = 40;
      while (
        guard-- > 0 &&
        size > min &&
        (el.scrollHeight > maxH || el.scrollWidth > maxW)
      ) {
        size = Math.max(min, size - Math.max(1, size * 0.06));
        el.style.fontSize = `${size}px`;
      }
      setFitFont(size);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, [current, isTitle, rotateFallback, audioOn]);

  // Tap na esquerda volta, na direita avança. Ignora se clicou em um controle
  // (que já usa stopPropagation).
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    // Quando estamos no fallback de rotação (iOS Safari), o elemento está
    // girado 90° visualmente, mas as coordenadas do toque vêm no espaço da
    // viewport real. Nesse caso, o "esquerdo visual" corresponde ao TOPO da
    // viewport (menor clientY). Sem rotação, usamos clientX normalmente.
    if (rotateFallback) {
      if (e.clientY < window.innerHeight / 2) prev();
      else next();
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) prev();
      else next();
    }
  };

  // Estilo do fallback de rotação (iOS Safari, quando não conseguimos travar).
  // Usa transform-origin no topo-esquerdo para não brigar com inset-0.
  const rotateStyle: React.CSSProperties | undefined = rotateFallback
    ? {
        inset: "auto",
        top: 0,
        left: "100vw",
        width: "100vh",
        height: "100vw",
        transformOrigin: "top left",
        transform: "rotate(90deg)",
      }
    : undefined;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black text-white flex flex-col select-none"
      style={rotateStyle}
      onClick={handleTap}
    >
      {/* Barra superior */}
      <div
        className="flex items-center justify-between px-6 py-3 text-white/60 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-semibold">
          {hino.number}. {hino.title}
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAudioOn((v) => !v)}
            className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition"
          >
            {audioOn ? "🔊 Áudio ativo" : "🔈 Ativar áudio"}
          </button>
          <span>
            {step + 1} / {slides.length}
          </span>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"
            aria-label="Sair da apresentação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {audioOn && (
        <div
          className="flex justify-center pb-2"
          onClick={(e) => e.stopPropagation()}
        >
          <HarpaMiniPlayer
            number={hino.number}
            title={hino.title}
            autoPlay
            videoUrl={videoUrl ?? undefined}
            onEnded={() => {
              try {
                onAudioEnded?.();
              } catch {}
            }}
          />
        </div>
      )}

      {/* Conteúdo central */}
      <div
        ref={contentBoxRef}
        className="flex-1 min-h-0 flex items-center justify-center px-3 sm:px-8 md:px-16 overflow-hidden"
      >
        <div
          ref={contentRef}
          className={`w-full max-w-6xl text-center ${
            isChorus ? "text-[hsl(var(--destructive))]" : "text-white"
          }`}
          style={{ fontSize: `${fitFont}px` }}
        >
          {isChorus && (
            <p className="uppercase tracking-[0.3em] opacity-80" style={{ fontSize: "0.35em", marginBottom: "0.6em", letterSpacing: "0.3em" }}>
              Coro
            </p>
          )}
          {!isTitle && !isChorus && current.index !== undefined && (
            <p className="text-primary/80 font-semibold" style={{ fontSize: "0.4em", marginBottom: "0.6em" }}>
              Estrofe {current.index}
            </p>
          )}
          {current.lines.map((line, i) => (
            <p
              key={i}
              className={isTitle ? "font-bold leading-tight" : "font-semibold leading-[1.18]"}
            >
              {line}
            </p>
          ))}
          {isTitle && (
            <p className="text-white/50" style={{ fontSize: "0.28em", marginTop: "1em" }}>
              Hino {hino.number} — Harpa Cristã
            </p>
          )}
        </div>
      </div>

      {/* Controles */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={prev}
          disabled={step === 0}
          className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition text-sm sm:text-base"
        >
          <ChevronLeft className="w-5 h-5" /> Anterior
        </button>
        <span className="hidden md:flex items-center gap-2 text-white/40 text-xs">
          <Maximize2 className="w-3 h-3" />
          Setas/espaço para navegar · Esc para sair
        </span>
        <button
          onClick={next}
          disabled={step === slides.length - 1}
          className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition text-sm sm:text-base"
        >
          Próximo <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}