import { useState, useRef, useCallback, useEffect } from "react";
import { X, Download, Share2, Type, ImageIcon, Palette } from "lucide-react";
import { toast } from "sonner";

interface VerseImageGeneratorProps {
  text: string;
  reference: string;
  open: boolean;
  onClose: () => void;
}

const BACKGROUNDS = [
  { id: "gradient1", type: "gradient" as const, value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", label: "Roxo" },
  { id: "gradient2", type: "gradient" as const, value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", label: "Rosa" },
  { id: "gradient3", type: "gradient" as const, value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", label: "Azul" },
  { id: "gradient4", type: "gradient" as const, value: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", label: "Verde" },
  { id: "gradient5", type: "gradient" as const, value: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", label: "Pôr do sol" },
  { id: "gradient6", type: "gradient" as const, value: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", label: "Lavanda" },
  { id: "gradient7", type: "gradient" as const, value: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)", label: "Pêssego" },
  { id: "gradient8", type: "gradient" as const, value: "linear-gradient(135deg, #0c3483 0%, #a2b6df 100%, #6b8cce 100%)", label: "Oceano" },
  { id: "image1", type: "image" as const, value: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80", label: "Montanha" },
  { id: "image2", type: "image" as const, value: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", label: "Praia" },
  { id: "image3", type: "image" as const, value: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80", label: "Floresta" },
  { id: "image4", type: "image" as const, value: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80", label: "Noite" },
  { id: "image5", type: "image" as const, value: "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=800&q=80", label: "Céu" },
  { id: "image6", type: "image" as const, value: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80", label: "Mar" },
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
  const angle = angleMatch ? parseInt(angleMatch[1]) : 135;
  const colorMatches = css.match(/#[0-9a-fA-F]{6}/g) || [];
  return { colors: colorMatches, angle };
}

const VerseImageGenerator = ({ text, reference, open, onClose }: VerseImageGeneratorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBg, setSelectedBg] = useState(BACKGROUNDS[0]);
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);
  const [selectedColor, setSelectedColor] = useState(TEXT_COLORS[0]);
  const [fontSize, setFontSize] = useState(28);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState<"bg" | "font" | "color">("bg");

  const WIDTH = 1080;
  const HEIGHT = 1080;

  useEffect(() => {
    if (selectedBg.type === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setLoadedImage(img);
      img.onerror = () => setLoadedImage(null);
      img.src = selectedBg.value;
    } else {
      setLoadedImage(null);
    }
  }, [selectedBg]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    // Background
    if (selectedBg.type === "image" && loadedImage) {
      const scale = Math.max(WIDTH / loadedImage.width, HEIGHT / loadedImage.height);
      const x = (WIDTH - loadedImage.width * scale) / 2;
      const y = (HEIGHT - loadedImage.height * scale) / 2;
      ctx.drawImage(loadedImage, x, y, loadedImage.width * scale, loadedImage.height * scale);
      // Dark overlay
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      const { colors, angle } = parseGradient(selectedBg.value);
      const rad = (angle * Math.PI) / 180;
      const x1 = WIDTH / 2 - Math.cos(rad) * WIDTH / 2;
      const y1 = HEIGHT / 2 - Math.sin(rad) * HEIGHT / 2;
      const x2 = WIDTH / 2 + Math.cos(rad) * WIDTH / 2;
      const y2 = HEIGHT / 2 + Math.sin(rad) * HEIGHT / 2;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      colors.forEach((c, i) => grad.addColorStop(i / Math.max(colors.length - 1, 1), c));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Text settings
    const scaledFontSize = fontSize * 2;
    ctx.fillStyle = selectedColor.value;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw quote marks
    ctx.font = `italic ${scaledFontSize + 20}px ${selectedFont.family}`;
    ctx.globalAlpha = 0.3;
    ctx.fillText("\u201C", WIDTH / 2, HEIGHT * 0.2);
    ctx.globalAlpha = 1;

    // Wrap and draw verse text
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

    lines.forEach((line, i) => {
      ctx.fillText(line, WIDTH / 2, startY + i * lineHeight + lineHeight / 2);
    });

    // Reference
    ctx.font = `bold ${scaledFontSize * 0.65}px ${selectedFont.family}`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(`— ${reference}`, WIDTH / 2, startY + totalTextHeight + lineHeight);
    ctx.globalAlpha = 1;

    // Watermark
    ctx.font = `12px Inter, sans-serif`;
    ctx.globalAlpha = 0.4;
    ctx.fillText("Bíblia App", WIDTH / 2, HEIGHT - 40);
    ctx.globalAlpha = 1;
  }, [text, reference, selectedBg, selectedFont, selectedColor, fontSize, loadedImage]);

  useEffect(() => {
    if (open) drawCanvas();
  }, [open, drawCanvas]);

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
        const shareData = { files: [file], title: reference, text: `"${text}" — ${reference}` };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }
      // Fallback: download
      handleDownload();
    } catch {
      handleDownload();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-dark-bg border-b border-dark-card">
        <button onClick={onClose} className="p-2">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-sm font-bold">Criar Imagem</h2>
        <div className="flex gap-2">
          <button onClick={handleDownload} className="p-2 bg-dark-card rounded-full">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={handleShare} className="p-2 bg-primary rounded-full">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas preview */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full rounded-2xl shadow-2xl"
          style={{ width: "min(90vw, 400px)", height: "min(90vw, 400px)" }}
        />
      </div>

      {/* Customization panel */}
      <div className="bg-dark-bg border-t border-dark-card">
        {/* Tabs */}
        <div className="flex border-b border-dark-card">
          {[
            { key: "bg" as const, icon: ImageIcon, label: "Fundo" },
            { key: "font" as const, icon: Type, label: "Fonte" },
            { key: "color" as const, icon: Palette, label: "Cor" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                activeTab === key ? "text-primary border-b-2 border-primary" : "text-dark-muted"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 max-h-40 overflow-y-auto">
          {activeTab === "bg" && (
            <div className="grid grid-cols-5 gap-2">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => setSelectedBg(bg)}
                  className={`aspect-square rounded-xl overflow-hidden ring-2 transition-all ${
                    selectedBg.id === bg.id ? "ring-primary scale-95" : "ring-transparent"
                  }`}
                >
                  {bg.type === "gradient" ? (
                    <div className="w-full h-full" style={{ background: bg.value }} />
                  ) : (
                    <img src={bg.value} alt={bg.label} className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}

          {activeTab === "font" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {FONTS.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => setSelectedFont(font)}
                    className={`py-3 px-4 rounded-xl text-sm transition-all ${
                      selectedFont.id === font.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-dark-card text-dark-muted"
                    }`}
                    style={{ fontFamily: font.family }}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-dark-muted mb-1 block">
                  Tamanho: {fontSize}px
                </label>
                <input
                  type="range"
                  min={16}
                  max={48}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          )}

          {activeTab === "color" && (
            <div className="flex gap-3 justify-center">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setSelectedColor(color)}
                  className={`w-12 h-12 rounded-full ring-2 transition-all ${
                    selectedColor.id === color.id ? "ring-primary scale-110" : "ring-dark-card"
                  }`}
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerseImageGenerator;
