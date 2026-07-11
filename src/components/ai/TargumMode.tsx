import { useState, useCallback } from "react";
import { ScrollText, Loader2, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BibleVerse } from "@/services/bibleApi";

interface Props {
  bookName: string;
  chapter: number;
  verses: BibleVerse[];
  selectedVerses: Set<number>;
}

interface TargumVerse {
  number: number;
  original: string;
  transliteration: string;
  literal: string;
}

const TargumMode = ({ bookName, chapter, verses, selectedVerses }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TargumVerse[]>([]);

  const hasSelection = selectedVerses.size > 0;

  const run = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    setData([]);
    try {
      const target = hasSelection
        ? verses.filter((v) => selectedVerses.has(v.number))
        : verses;
      const numbers = target.map((v) => v.number);
      const payloadText =
        `Referência: ${bookName} ${chapter}\n` +
        `Versículos solicitados (números): ${numbers.join(", ")}\n\n` +
        `Texto em português (apenas para orientação — devolva original + transliteração + literal):\n` +
        target.map((v) => `${v.number} ${v.text}`).join("\n");

      const { data: res, error } = await supabase.functions.invoke("ai-tools", {
        body: {
          tool: "targum",
          reference: `${bookName} ${chapter}`,
          text: payloadText,
        },
      });
      if (error) throw error;
      const raw = (res as any)?.result;
      if (!raw) throw new Error("Resposta vazia");
      const parsed = safeParseJson(raw);
      const list: TargumVerse[] = Array.isArray(parsed?.verses) ? parsed.verses : [];
      if (list.length === 0) throw new Error("Nenhum versículo retornado");
      setData(list);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar Modo Metarguem");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [bookName, chapter, verses, selectedVerses, hasSelection]);

  return (
    <>
      <button
        onClick={run}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 transition-colors hover:bg-amber-500/15"
      >
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">
            Modo Metarguem {hasSelection ? `(${selectedVerses.size} vers.)` : "(capítulo)"}
          </span>
          <Sparkles className="w-3 h-3 text-amber-400/60" />
        </div>
        <span className="text-[10px] text-amber-400/70">Original · Transliteração · Literal</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[hsl(var(--dark-card))] border-amber-500/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-300">
              <ScrollText className="w-5 h-5" />
              Modo Metarguem — {bookName} {chapter}
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <p className="text-xs text-[hsl(var(--dark-muted))]">
                Consultando texto original, transliteração e tradução literal...
              </p>
            </div>
          )}

          {!loading && data.length > 0 && (
            <div className="space-y-5 pt-2">
              {data.map((v) => (
                <article
                  key={v.number}
                  className="rounded-xl border border-amber-500/15 bg-black/20 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                      v.{v.number}
                    </span>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-amber-400/60 mb-1">
                      Original
                    </p>
                    <p
                      dir="auto"
                      className="text-lg leading-relaxed text-[hsl(var(--dark-text))] font-serif"
                      style={{ fontFeatureSettings: '"kern"' }}
                    >
                      {v.original}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-amber-400/60 mb-1">
                      Transliteração
                    </p>
                    <p className="text-sm italic leading-relaxed text-[hsl(var(--dark-text))]/85">
                      {v.transliteration}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-amber-400/60 mb-1">
                      Tradução literal
                    </p>
                    <p className="text-sm leading-relaxed text-[hsl(var(--dark-text))]">
                      {v.literal}
                    </p>
                  </div>
                </article>
              ))}

              <p className="text-[10px] text-[hsl(var(--dark-muted))] text-center pt-2">
                Gerado por IA a partir de BHS/WLC (AT) e NA28/SBLGNT (NT). Podem existir
                variações — confira com fontes acadêmicas em estudos formais.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TargumMode;