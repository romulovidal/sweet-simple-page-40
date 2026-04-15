import { useState, useRef, useCallback, useEffect } from "react";
import { Check, Download, ImageIcon, ImageOff, Loader2, Palette, Share2, Type, X } from "lucide-react";
import { toast } from "sonner";

interface VerseImageGeneratorProps {
  text: string;
  reference: string;
  open: boolean;
  onClose: () => void;
}

type GradientBackground = {
  id: string;
  type: "gradient";
  value: string;
  label: string;
};

type ImageBackground = {
  id: string;
  type: "image";
  value: string;
  label: string;
  fallback: string;
};

type BackgroundOption = GradientBackground | ImageBackground;

const BACKGROUNDS: BackgroundOption[] = [
  { id: "gradient1", type: "gradient", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", label: "Roxo" },
  { id: "gradient2", type: "gradient", value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", label: "Rosa" },
  { id: "gradient3", type: "gradient", value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", label: "Azul" },
  { id: "gradient4", type: "gradient", value: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", label: "Verde" },
  { id: "gradient5", type: "gradient", value: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", label: "Por do sol" },
  { id: "gradient6", type: "gradient", value: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", label: "Lavanda" },
  { id: "gradient7", type: "gradient", value: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)", label: "Pessego" },
  { id: "gradient8", type: "gradient", value: "linear-gradient(135deg, #0c3483 0%, #a2b6df 100%, #6b8cce 100%)", label: "Oceano" },
  {
    id: "image1",
    type: "image",
    value: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    label: "Montanha",
    fallback: "linear-gradient(135deg, #304352 0%, #d7d2cc 100%)",
  },
  {
    id: "image2",
    type: "image",
    value: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    label: "Praia",
    fallback: "linear-gradient(135deg, #2b5876 0%, #4e4376 100%)",
  },
  {
    id: "image3",
    type: "image",
    value: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80",
    label: "Floresta",
    fallback: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)",
  },
  {
    id: "image4",
    type: "image",
    value: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
    label: "Noite",
    fallback: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
  },
  {
    id: "image5",
    type: "image",
    value: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80",
    label: "Ceu",
    fallback: "linear-gradient(135deg, #74ebd5 0%, #9face6 100%)",
  },
  {
    id: "image6",
    type: "image",
    value: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80",
    label: "Mar",
    fallback: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
  },
];

const FONTS = [
  { id: "serif", label: "Serifada", family: "Georgia, serif" },
  { id: "sans", label: "Moderna", family: "Inter, sans-serif" },
  { id: "cursive", label: "Cursiva", family: "'Segoe Script', 'Comic Sans MS', cursive" },
  { id: "mono", label: "Mono", family: "'Courier New', monospace" },
];

const TEXT_COLORS = [
  { id: "white", value: "#FFFFFF", label: "Branco" },
  { id: "cream", value: "#FFF8E7", label: "Creme" },
  { id: "black", value: "#1A1A1A", label: "Preto" },
  { id: "gold", value: "#FFD700", label: "Dourado" },
];

function parseGradient(css: string): { colors: string[]; angle: number } {
  const angleMatch = css.match(/(\d+)deg/);
  const angle = angleMatch ? parseInt(angleMatch[1], 10) : 135;
  const colorMatches = css.match(/#[0-9a-fA-F]{6}/g) || [];
  return { colors: colorMatches, angle };
}

function drawGradientBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gradientCss: string
) {
  const { colors, angle } = parseGradient(gradientCss);
  const safeColors = colors.length > 0 ? colors : ["#111827", "#1f2937"];
  const rad = (angle * Math.PI) / 180;
  const x1 = width / 2 - Math.cos(rad) * width / 2;
  const y1 = height / 2 - Math.sin(rad) * height / 2;
  const x2 = width / 2 + Math.cos(rad) * width / 2;
  const y2 = height / 2 + Math.sin(rad) * height / 2;
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);

  safeColors.forEach((color, index) => {
    gradient.addColorStop(index / Math.max(safeColors.length - 1, 1), color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

const VerseImageGenerator = ({ text, reference, open, onClose }: VerseImageGeneratorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBg, setSelectedBg] = useState<BackgroundOption>(BACKGROUNDS[0]);
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);
  const [selectedColor, setSelectedColor] = useState(TEXT_COLORS[0]);
  const [fontSize, setFontSize] = useState(28);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [imageStatus, setImageStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [activeTab, setActiveTab] = useState<"bg" | "font" | "color">("bg");
  const [hiddenPreviewIds, setHiddenPreviewIds] = useState<Record<string, boolean>>({});

  const WIDTH = 1080;
  const HEIGHT = 1080;

  useEffect(() => {
    if (selectedBg.type !== "image") {
      setLoadedImage(null);
      setImageStatus("idle");
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    setLoadedImage(null);
    setImageStatus("loading");

    image.onload = () => {
      if (cancelled) return;
      setLoadedImage(image);
      setImageStatus("loaded");
    };

    image.onerror = () => {
      if (cancelled) return;
      setLoadedImage(null);
      setImageStatus("error");
    };

    image.src = selectedBg.value;

    return () => {
      cancelled = true;
    };
  }, [selectedBg]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    if (selectedBg.type === "image" && loadedImage) {
      const scale = Math.max(WIDTH / loadedImage.width, HEIGHT / loadedImage.height);
      const x = (WIDTH - loadedImage.width * scale) / 2;
      const y = (HEIGHT - loadedImage.height * scale) / 2;

      ctx.drawImage(loadedImage, x, y, loadedImage.width * scale, loadedImage.height * scale);
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      drawGradientBackground(
        ctx,
        WIDTH,
        HEIGHT,
        selectedBg.type === "image" ? selectedBg.fallback : selectedBg.value
      );
    }

    const scaledFontSize = fontSize * 2;
    ctx.fillStyle = selectedColor.value;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = `italic ${scaledFontSize + 20}px ${selectedFont.family}`;
    ctx.globalAlpha = 0.3;
    ctx.fillText("\"", WIDTH / 2, HEIGHT * 0.2);
    ctx.globalAlpha = 1;

    ctx.font = `italic ${scaledFontSize}px ${selectedFont.family}`;
    const maxWidth = WIDTH - 160;
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) lines.push(currentLine);

    const lineHeight = scaledFontSize * 1.5;
    const totalTextHeight = lines.length * lineHeight;
    const startY = (HEIGHT - totalTextHeight) / 2;

    lines.forEach((line, index) => {
      ctx.fillText(line, WIDTH / 2, startY + index * lineHeight + lineHeight / 2);
    });

    ctx.font = `bold ${scaledFontSize * 0.65}px ${selectedFont.family}`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(`- ${reference}`, WIDTH / 2, startY + totalTextHeight + lineHeight);
    ctx.globalAlpha = 1;

    ctx.font = "12px Inter, sans-serif";
    ctx.globalAlpha = 0.4;
    ctx.fillText("Biblia App", WIDTH / 2, HEIGHT - 40);
    ctx.globalAlpha = 1;
  }, [fontSize, loadedImage, reference, selectedBg, selectedColor.value, selectedFont.family, text]);

  useEffect(() => {
    if (open) drawCanvas();
  }, [drawCanvas, open]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `${reference.replace(/\s/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast("Imagem baixada!");
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `${reference}.png`, { type: "image/png" });
        const shareData = { files: [file], title: reference, text: `"${text}" - ${reference}` };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }

      handleDownload();
    } catch {
      handleDownload();
    }
  };

  const markPreviewAsUnavailable = (backgroundId: string) => {
    setHiddenPreviewIds((current) => {
      if (current[backgroundId]) return current;
      return { ...current, [backgroundId]: true };
    });
  };

  if (!open) return null;

  const selectedImageUnavailable = selectedBg.type === "image" && imageStatus === "error";

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-dark-card bg-dark-bg/95 px-4 py-3">
          <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-dark-card">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-bold">Criar Imagem</h2>
          <div className="flex gap-2">
            <button onClick={handleDownload} className="rounded-full bg-dark-card p-2 transition-colors hover:bg-dark-card-hover">
              <Download className="h-4 w-4" />
            </button>
            <button onClick={handleShare} className="rounded-full bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto px-4 py-5 sm:px-6">
            <canvas
              ref={canvasRef}
              className="h-[min(82vw,26rem)] w-[min(82vw,26rem)] rounded-[1.75rem] shadow-2xl sm:h-[min(68vw,30rem)] sm:w-[min(68vw,30rem)] md:h-[min(56vh,34rem)] md:w-[min(56vh,34rem)]"
            />
            {selectedBg.type === "image" && imageStatus === "loading" && (
              <div className="mt-4 flex items-center gap-2 rounded-full bg-dark-card/80 px-3 py-2 text-xs text-dark-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando fundo...
              </div>
            )}
            {selectedImageUnavailable && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <ImageOff className="h-4 w-4" />
                Esse fundo nao carregou. O preview usou um fallback visual.
              </div>
            )}
          </div>

          <div className="flex min-h-[18rem] max-h-[44vh] flex-col border-t border-dark-card bg-dark-bg/95 md:max-h-none md:min-h-0 md:w-[24rem] md:border-l md:border-t-0">
            <div className="grid grid-cols-3 border-b border-dark-card">
              {[
                { key: "bg" as const, icon: ImageIcon, label: "Fundo" },
                { key: "font" as const, icon: Type, label: "Fonte" },
                { key: "color" as const, icon: Palette, label: "Cor" },
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-semibold transition-colors ${
                    activeTab === key ? "border-b-2 border-primary text-primary" : "text-dark-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              {activeTab === "bg" && (
                <div className="grid grid-cols-2 gap-3">
                  {BACKGROUNDS.map((background) => {
                    const isSelected = selectedBg.id === background.id;
                    const previewFailed = background.type === "image" && hiddenPreviewIds[background.id];

                    return (
                      <button
                        key={background.id}
                        onClick={() => setSelectedBg(background)}
                        className={`rounded-2xl border p-2 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-white/5 bg-dark-card hover:bg-dark-card-hover"
                        }`}
                      >
                        <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                background.type === "gradient" ? background.value : background.fallback,
                            }}
                          />
                          {background.type === "image" && !previewFailed && (
                            <img
                              src={background.value}
                              alt={background.label}
                              className="absolute inset-0 h-full w-full object-cover"
                              onError={() => markPreviewAsUnavailable(background.id)}
                            />
                          )}
                          <div className="absolute inset-0 bg-black/10" />
                          {background.type === "image" && previewFailed && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <ImageOff className="h-6 w-6 text-white/85" />
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute right-2 top-2 rounded-full bg-black/40 p-1 text-white">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                        <p className="mt-2 truncate text-xs font-semibold">{background.label}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === "font" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {FONTS.map((font) => {
                      const isSelected = selectedFont.id === font.id;

                      return (
                        <button
                          key={font.id}
                          onClick={() => setSelectedFont(font)}
                          className={`rounded-xl px-4 py-3 text-sm transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-dark-card text-dark-muted hover:bg-dark-card-hover"
                          }`}
                          style={{ fontFamily: font.family }}
                        >
                          {font.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl bg-dark-card p-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-dark-muted">
                      <span>Tamanho da fonte</span>
                      <span>{fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={16}
                      max={48}
                      value={fontSize}
                      onChange={(event) => setFontSize(Number(event.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              )}

              {activeTab === "color" && (
                <div className="grid grid-cols-2 gap-3">
                  {TEXT_COLORS.map((color) => {
                    const isSelected = selectedColor.id === color.id;

                    return (
                      <button
                        key={color.id}
                        onClick={() => setSelectedColor(color)}
                        className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-white/5 bg-dark-card hover:bg-dark-card-hover"
                        }`}
                      >
                        <span
                          className="inline-flex h-10 w-10 flex-shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: color.value }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{color.label}</span>
                          <span className="block truncate text-xs text-dark-muted">{color.value}</span>
                        </span>
                        {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerseImageGenerator;
