import { useState, useCallback } from "react";
import { BookOpen, Loader2, ChevronDown, ChevronUp, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { aiSanitizeSchema } from "../../lib/markdownSanitize";
import { aiMarkdownComponents, normalizeAiMarkdown } from "../../lib/aiMarkdown";
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="mx-5 mb-4">
      <button
        onClick={handleToggle}
        data-tour="bible-chapter-summary"
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
              <div className="prose prose-sm prose-invert max-w-none text-[hsl(var(--dark-text))] prose-headings:text-blue-400 prose-strong:text-blue-300 prose-p:text-sm prose-p:leading-[1.8] prose-p:my-4 prose-table:w-full prose-table:min-w-[540px] prose-table:border prose-table:border-white/15 prose-tr:even:bg-white/[0.02] prose-table:text-[13px] prose-th:bg-blue-500/10 prose-th:text-blue-300 prose-th:px-3 prose-th:py-3 prose-th:border prose-th:border-white/15 prose-td:px-3 prose-td:py-3 prose-td:border prose-td:border-white/15 prose-hr:my-8 prose-hr:border-white/10 prose-ul:my-4 prose-ol:my-4 prose-li:my-2 prose-table:my-6 prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-blue-500/20 prose-blockquote:border-l-blue-500/40 prose-blockquote:bg-blue-500/5 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-mark:bg-blue-400/25 prose-mark:text-blue-100 prose-mark:px-1 prose-mark:rounded">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw, [rehypeSanitize, aiSanitizeSchema]]} components={aiMarkdownComponents}>{normalizeAiMarkdown(content)}</ReactMarkdown>
              </div>
              {!loading && (
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={handleCopy}
                    className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400 hover:bg-blue-500/15 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Copiar
                  </button>
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
