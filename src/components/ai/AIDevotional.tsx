import { useState, useCallback } from "react";
import { Heart, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAIStream } from "@/hooks/useAIStream";

interface Props {
  verseRef: string;
  verseText: string;
  enabled: boolean;
}

const AIDevotional = ({ verseRef, verseText, enabled }: Props) => {
  const [generated, setGenerated] = useState(false);
  const { content, loading, run } = useAIStream();

  const handleGenerate = useCallback(() => {
    if (generated) return;
    setGenerated(true);
    run("devotional", verseRef, verseText);
  }, [generated, verseRef, verseText, run]);

  if (!enabled) return null;

  return (
    <div className="mt-4">
      {!generated ? (
        <button
          onClick={handleGenerate}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 transition-all hover:from-purple-500/15 hover:to-pink-500/15 active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-purple-400">Reflexão Devocional com IA</span>
        </button>
      ) : (
        <div className="rounded-xl bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/15 p-4 animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Reflexão Devocional</span>
          </div>
          {loading && !content && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-xs text-[hsl(var(--dark-muted))]">Preparando reflexão...</span>
            </div>
          )}
          {content && (
            <div className="prose prose-sm prose-invert max-w-none text-[hsl(var(--dark-text))] prose-p:text-[13px] prose-p:leading-relaxed prose-strong:text-purple-300">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
          {loading && content && (
            <div className="flex items-center gap-2 mt-2">
              <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
              <span className="text-[10px] text-purple-400">Escrevendo...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIDevotional;
