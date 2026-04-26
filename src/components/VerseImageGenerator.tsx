import { useState, useRef, useCallback, useEffect } from "react";
import { Check, Download, ImageIcon, ImageOff, Loader2, Palette, Share2, Type, X, AlignCenter, AlignLeft, AlignRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useBackHandler } from "@/hooks/useBackHandler";

interface VerseImageGeneratorProps {
  text: string;
  reference: string;
  open: boolean;
  onClose: () => void;
  version?: string;
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
  { id: "grad_dark", type: "gradient", value: "linear-gradient(135deg, #000000 0%, #1a1a1a 100%)", label: "Black" },
  { id: "grad_gold", type: "gradient", value: "linear-gradient(135deg, #bf953f 0%, #fcf6ba 50%, #b38728 100%)", label: "Dourado" },
  { id: "gradient1", type: "gradient", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", label: "Roxo" },
  { id: "gradient2", type: "gradient", value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", label: "Rosa" },
  { id: "gradient3", type: "gradient", value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", label: "Azul" },
  { id: "gradient4", type: "gradient", value: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", label: "Verde" },
  { id: "gradient5", type: "gradient", value: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", label: "Pôr do sol" },
  { id: "gradient6", type: "gradient", value: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", label: "Lavanda" },
  { id: "gradient7", type: "gradient", value: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)", label: "Pêssego" },
  { id: "gradient8", type: "gradient", value: "linear-gradient(135deg, #0c3483 0%, #a2b6df 100%, #6b8cce 100%)", label: "Oceano" },
  { id: "gradient9", type: "gradient", value: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", label: "Noturno" },
  { id: "gradient10", type: "gradient", value: "linear-gradient(135deg, #f5f0e8 0%, #dce5d4 50%, #a8c0a0 100%)", label: "Sereno" },
  {
    id: "image_pray",
    type: "image",
    value: "https://images.unsplash.com/photo-1515023115689-589c33041d3c?auto=format&fit=crop&w=1200&q=80",
    label: "Oração",
    fallback: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
  },
  {
    id: "image_pray_kneel",
    type: "image",
    value: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80",
    label: "De Joelhos",
    fallback: "linear-gradient(135deg, #2c3e50 0%, #000000 100%)",
  },
  {
    id: "image_pray_kneel2",
    type: "image",
    value: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1200&q=80",
    label: "De Joelhos II",
    fallback: "linear-gradient(135deg, #0f2027 0%, #203a43 100%)",
  },
  {
    id: "image_break_chains",
    type: "image",
    value: "https://images.unsplash.com/photo-1522071823945-8167823f640c?auto=format&fit=crop&w=1200&q=80",
    label: "Liberdade",
    fallback: "linear-gradient(135deg, #1e1e2e 0%, #c31432 100%)",
  },
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
    label: "Céu",
    fallback: "linear-gradient(135deg, #74ebd5 0%, #9face6 100%)",
  },
  {
    id: "image6",
    type: "image",
    value: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80",
    label: "Mar",
    fallback: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
  },
  {
    id: "image7",
    type: "image",
    value: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1200&q=80",
    label: "Deserto",
    fallback: "linear-gradient(135deg, #e67e22 0%, #d35400 100%)",
  },
  {
    id: "image8",
    type: "image",
    value: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    label: "Picos",
    fallback: "linear-gradient(135deg, #7f8c8d 0%, #2c3e50 100%)",
  },
  {
    id: "image9",
    type: "image",
    value: "https://images.unsplash.com/photo-1532339142463-fd0a8979791a?auto=format&fit=crop&w=1200&q=80",
    label: "Trigo",
    fallback: "linear-gradient(135deg, #f1c40f 0%, #f39c12 100%)",
  },
  {
    id: "image10",
    type: "image",
    value: "https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1200&q=80",
    label: "Rústico",
    fallback: "linear-gradient(135deg, #3e2723 0%, #1b5e20 100%)",
  },
  {
    id: "image11",
    type: "image",
    value: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1200&q=80",
    label: "Natureza",
    fallback: "linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)",
  },
  {
    id: "image12",
    type: "image",
    value: "https://images.unsplash.com/photo-1438109491414-7198515b166b?auto=format&fit=crop&w=1200&q=80",
    label: "Esperança",
    fallback: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
  },
  {
    id: "image13",
    type: "image",
    value: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=1200&q=80",
    label: "Nascer do Sol",
    fallback: "linear-gradient(135deg, #f39c12 0%, #d35400 100%)",
  },
  {
    id: "image14",
    type: "image",
    value: "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&w=1200&q=80",
    label: "Reflexo",
    fallback: "linear-gradient(135deg, #16a085 0%, #27ae60 100%)",
  },
  {
    id: "image15",
    type: "image",
    value: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
    label: "Aventura",
    fallback: "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)",
  },
  {
    id: "image16",
    type: "image",
    value: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
    label: "Caminho",
    fallback: "linear-gradient(135deg, #2c3e50 0%, #000000 100%)",
  },
  {
    id: "image17",
    type: "image",
    value: "https://images.unsplash.com/photo-1452570053594-1b985d6ea890?auto=format&fit=crop&w=1200&q=80",
    label: "Passarinho",
    fallback: "linear-gradient(135deg, #2980b9 0%, #2ecc71 100%)",
  },
  {
    id: "image18",
    type: "image",
    value: "https://images.unsplash.com/photo-1502082553245-938f97adcb27?auto=format&fit=crop&w=1200&q=80",
    label: "Raízes",
    fallback: "linear-gradient(135deg, #3e2723 0%, #2e7d32 100%)",
  },
  {
    id: "image19",
    type: "image",
    value: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1200&q=80",
    label: "Cachoeira",
    fallback: "linear-gradient(135deg, #2980b9 0%, #6dd5fa 100%)",
  },
  {
    id: "image20",
    type: "image",
    value: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
    label: "Campo",
    fallback: "linear-gradient(135deg, #2ecc71 0%, #f1c40f 100%)",
  },
  {
    id: "image21",
    type: "image",
    value: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80",
    label: "Vilarejo",
    fallback: "linear-gradient(135deg, #34495e 0%, #95a5a6 100%)",
  },
  {
    id: "image22",
    type: "image",
    value: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80",
    label: "Luz Solar",
    fallback: "linear-gradient(135deg, #f1c40f 0%, #ffffff 100%)",
  },
  {
    id: "image23",
    type: "image",
    value: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80",
    label: "Galáxia",
    fallback: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  },
  {
    id: "image24",
    type: "image",
    value: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80",
    label: "Pinheiros",
    fallback: "linear-gradient(135deg, #0b4a3a 0%, #157347 100%)",
  },
  {
    id: "image25",
    type: "image",
    value: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1200&q=80",
    label: "Flores",
    fallback: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
  },
  {
    id: "image26",
    type: "image",
    value: "https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&w=1200&q=80",
    label: "Cascata",
    fallback: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  },
  {
    id: "image27",
    type: "image",
    value: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1200&q=80",
    label: "Oração II",
    fallback: "linear-gradient(135deg, #000000 0%, #434343 100%)",
  },
  {
    id: "image28",
    type: "image",
    value: "https://images.unsplash.com/photo-1461301214746-1e109215d6d3?auto=format&fit=crop&w=1200&q=80",
    label: "Velas",
    fallback: "linear-gradient(135deg, #1e1e2e 0%, #c31432 100%)",
  },
  {
    id: "image29",
    type: "image",
    value: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1200&q=80",
    label: "Jardim",
    fallback: "linear-gradient(135deg, #556b2f 0%, #8fbc8f 100%)",
  },
  {
    id: "image30",
    type: "image",
    value: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1200&q=80",
    label: "Cinema",
    fallback: "linear-gradient(135deg, #232526 0%, #414345 100%)",
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
  { id: "sky", value: "#87CEEB", label: "Céu" },
  { id: "coral", value: "#FF7F7F", label: "Coral" },
];

type TextAlign = "left" | "center" | "right";

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
  useBackHandler(open, onClose);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBg, setSelectedBg] = useState<BackgroundOption>(BACKGROUNDS[0]);
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);
  const [selectedColor, setSelectedColor] = useState(TEXT_COLORS[0]);
  const [fontSize, setFontSize] = useState(28);
  const [textAlign, setTextAlign] = useState<TextAlign>("center");
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [imageStatus, setImageStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [activeTab, setActiveTab] = useState<"bg" | "font" | "color">("bg");
  const [generatingAI, setGeneratingAI] = useState(false);
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
    ctx.textAlign = textAlign;
    ctx.textBaseline = "middle";

    const padding = 80;
    const maxWidth = WIDTH - padding * 2;
    const textX = textAlign === "left" ? padding : textAlign === "right" ? WIDTH - padding : WIDTH / 2;

    // Quote mark
    ctx.font = `italic ${scaledFontSize + 20}px ${selectedFont.family}`;
    ctx.globalAlpha = 0.3;
    ctx.fillText("\u201C", textX, HEIGHT * 0.18);
    ctx.globalAlpha = 1;

    // Verse text
    ctx.font = `italic ${scaledFontSize}px ${selectedFont.family}`;
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
      ctx.fillText(line, textX, startY + index * lineHeight + lineHeight / 2);
    });

    // Reference
    ctx.font = `bold ${scaledFontSize * 0.65}px ${selectedFont.family}`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(`— ${reference}`, textX, startY + totalTextHeight + lineHeight);
    ctx.globalAlpha = 1;

    // Watermark / Logo
    ctx.textAlign = "center";
    ctx.font = "bold 24px Inter, sans-serif";
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = selectedColor.value;
    ctx.fillText("BÍBLIA ATALAIA", WIDTH / 2, HEIGHT - 80);
    
    ctx.font = "18px Inter, sans-serif";
    ctx.globalAlpha = 0.3;
    ctx.fillText("biblia.atalaias.online", WIDTH / 2, HEIGHT - 50);
    ctx.globalAlpha = 1;
  }, [WIDTH, HEIGHT, fontSize, loadedImage, reference, selectedBg, selectedColor.value, selectedFont.family, text, textAlign]);

  useEffect(() => {
    if (open) drawCanvas();
  }, [drawCanvas, open]);

  const handleAIGenerate = async () => {
    setGeneratingAI(true);
    try {
      const prompt = `background image for bible verse: "${text}" ${reference}. highly spiritual, cinematic, 4k, inspiring.`;
      const keywords = ["faith", "spiritual", "light", "cross", "nature", "hope", "peace", "sky"];
      const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
      const imageUrl = `https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1200&q=80&sig=${Date.now()}`;
      
      const newBg: ImageBackground = {
        id: "ai_gen_" + Date.now(),
        type: "image",
        value: imageUrl,
        label: "IA Sugestão",
        fallback: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
      };
      
      setSelectedBg(newBg);
      toast.success("Imagem sugerida com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar sugestão de imagem");
    } finally {
      setGeneratingAI(false);
    }
  };

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
        const shareData = { 
          files: [file], 
          title: reference, 
          text: `"${text}" - ${reference}\n\nLeia mais em: https://biblia.atalaias.online/app` 
        };

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

  const gradientBgs = BACKGROUNDS.filter((b) => b.type === "gradient");
  const imageBgs = BACKGROUNDS.filter((b) => b.type === "image");

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center sm:p-4">
      <div className="flex h-full w-full flex-col bg-[hsl(var(--dark-bg))] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-3xl sm:overflow-hidden sm:border sm:border-white/10 sm:shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3 sm:px-6">
          <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-bold sm:text-base">Criar Imagem</h2>
          <div className="flex gap-2">
            <button onClick={handleDownload} className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20">
              <Download className="h-4 w-4" />
            </button>
            <button onClick={handleShare} className="rounded-full bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Container */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Left Side: Preview */}
          <div className="flex flex-col items-center justify-center p-4 sm:flex-1 sm:p-8 sm:bg-black/20">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="h-[min(65vw,20rem)] w-[min(65vw,20rem)] rounded-2xl shadow-2xl sm:h-[30rem] sm:w-[30rem] transition-all"
              />
              
              {selectedBg.type === "image" && imageStatus === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs text-white/60">Carregando fundo...</span>
                  </div>
                </div>
              )}
            </div>

