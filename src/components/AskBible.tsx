import { useState, useCallback, useEffect } from "react";
import { MessageCircleQuestion, Send, Loader2, Trash2, Share2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useBackHandler } from "@/hooks/useBackHandler";

const AI_TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AskBibleProps {
  enabled: boolean;
  showButton?: boolean;
}

const AskBible = ({ enabled, showButton = true }: AskBibleProps) => {
  const [open, setOpen] = useState(false);
  useBackHandler(open, () => setOpen(false));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-ask-bible", handleOpen);
    return () => window.removeEventListener("open-ask-bible", handleOpen);
  }, []);

  const handleShare = useCallback((text: string) => {
    if (navigator.share) {
      navigator.share({
        title: "Resposta da Bíblia do Atalaia",
        text: text,
        url: window.location.origin
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text).then(() => {
        toast.success("Resposta copiada para a área de transferência!");
      });
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const resp = await fetch(AI_TOOLS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          tool: "ask-bible",
          reference: "",
          text: userMessage,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro ao processar pergunta");
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
              setMessages([...newMessages, { role: "assistant", content: accumulated }]);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (accumulated) {
        setMessages([...newMessages, { role: "assistant", content: accumulated }]);
      }
    } catch {
      toast.error("Erro ao conectar com a IA");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const content = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card))] h-[85vh] flex flex-col p-0 [&>button.absolute]:hidden sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-[600px] sm:max-w-[500px] sm:rounded-3xl sm:border sm:shadow-2xl">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-[hsl(var(--dark-card))]">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[hsl(var(--dark-text))] flex items-center gap-2">
              <MessageCircleQuestion className="w-5 h-5 text-purple-400" />
              Pergunte à Bíblia
            </SheetTitle>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} className="text-[hsl(var(--dark-muted))] p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <MessageCircleQuestion className="w-12 h-12 text-purple-400/30 mx-auto mb-4" />
              <p className="text-sm text-[hsl(var(--dark-muted))]">
                Pergunte qualquer coisa sobre a Bíblia
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {["O que é graça?", "Quem foi Moisés?", "O que diz sobre ansiedade?"].map(q => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="px-3 py-1.5 rounded-full bg-[hsl(var(--dark-card))] text-xs text-[hsl(var(--dark-muted))]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 relative group ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-[hsl(var(--dark-card))]"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none text-sm pr-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    <button 
                      onClick={() => handleShare(msg.content)}
                      className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-dark-card-hover border border-white/10 shadow-lg active:scale-90 transition-all opacity-0 group-hover:opacity-100 lg:opacity-100"
                      title="Compartilhar resposta"
                    >
                      <Share2 className="w-3 h-3 text-primary" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-[hsl(var(--dark-card))] rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[hsl(var(--dark-card))]">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Digite sua pergunta..."
              className="bg-[hsl(var(--dark-card))] border-none min-h-[44px] max-h-[120px] text-sm resize-none"
              maxLength={1000}
              rows={1}
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="shrink-0">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  if (!showButton) return content;
  if (!enabled) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-tour="ask-bible"
        className="w-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
      >
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <MessageCircleQuestion className="w-5 h-5 text-purple-400" />
        </div>
        <div className="text-left flex-1">
          <p className="text-sm font-semibold">Pergunte à Bíblia</p>
          <p className="text-[10px] text-[hsl(var(--dark-muted))]">Tire suas dúvidas com Inteligência Espiritual</p>
        </div>
      </button>
      {content}
    </>
  );
};

export default AskBible;
