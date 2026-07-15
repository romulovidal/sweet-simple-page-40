import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  hinoNumber: number;
  hinoTitle: string;
};

const MAX = 1000;
const MIN = 3;

export default function HarpaReportButton({ hinoNumber, hinoTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    const trimmed = message.trim();
    if (trimmed.length < MIN) {
      toast.error("Descreva o problema com pelo menos 3 caracteres.");
      return;
    }
    setSending(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("harpa_reports").insert({
      hino_number: hinoNumber,
      hino_title: hinoTitle,
      message: trimmed.slice(0, MAX),
      user_id: userData.user?.id ?? null,
    });
    setSending(false);
    if (error) {
      console.error("[harpa-report]", error);
      toast.error("Não foi possível enviar. Tente novamente.");
      return;
    }
    toast.success("Obrigado! Seu relato foi enviado.");
    setMessage("");
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-[11px] font-medium text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--destructive))] hover:border-[hsl(var(--destructive))]/40 transition"
        aria-label="Relatar erro neste hino"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Relatar erro
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !sending && setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md max-h-[85dvh] flex flex-col bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card))] rounded-t-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-5 pb-3 shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--dark-muted))]">
                  Relatar erro
                </p>
                <h3 className="text-base font-bold text-[hsl(var(--dark-text))] leading-tight">
                  Hino {hinoNumber} — {hinoTitle}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={sending}
                className="w-8 h-8 rounded-full grid place-items-center text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card))]"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 space-y-3">
              <p className="text-xs text-[hsl(var(--dark-muted))] leading-relaxed">
                Encontrou um erro de letra, coro trocado, palavra estranha ou
                trecho faltando? Descreva abaixo — a equipe será notificada.
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
                placeholder="Ex.: na estrofe 2, a segunda linha começa com um traço fora do lugar."
                rows={4}
                className="w-full rounded-xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] px-3 py-2.5 text-sm text-[hsl(var(--dark-text))] placeholder:text-[hsl(var(--dark-muted))]/70 focus:outline-none focus:border-primary/60 resize-none"
                disabled={sending}
              />
              <div className="flex justify-end text-[10px] text-[hsl(var(--dark-muted))]">
                {message.length}/{MAX}
              </div>
            </div>

            <div className="flex items-center gap-2 p-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shrink-0 border-t border-[hsl(var(--dark-card))] bg-[hsl(var(--dark-bg))] rounded-b-2xl">
              <button
                onClick={() => setOpen(false)}
                disabled={sending}
                className="flex-1 h-11 rounded-xl bg-[hsl(var(--dark-card))] text-sm font-semibold text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card-hover))] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={sending || message.trim().length < MIN}
                className="flex-1 h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar relato"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}