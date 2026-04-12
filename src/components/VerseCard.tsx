import { Share2, ImageIcon, BookOpen, Palette, ChevronDown } from "lucide-react";
import { useState } from "react";
import ShareMenu from "@/components/ShareMenu";
import { useNavigate } from "react-router-dom";
import { useLocalStorage, type HighlightedVerse, type SavedVerse } from "@/hooks/useLocalStorage";
import VerseImageGenerator from "@/components/VerseImageGenerator";
import { toast } from "sonner";

const HIGHLIGHT_COLORS = [
  { name: "Amarelo", value: "#fbbf24" },
  { name: "Verde", value: "#34d399" },
  { name: "Azul", value: "#60a5fa" },
  { name: "Rosa", value: "#f472b6" },
  { name: "Roxo", value: "#a78bfa" },
  { name: "Laranja", value: "#fb923c" },
];

interface VerseCardProps {
  text: string;
  reference: string;
}

function parseReference(ref: string): { book: string; chapter: number; verse: number } | null {
  // e.g. "Gênesis 1:3" or "1 João 3:16"
  const match = ref.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (!match) return null;
  return { book: match[1], chapter: parseInt(match[2]), verse: parseInt(match[3]) };
}

// Map Portuguese book names to API abbreviations
const bookNameToAbbrev: Record<string, string> = {
  "Gênesis": "gn", "Êxodo": "ex", "Levítico": "lv", "Números": "nm", "Deuteronômio": "dt",
  "Josué": "js", "Juízes": "jz", "Rute": "rt", "1 Samuel": "1sm", "2 Samuel": "2sm",
  "1 Reis": "1rs", "2 Reis": "2rs", "1 Crônicas": "1cr", "2 Crônicas": "2cr",
  "Esdras": "ed", "Neemias": "ne", "Ester": "et", "Jó": "job", "Salmos": "sl",
  "Provérbios": "pv", "Eclesiastes": "ec", "Cânticos": "ct", "Isaías": "is",
  "Jeremias": "jr", "Lamentações": "lm", "Ezequiel": "ez", "Daniel": "dn",
  "Oséias": "os", "Joel": "jl", "Amós": "am", "Obadias": "ob", "Jonas": "jn",
  "Miquéias": "mq", "Naum": "na", "Habacuque": "hc", "Sofonias": "sf",
  "Ageu": "ag", "Zacarias": "zc", "Malaquias": "ml",
  "Mateus": "mt", "Marcos": "mc", "Lucas": "lc", "João": "jo",
  "Atos": "at", "Romanos": "rm", "1 Coríntios": "1co", "2 Coríntios": "2co",
  "Gálatas": "gl", "Efésios": "ef", "Filipenses": "fp", "Colossenses": "cl",
  "1 Tessalonicenses": "1ts", "2 Tessalonicenses": "2ts",
  "1 Timóteo": "1tm", "2 Timóteo": "2tm", "Tito": "tt", "Filemom": "fm",
  "Hebreus": "hb", "Tiago": "tg", "1 Pedro": "1pe", "2 Pedro": "2pe",
  "1 João": "1jo", "2 João": "2jo", "3 João": "3jo", "Judas": "jd", "Apocalipse": "ap",
};

const VerseCard = ({ text, reference }: VerseCardProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareText, setShareText] = useState("");
  const [showImageGen, setShowImageGen] = useState(false);
  const [highlights, setHighlights] = useLocalStorage<HighlightedVerse[]>("highlighted-verses", []);
  const [savedVerses, setSavedVerses] = useLocalStorage<SavedVerse[]>("saved-verses", []);

  const currentHighlight = highlights.find((h) => h.reference === reference);

  const handleHighlight = (color: string) => {
    setHighlights((prev) => {
      const filtered = prev.filter((h) => h.reference !== reference);
      return [...filtered, { reference, color }];
    });
    // Also save to saved verses
    setSavedVerses((prev) => {
      if (prev.some((v) => v.reference === reference)) {
        return prev.map((v) => v.reference === reference ? { ...v, highlightColor: color } : v);
      }
      return [{ text, reference, savedAt: new Date().toISOString(), highlightColor: color }, ...prev];
    });
    setShowColors(false);
    toast.success("Versículo destacado!");
  };

  const handleShare = async () => {
    const text_ = `${reference}\n\n"${text}"\n\n📖 Leia na Bíblia`;
    try {
      if (navigator.share) {
        await navigator.share({ title: reference, text: text_ });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    setShareText(text_);
    setShowShareMenu(true);
  };

  const handleViewContext = () => {
    const parsed = parseReference(reference);
    if (!parsed) return;
    const abbrev = bookNameToAbbrev[parsed.book];
    if (abbrev) {
      navigate(`/biblia?book=${abbrev}&chapter=${parsed.chapter}&verse=${parsed.verse}`);
    }
  };

  return (
    <>
      <div
        className="bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] rounded-2xl p-6 text-white cursor-pointer transition-all"
        onClick={() => setExpanded(!expanded)}
        style={currentHighlight ? { borderLeft: `4px solid ${currentHighlight.color}` } : undefined}
      >
        <p className="text-base leading-relaxed mb-4 font-light">"{text}"</p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold opacity-90">{reference}</p>
          <ChevronDown className={`w-4 h-4 opacity-60 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-white/20 space-y-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowColors(!showColors)}
              className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-white/10 transition-colors text-left"
            >
              <Palette className="w-4 h-4" />
              <span className="text-sm font-medium">Destacar</span>
            </button>

            {showColors && (
              <div className="flex gap-2 pl-8 pb-2">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleHighlight(c.value)}
                    className="w-7 h-7 rounded-full border-2 border-white/30 transition-transform active:scale-90"
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            )}

            <button
              onClick={handleShare}
              className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-white/10 transition-colors text-left"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-sm font-medium">Compartilhar</span>
            </button>

            <button
              onClick={() => setShowImageGen(true)}
              className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-white/10 transition-colors text-left"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Criar imagem</span>
            </button>

            <button
              onClick={handleViewContext}
              className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-white/10 transition-colors text-left"
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-sm font-medium">Ver contexto</span>
            </button>
          </div>
        )}
      </div>

      {showImageGen && (
        <VerseImageGenerator
          text={text}
          reference={reference}
          open={showImageGen}
          onClose={() => setShowImageGen(false)}
        />
      )}
      <ShareMenu text={shareText} open={showShareMenu} onClose={() => setShowShareMenu(false)} />
    </>
  );
};

export default VerseCard;
