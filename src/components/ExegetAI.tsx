import { useState, useCallback } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

interface ExegetAIProps {
  reference: string;
  text: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exegetai`;

const ExegetAI = ({ reference, text }: ExegetAIProps) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <>
      <button
        onClick={runExegesis}
        className="fixed bottom-24 right-5 z-30 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-full w-11 h-11 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        title="ExegetAI — Exegese com IA"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[85vh] rounded-t-3xl bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card))] p-0 flex flex-col"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-[hsl(var(--dark-card))] flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <SheetTitle className="text-base text-[hsl(var(--dark-text))]">
                  ExegetAI
                </SheetTitle>
              </div>
              <button onClick={() => setOpen(false)} className="p-1">
                <X className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
              </button>
            </div>
            <p className="text-xs text-primary font-semibold mt-1">{reference}</p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading && !content && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <p className="text-sm text-[hsl(var(--dark-muted))]">Gerando exegese...</p>
              </div>
            )}
            {content && (
              <div className="prose prose-sm prose-invert max-w-none text-[hsl(var(--dark-text))]">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
            {loading && content && (
              <div className="flex items-center gap-2 mt-4 text-[hsl(var(--dark-muted))]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Escrevendo...</span>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default ExegetAI;
