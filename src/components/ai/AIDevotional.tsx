import { useState, useCallback } from "react";
import { Heart, Loader2, Sparkles, X, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useAIStream } from "@/hooks/useAIStream";

interface Props {
  verseRef: string;
  verseText: string;
  enabled: boolean;
}

const AIDevotional = ({ verseRef, verseText, enabled }: Props) => {
  const [open, setOpen] = useState(false);
  const { content, loading, run, reset } = useAIStream();
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(() => {
    setOpen(true);
    reset();
    run("devotional", verseRef, verseText);
  }, [verseRef, verseText, run, reset]);

  const handleCopy = useCallback(async () => {
    try {
      const textWithLink = `${content}\n\n📖 Bíblia do Atalaia — https://biblia.atalaias.online`;
      await navigator.clipboard.writeText(textWithLink);
      setCopied(true);
      toast.success("Reflexão copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  }, [content]);

  if (!enabled) return null;

  return (
    <>
      <button
        onClick={handleGenerate}
        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 transition-all hover:from-purple-500/15 hover:to-pink-500/15 active:scale-[0.98]"
      >
        <Sparkles className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-semibold text-purple-400">Reflexão Devocional</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[90vh] rounded-t-[2rem] p-0 flex flex-col border-0 overflow-hidden"
          style={{
            background: "linear-gradient(180deg, hsl(var(--dark-bg)) 0%, hsl(var(--dark-card) / 0.5) 100%)",
          }}
        >
          {/* Header */}
          <SheetHeader className="relative px-5 pt-5 pb-4 flex-shrink-0">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[hsl(var(--dark-muted)/0.3)]" />

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-400 via-purple-500 to-pink-600 flex items-center justify-center shadow-[0_2px_12px_rgba(168,85,247,0.3)]">
                  <Heart className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-[hsl(var(--dark-text))] tracking-tight">
                    Reflexão Devocional
                  </SheetTitle>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium uppercase tracking-widest">
                    Inteligência Artificial
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {content && !loading && (
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card)/0.8)] transition-colors"
                    title="Copiar reflexão"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card)/0.8)] transition-colors"
                >
                  <X className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                </button>
              </div>
            </div>

            {/* Reference pill */}
            <div className="mt-3 flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                <Sparkles className="w-3 h-3 text-purple-500" />
                <span className="text-xs font-semibold text-purple-400">{verseRef}</span>
              </div>
            </div>

            <div className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-[hsl(var(--dark-muted)/0.2)] to-transparent" />
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {loading && !content && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400/20 to-pink-500/20 flex items-center justify-center">
                    <Heart className="w-8 h-8 text-purple-500 animate-pulse" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 text-white animate-spin" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-[hsl(var(--dark-text))]">Preparando reflexão...</p>
                  <p className="text-xs text-[hsl(var(--dark-muted))]">Meditação e aplicação prática</p>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {content && (
              <div className="prose prose-sm prose-invert max-w-none 
                text-[hsl(var(--dark-text))]
                prose-headings:text-purple-400 prose-headings:font-bold prose-headings:tracking-tight
                prose-h2:text-base prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-purple-500/20
                prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-2
                prose-strong:text-purple-300 prose-strong:font-semibold
                prose-em:text-[hsl(var(--dark-muted))] prose-em:not-italic prose-em:text-xs prose-em:bg-[hsl(var(--dark-card))] prose-em:px-1.5 prose-em:py-0.5 prose-em:rounded
                prose-li:marker:text-purple-500
                prose-blockquote:border-l-purple-500/40 prose-blockquote:bg-purple-500/5 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4
                prose-p:leading-relaxed prose-p:text-[13px]
              ">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}

            {loading && content && (
              <div className="flex items-center gap-2.5 mt-6 mb-2 px-3 py-2.5 rounded-xl bg-purple-500/5 border border-purple-500/10 w-fit">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                <span className="text-xs font-medium text-purple-400">Escrevendo...</span>
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && content && (
            <div className="px-5 py-3 border-t border-[hsl(var(--dark-muted)/0.1)] flex-shrink-0">
              <p className="text-[10px] text-center text-[hsl(var(--dark-muted)/0.5)]">
                ✨ Reflexão Devocional • Bíblia do Atalaia com IA
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AIDevotional;
