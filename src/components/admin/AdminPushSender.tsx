import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Clock, Bell, Sparkles, Music2 } from "lucide-react";

interface PushLogEntry {
  id: string;
  title: string;
  body: string;
  sent_at: string;
  total_sent: number;
  total_failed: number;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

const AdminPushSender = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [log, setLog] = useState<PushLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLog();
  }, []);

  const loadLog = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("push_log")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(20);
    setLog(data || []);
    setLoading(false);
  };

  const sendPush = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Título e mensagem são obrigatórios");
      return;
    }

    if (!url.trim().startsWith("/")) {
      toast.error("A URL deve começar com /");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || "/",
          ttl: DEFAULT_TTL_SECONDS,
          urgency: "high",
          type: "general",
        },
      });

      if (error) {
        console.error("[AdminPushSender] invoke error:", error);
        // Tenta extrair mensagem de erro detalhada da Edge Function
        const details = (error as any).details || error.message || "Erro desconhecido ao enviar";
        throw new Error(details);
      }

      const sentCount = data?.sent || 0;
      const failedCount = data?.failed || 0;
      
      if (sentCount === 0 && failedCount > 0) {
        toast.error(`Falha total no envio: ${failedCount} erros. Verifique os logs.`);
      } else if (failedCount > 0) {
        toast.warning(`Push enviado com falhas parciais: ${sentCount} sucessos, ${failedCount} falhas.`);
      } else {
        toast.success(`Push enviado com sucesso para ${sentCount} dispositivos!`);
      }
      
      setTitle("");
      setBody("");
      setUrl("/");
      loadLog();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao conectar com o servidor de notificações");
      console.error("[AdminPushSender] error:", e);
    } finally {
      setSending(false);
    }
  };

  const generateHarpaMessage = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-push-message", {
        body: {
          topic:
            "Nova Harpa Cristã Atalaia com corinhos disponível no app; usuários podem LER as letras e OUVIR cada hino direto no player.",
        },
      });
      if (error) throw error;
      if (!data?.title || !data?.body) throw new Error("Resposta vazia");
      setTitle(data.title);
      setBody(data.body);
      setUrl("/harpa");
      toast.success("Mensagem gerada — revise e envie");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao gerar mensagem");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Enviar Notificação Push</span>
        </div>
        <p className="text-xs text-[hsl(var(--dark-muted))] leading-relaxed">
          Agora o envio usa retenção de 24h para o aparelho receber quando voltar à internet.
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={generateHarpaMessage}
          disabled={generating || sending}
          className="w-full"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          <Music2 className="w-4 h-4 mr-2" />
          {generating ? "Gerando com IA..." : "Novidade Harpa Cristã (IA)"}
        </Button>
        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Título *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: 📖 Versículo especial!" className="bg-[hsl(var(--dark-bg))] border-none" maxLength={100} />
        </div>
        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Mensagem *</label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Texto da notificação..." className="bg-[hsl(var(--dark-bg))] border-none min-h-[80px]" maxLength={500} />
        </div>
        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">URL ao clicar (opcional)</label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="/" className="bg-[hsl(var(--dark-bg))] border-none" maxLength={200} />
        </div>
        <Button onClick={sendPush} disabled={sending} className="w-full">
          {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          {sending ? "Enviando..." : "Enviar para todos"}
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
          <span className="text-sm font-semibold">Histórico de Envios</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : log.length === 0 ? (
          <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-6">Nenhum push enviado ainda</p>
        ) : (
          <div className="space-y-2">
            {log.map((entry) => (
              <div key={entry.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-3">
                <p className="text-sm font-semibold truncate">{entry.title}</p>
                <p className="text-xs text-[hsl(var(--dark-muted))] line-clamp-1 mt-0.5">{entry.body}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-[hsl(var(--dark-muted))]">
                  <span>{new Date(entry.sent_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</span>
                  <span className="text-green-400">✓ {entry.total_sent}</span>
                  {entry.total_failed > 0 && <span className="text-destructive">✗ {entry.total_failed}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPushSender;