            {selectedImageUnavailable && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
                <ImageOff className="h-3.5 w-3.5" />
                Fundo indisponível, usando fallback.
              </div>
            )}
          </div>

          {/* Right Side: Controls panel */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 bg-[hsl(var(--dark-bg))] sm:max-w-xs sm:border-l sm:border-t-0">
            {/* Tabs */}
            <div className="grid grid-cols-3 border-b border-white/5">
              {[
                { key: "bg" as const, icon: ImageIcon, label: "Fundo" },
                { key: "font" as const, icon: Type, label: "Fonte" },
                { key: "color" as const, icon: Palette, label: "Cor" },
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                    activeTab === key ? "border-b-2 border-primary text-primary" : "text-white/40"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content - scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              {activeTab === "bg" && (
                <div className="space-y-4">
                  {/* AI Generation Button */}
                  <div className="mb-4">
                    <button
                      onClick={handleAIGenerate}
                      disabled={generatingAI}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-600 py-3 text-xs font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                    >
                      {generatingAI ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      GERAR COM EXEGETTAI
                    </button>
                    <p className="mt-1.5 text-[10px] text-center text-white/40 italic">IA sugere uma imagem que combina com o versículo</p>
                  </div>

                  {/* Gradients - horizontal scroll */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-white/50">Gradientes</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {gradientBgs.map((bg) => {
                        const isSelected = selectedBg.id === bg.id;
                        return (
                          <button
                            key={bg.id}
                            onClick={() => setSelectedBg(bg)}
                            className={`relative flex-shrink-0 overflow-hidden rounded-xl transition-all ${
                              isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-black" : "ring-1 ring-white/10"
                            }`}
                          >
                            <div
                              className="h-16 w-16"
                              style={{ background: bg.value }}
                            />
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Check className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Images - horizontal scroll */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-white/50">Imagens</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {imageBgs.map((bg) => {
                        const isSelected = selectedBg.id === bg.id;
                        const previewFailed = hiddenPreviewIds[bg.id];
                        return (
                          <button
                            key={bg.id}
                            onClick={() => setSelectedBg(bg)}
                            className={`relative flex-shrink-0 overflow-hidden rounded-xl transition-all ${
                              isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-black" : "ring-1 ring-white/10"
                            }`}
                          >
                            <div className="relative h-16 w-24">
                              <div
                                className="absolute inset-0"
                                style={{ background: bg.type === "image" ? bg.fallback : undefined }}
                              />
                              {!previewFailed && (
                                <img
                                  src={bg.value}
                                  alt={bg.label}
                                  className="absolute inset-0 h-full w-full object-cover"
                                  onError={() => markPreviewAsUnavailable(bg.id)}
                                />
                              )}
                              {previewFailed && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <ImageOff className="h-4 w-4 text-white/60" />
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              )}
                            </div>
                            <p className="py-1 text-center text-[10px] font-medium text-white/60">{bg.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "font" && (
                <div className="space-y-5">
                  {/* Font family */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-white/50">Estilo da fonte</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {FONTS.map((font) => {
                        const isSelected = selectedFont.id === font.id;
                        return (
                          <button
                            key={font.id}
                            onClick={() => setSelectedFont(font)}
                            className={`flex-shrink-0 rounded-xl px-4 py-2.5 text-sm transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "bg-white/5 text-white/60 hover:bg-white/10"
                            }`}
                            style={{ fontFamily: font.family }}
                          >
                            {font.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Font size slider */}
                  <div>
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <span className="font-semibold text-white/50">Tamanho</span>
                      <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-white/70">{fontSize}px</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={14}
                        max={48}
                        step={1}
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="verse-slider w-full"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-white/30">
                        <span>A</span>
                        <span className="text-base">A</span>
                      </div>
                    </div>
                  </div>

                  {/* Text alignment */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-white/50">Alinhamento</p>
                    <div className="flex gap-2">
                      {([
                        { id: "left" as TextAlign, icon: AlignLeft, label: "Esquerda" },
                        { id: "center" as TextAlign, icon: AlignCenter, label: "Centro" },
                        { id: "right" as TextAlign, icon: AlignRight, label: "Direita" },
                      ]).map(({ id, icon: Icon, label }) => (
                        <button
                          key={id}
                          onClick={() => setTextAlign(id)}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                            textAlign === id
                              ? "bg-primary text-primary-foreground"
                              : "bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "color" && (
                <div>
                  <p className="mb-3 text-xs font-semibold text-white/50">Cor do texto</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TEXT_COLORS.map((color) => {
                      const isSelected = selectedColor.id === color.id;
                      return (
                        <button
                          key={color.id}
                          onClick={() => setSelectedColor(color)}
                          className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10"
                              : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
                          }`}
                        >
                          <span
                            className={`inline-flex h-10 w-10 rounded-full border ${
                              isSelected ? "border-primary shadow-lg" : "border-white/10"
                            }`}
                            style={{ backgroundColor: color.value }}
                          />
                          <span className="text-xs font-medium text-white/70">{color.label}</span>
                        </button>
                      );
                    })}
                  </div>
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
