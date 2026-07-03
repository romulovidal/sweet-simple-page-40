import { useState, useCallback } from "react";
import { Link2, Loader2, X, BrainCircuit, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAIStream } from "@/hooks/useAIStream";
import ShareMenu from "@/components/ShareMenu";
import { useBackHandler } from "@/hooks/useBackHandler";

interface Props {
  reference: string;
  text: string;
  enabled: boolean;
  label?: string;
}

const AIConnections = ({ reference, text, enabled, label }: Props) => {
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { content, loading, run, reset } = useAIStream();
  useBackHandler(open, () => setOpen(false));

  const handleOpen = useCallback(() => {
    setOpen(true);
    reset();
    run("connections", reference, text);
  }, [reference, text, run, reset]);

  if (!enabled) return null;

  const shareText = `🔗 Conexões Bíblicas — ${reference}\n\n${content}\n\n— Bíblia do Atalaia\nhttps://biblia.atalaias.online`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Conexões Bíblicas — ${reference}`, text: shareText });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    setShareOpen(true);
  };

  return (
    <>
      <div className="flex flex-col items-center gap-1 shrink-0">
        <button
          onClick={handleOpen}
          data-tour="bible-action-connections"
          className="h-11 w-11 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 transition-all flex items-center justify-center"
          title="Conexões Bíblicas"
        >
          <Link2 className="w-[18px] h-[18px] text-emerald-400" />
        </button>
        {label && <span className="hidden lg:inline text-[10px] font-medium text-emerald-300/80">{label}</span>}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[80vh] rounded-t-[2rem] p-0 flex flex-col border-0 [&>button.absolute]:hidden"
          style={{ background: "linear-gradient(180deg, hsl(var(--dark-bg)) 0%, hsl(var(--dark-card) / 0.5) 100%)" }}
        >
          <SheetHeader className="relative px-5 pt-5 pb-4 flex-shrink-0">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[hsl(var(--dark-muted)/0.3)]" />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-[0_2px_12px_rgba(16,185,129,0.3)]">
                  <Link2 className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-[hsl(var(--dark-text))]">Conexões Bíblicas</SheetTitle>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium uppercase tracking-widest">Referências Cruzadas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {content && !loading && (
                  <button
                    onClick={handleShare}
                    className="p-2 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card)/0.8)] transition-colors"
                    title="Compartilhar"
                  >
                    <Share2 className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-2 rounded-xl bg-[hsl(var(--dark-card))]">
                  <X className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                </button>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-xs font-semibold text-emerald-400">{reference}</span>
            </div>
            <div className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-[hsl(var(--dark-muted)/0.2)] to-transparent" />
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {loading && !content && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <BrainCircuit className="w-8 h-8 text-emerald-500 animate-pulse" />
                <p className="text-sm text-[hsl(var(--dark-muted))]">Buscando conexões...</p>
              </div>
            )}
            {content && (
              <div className="prose prose-sm prose-invert max-w-none text-[hsl(var(--dark-text))] prose-headings:text-emerald-400 prose-strong:text-emerald-300 prose-p:text-[13px] prose-p:leading-relaxed prose-li:marker:text-emerald-500 prose-h2:border-b prose-h2:border-emerald-500/20 prose-h2:pb-2">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
            {loading && content && (
              <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 w-fit">
                <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                <span className="text-xs text-emerald-400">Escrevendo...</span>
              </div>
            )}
          </div>
          {!loading && content && (
            <div className="px-5 py-3 border-t border-[hsl(var(--dark-muted)/0.1)] flex-shrink-0">
              <p className="text-[10px] text-center text-[hsl(var(--dark-muted)/0.5)]">
                ✨ Conexões Bíblicas • Bíblia do Atalaia
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ShareMenu text={shareText} open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
};

export default AIConnections;
