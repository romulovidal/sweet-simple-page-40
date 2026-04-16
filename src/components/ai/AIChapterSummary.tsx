import { useState, useCallback } from "react";
import { BookOpen, Loader2, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAIStream } from "@/hooks/useAIStream";
import ShareMenu from "@/components/ShareMenu";
import { useBackHandler } from "@/hooks/useBackHandler";

interface Props {
  bookName: string;
  chapter: number;
  text: string;
  enabled: boolean;
}

const AIChapterSummary = ({ bookName, chapter, text, enabled }: Props) => {
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { content, loading, run, reset } = useAIStream();
  useBackHandler(open, () => { setOpen(false); reset(); });

  const handleToggle = useCallback(() => {
    if (open) {
      setOpen(false);
      reset();
      return;
    }
    setOpen(true);
    run("summary", `${bookName} ${chapter}`, text);
  }, [open, bookName, chapter, text, run, reset]);

  if (!enabled) return null;

  const shareText = `📖 Resumo de ${bookName} ${chapter}\n\n${content}\n\n— Bíblia do Atalaia\nhttps://biblia.atalaias.online`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Resumo de ${bookName} ${chapter}`, text: shareText });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    setShareOpen(true);
  };

  return (
    <div className="mx-5 mb-4">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 transition-colors hover:bg-blue-500/15"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-blue-400">Resumo do Capítulo</span>
          {loading && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
      </button>

      {open && (
        <div className="mt-2 px-4 py-3 rounded-xl bg-[hsl(var(--dark-card))] border border-blue-500/10 animate-fade-up">
          {loading && !content && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-xs text-[hsl(var(--dark-muted))]">Gerando resumo...</span>
            </div>
          )}
          {content && (
            <>
              <div className="prose prose-sm prose-invert max-w-none text-[hsl(var(--dark-text))] prose-headings:text-blue-400 prose-strong:text-blue-300 prose-p:text-[13px] prose-p:leading-relaxed">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
              {!loading && (
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400 hover:bg-blue-500/15 transition-colors"
                  >
                    <Share2 className="w-3 h-3" />
                    Compartilhar
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ShareMenu text={shareText} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
};

export default AIChapterSummary;
