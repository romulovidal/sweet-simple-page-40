import { useState, useCallback } from "react";
import { Sparkles, X, Loader2, BrainCircuit, BookOpen, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import ShareMenu from "@/components/ShareMenu";

interface ExegetAIProps {
  reference: string;
  text: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exegetai`;

const ExegetAI = ({ reference, text }: ExegetAIProps) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const runExegesis = useCallback(async () => {
    setOpen(true);
    setContent("");
    setLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ reference, text }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro ao gerar exegese");
        setLoading(false);
        return;
      }

      if (!resp.body) {
        toast.error("Streaming não suportado");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("ExegetAI error:", e);
      toast.error("Erro ao conectar com a IA");
    } finally {
      setLoading(false);
    }
  }, [reference, text]);

  const shareText = `${content}\n\n📖 Bíblia do Atalaia — https://biblia.atalaias.online`;

  return (
    <>
      <button
        onClick={runExegesis}
        className="fixed bottom-24 right-5 z-30 group"
        title="ExegettAI — Exegese com IA"
      >
        <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-[0_4px_20px_rgba(245,158,11,0.4)] active:scale-90 transition-all duration-200">
          <Sparkles className="w-5 h-5 text-white" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
        </div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[90vh] rounded-t-[2rem] p-0 flex flex-col border-0 overflow-hidden"
          style={{ background: "linear-gradient(180deg, hsl(var(--dark-bg)) 0%, hsl(var(--dark-card) / 0.5) 100%)" }}
        >
          <SheetHeader className="relative px-5 pt-5 pb-4 flex-shrink-0">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[hsl(var(--dark-muted)/0.3)]" />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-[0_2px_12px_rgba(245,158,11,0.3)]">
                  <BrainCircuit className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-[hsl(var(--dark-text))] tracking-tight">ExegettAI</SheetTitle>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium uppercase tracking-widest">Exegese Inteligente</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {content && !loading && (
                  <button
                    onClick={() => setShareOpen(true)}
                    className="p-2 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card)/0.8)] transition-colors"
                    title="Compartilhar"
                  >
                    <Share2 className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-2 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card)/0.8)] transition-colors">
                  <X className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <BookOpen className="w-3 h-3 text-amber-500" />
                <span className="text-xs font-semibold text-amber-400">{reference}</span>
              </div>
            </div>
            <div className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-[hsl(var(--dark-muted)/0.2)] to-transparent" />
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {loading && !content && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center">
                    <BrainCircuit className="w-8 h-8 text-amber-500 animate-pulse" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 text-white animate-spin" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-[hsl(var(--dark-text))]">Analisando o texto...</p>
                  <p className="text-xs text-[hsl(var(--dark-muted))]">Contexto histórico, cultural e linguístico</p>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            {content && (
              <div className="exegetai-content prose prose-sm prose-invert max-w-none text-[hsl(var(--dark-text))] prose-headings:text-amber-400 prose-headings:font-bold prose-headings:tracking-tight prose-h2:text-base prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-amber-500/20 prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-2 prose-strong:text-amber-300 prose-strong:font-semibold prose-em:text-[hsl(var(--dark-muted))] prose-em:not-italic prose-em:text-xs prose-em:bg-[hsl(var(--dark-card))] prose-em:px-1.5 prose-em:py-0.5 prose-em:rounded prose-li:marker:text-amber-500 prose-blockquote:border-l-amber-500/40 prose-blockquote:bg-amber-500/5 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-code:text-amber-300 prose-code:bg-[hsl(var(--dark-card))] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-normal prose-a:text-amber-400 prose-a:no-underline prose-a:hover:underline prose-p:leading-relaxed prose-p:text-[13px]">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
            {loading && content && (
              <div className="flex items-center gap-2.5 mt-6 mb-2 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10 w-fit">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span className="text-xs font-medium text-amber-400">Escrevendo...</span>
              </div>
            )}
          </div>

          {!loading && content && (
            <div className="px-5 py-3 border-t border-[hsl(var(--dark-muted)/0.1)] flex-shrink-0">
              <p className="text-[10px] text-center text-[hsl(var(--dark-muted)/0.5)]">
                ✨ Gerado por ExegettAI • Especialista em Exegese Bíblica da Bíblia do Atalaia.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ShareMenu text={shareText} open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
};

export default ExegetAI;
