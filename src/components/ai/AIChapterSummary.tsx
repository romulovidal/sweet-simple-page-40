import { useState, useCallback } from "react";
import { BookOpen, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAIStream } from "@/hooks/useAIStream";

interface Props {
  bookName: string;
  chapter: number;
  text: string;
  enabled: boolean;
}

const AIChapterSummary = ({ bookName, chapter, text, enabled }: Props) => {
  const [open, setOpen] = useState(false);
  const { content, loading, run, reset } = useAIStream();

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
            <div className="prose prose-sm prose-invert max-w-none text-[hsl(var(--dark-text))] prose-headings:text-blue-400 prose-strong:text-blue-300 prose-p:text-[13px] prose-p:leading-relaxed">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIChapterSummary;
