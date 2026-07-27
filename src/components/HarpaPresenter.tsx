import { useEffect, useMemo, useState, useCallback } from "react";
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

  return (
    <div
      className="fixed inset-0 z-[100] bg-black text-white flex flex-col select-none"
      style={
        rotateFallback
          ? {
              transform: "rotate(90deg)",
              transformOrigin: "center center",
              width: "100vh",
              height: "100vw",
              top: "50%",
              left: "50%",
              marginTop: "-50vw",
              marginLeft: "-50vh",
            }
          : undefined
      }
      onClick={next}
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
      <div className="flex-1 flex items-center justify-center px-8 md:px-20">
        <div
          className={`w-full max-w-6xl text-center ${
            isChorus ? "text-[hsl(var(--destructive))]" : "text-white"
          }`}
        >
          {isChorus && (
            <p className="uppercase tracking-[0.3em] text-lg md:text-2xl mb-6 opacity-80">
              Coro
            </p>
          )}
          {!isTitle && !isChorus && current.index !== undefined && (
            <p className="text-primary/80 text-lg md:text-2xl mb-6 font-semibold">
              Estrofe {current.index}
            </p>
          )}
          {current.lines.map((line, i) => (
            <p
              key={i}
              className={
                isTitle
                  ? "text-5xl md:text-7xl lg:text-8xl font-bold leading-tight"
                  : "text-4xl md:text-6xl lg:text-7xl font-semibold leading-[1.25] mb-2"
              }
            >
              {line}
            </p>
          ))}
          {isTitle && (
            <p className="mt-10 text-xl md:text-3xl text-white/50">
              Hino {hino.number} — Harpa Cristã
            </p>
          )}
        </div>
      </div>

      {/* Controles */}
      <div
        className="flex items-center justify-between px-6 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={prev}
          disabled={step === 0}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition"
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
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition"
        >
          Próximo <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}