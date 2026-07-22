import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, QrCode, RefreshCw, Power, X } from "lucide-react";

type Props = { onClose: () => void };

const AtisConnect = ({ onClose }: Props) => {
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<string>("unknown");
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const call = async (action: string) => {
    const { data, error } = await supabase.functions.invoke("atis-instance", { body: { action } });
    if (error) throw error;
    return data as any;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const st = await call("status");
      setState(st.state ?? "unknown");
      setWebhookUrl(st.webhookUrl ?? "");
      if (st.state !== "open" && st.state !== "connected") {
        const q = await call("qr");
        setQr(q.qr ?? null);
        setCode(q.code ?? null);
      } else {
        setQr(null);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao consultar Evolution");
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const r = await call("create");
      setQr(r.qr ?? null);
      setCode(r.code ?? null);
      setWebhookUrl(r.webhookUrl ?? "");
      toast.success("Instância criada. Escaneie o QR Code.");
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!confirm("Desconectar o WhatsApp do Atis?")) return;
    setBusy(true);
    try {
      await call("logout");
      toast.success("Desconectado");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (state === "open" || state === "connected") return;
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [state]);

  const connected = state === "open" || state === "connected";

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-[hsl(var(--dark-card))] rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold">Conectar WhatsApp do Atis</p>
          <button onClick={onClose} className="p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className={`text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-2 ${connected ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-yellow-500"}`} />
          Estado: {state}
        </div>

        {loading ? (
          <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : connected ? (
          <div className="text-sm text-[hsl(var(--dark-muted))] space-y-3">
            <p>✅ WhatsApp conectado. O Atis já pode enviar e receber mensagens.</p>
            <button onClick={logout} disabled={busy} className="w-full h-11 rounded-xl bg-destructive/20 text-destructive font-semibold text-sm inline-flex items-center justify-center gap-2">
              <Power className="w-4 h-4" /> Desconectar
            </button>
          </div>
        ) : qr ? (
          <div className="space-y-3">
            <div className="bg-white p-3 rounded-xl grid place-items-center">
              <img src={qr} alt="QR Code" className="w-full max-w-[280px]" />
            </div>
            <p className="text-xs text-[hsl(var(--dark-muted))] text-center">
              WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar aparelho</b> → aponte a câmera.
            </p>
            {code && <p className="text-[10px] text-center text-[hsl(var(--dark-muted))] break-all">Código: {code}</p>}
            <button onClick={refresh} className="w-full h-10 rounded-xl bg-[hsl(var(--dark-card-hover))] text-sm inline-flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" /> Atualizar QR
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhum QR disponível. Crie a instância "atis" na Evolution.</p>
            <button onClick={create} disabled={busy} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2">
              <QrCode className="w-4 h-4" /> {busy ? "Criando..." : "Criar instância e gerar QR"}
            </button>
          </div>
        )}

        {webhookUrl && (
          <div className="text-[10px] text-[hsl(var(--dark-muted))] border-t border-[hsl(var(--dark-card-hover))] pt-3">
            <p className="mb-1 font-semibold">Webhook (já configurado automaticamente na criação):</p>
            <code className="break-all text-[hsl(var(--dark-text))]">{webhookUrl}</code>
          </div>
        )}
      </div>
    </div>
  );
};

export default AtisConnect;