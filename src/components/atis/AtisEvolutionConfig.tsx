import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, 
  QrCode, 
  RefreshCw, 
  Power, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Globe, 
  Settings2,
  ExternalLink
} from "lucide-react";
import { useAtisStatus } from "./useAtisStatus";

type Props = { onClose?: () => void };

const AtisEvolutionConfig = ({ onClose }: Props) => {
  const status = useAtisStatus();
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [evoUrl, setEvoUrl] = useState<string>("");
  const [instanceName, setInstanceName] = useState<string>("atis");

  const call = async (action: string) => {
    const { data, error } = await supabase.functions.invoke("atis-instance", { body: { action } });
    if (error) throw error;
    return data as any;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: config, error: configError } = await supabase
        .from("atis_config")
        .select("evolution_url, evolution_instance")
        .eq("id", 1)
        .maybeSingle();

      if (configError) {
        console.error("[AtisEvolutionConfig] config fetch error", configError);
      }

      if (config) {
        setEvoUrl(config.evolution_url || "");
        setInstanceName(config.evolution_instance || "atis");
      }

      try {
        const st = await call("status");
        setWebhookUrl(st?.webhookUrl || "");
        
        if (st?.state !== "open" && st?.state !== "connected") {
          const q = await call("qr");
          setQr(q?.qr ?? null);
          setCode(q?.code ?? null);
        } else {
          setQr(null);
        }
      } catch (callErr) {
        console.warn("[AtisEvolutionConfig] instance call error (non-fatal)", callErr);
        // We don't throw here to allow basic config to be shown even if Edge Function fails
      }
      
      status.refresh();
    } catch (e: any) {
      console.error("[AtisEvolutionConfig] fatal error", e);
      toast.error("Erro ao carregar status da Evolution API");
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
      toast.success("Instância configurada. Escaneie o QR Code se necessário.");
      refresh();
    } catch (e: any) {
      console.error("[ATIS EVO] Create instance error:", e);
      toast.error(e.message ?? "Erro ao criar instância");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!confirm("Desconectar o WhatsApp do Atis? Esta ação removerá a sessão ativa.")) return;
    setBusy(true);
    try {
      await call("logout");
      toast.success("Sessão encerrada");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao desconectar");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const connected = status.connected;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold">Evolution API & WhatsApp</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-[hsl(var(--dark-card-hover))] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Card */}
        <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-5 space-y-4 border border-[hsl(var(--dark-card-hover))]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))]">Conexão Atual</p>
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
              connected ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
            }`}>
              {status.state}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl grid place-items-center ${
              connected ? "bg-green-500/10" : "bg-yellow-500/10"
            }`}>
              {status.loading ? (
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              ) : connected ? (
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              ) : (
                <AlertTriangle className="w-7 h-7 text-yellow-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold truncate">
                {connected ? "WhatsApp Online" : "Aguardando Conexão"}
              </p>
              <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5">
                {connected 
                  ? "O bot está pronto para interagir." 
                  : "Escaneie o QR Code para ativar."}
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {connected ? (
              <button 
                onClick={logout} 
                disabled={busy} 
                className="w-full h-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 font-semibold text-xs inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Power className="w-3.5 h-3.5" /> {busy ? "Desconectando..." : "Desconectar WhatsApp"}
              </button>
            ) : (
              <button 
                onClick={create} 
                disabled={busy} 
                className="w-full h-10 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-semibold text-xs inline-flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> 
                {busy ? "Processando..." : "Gerar Nova Conexão"}
              </button>
            )}
          </div>
        </div>

        {/* QR Code / Info Card */}
        <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-5 border border-[hsl(var(--dark-card-hover))] flex flex-col justify-center min-h-[200px]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
              <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium">Consultando API...</p>
            </div>
          ) : connected ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[hsl(var(--dark-bg))] space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Globe className="w-4 h-4 text-primary" /> 
                  <span>Dados da Instância</span>
                </div>
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px]">
                  <div>
                    <p className="text-[hsl(var(--dark-muted))] mb-0.5">Instância</p>
                    <p className="font-mono font-bold">{instanceName}</p>
                  </div>
                  <div>
                    <p className="text-[hsl(var(--dark-muted))] mb-0.5">Estado</p>
                    <p className="text-green-500 font-bold uppercase">Conectado</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[hsl(var(--dark-muted))] mb-0.5">Base URL</p>
                    <p className="truncate font-mono text-[9px] text-[hsl(var(--dark-muted))]">{evoUrl}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--dark-muted))] bg-primary/5 p-2 rounded-lg border border-primary/10">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span>Integração Atis V2 ativa e utilizando estas credenciais via Secrets.</span>
              </div>
            </div>
          ) : qr ? (
            <div className="space-y-4">
              <div className="bg-white p-3 rounded-xl mx-auto shadow-sm w-fit">
                <img src={qr} alt="QR Code" className="w-32 h-32" />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-[hsl(var(--dark-muted))] text-center px-4 leading-relaxed">
                  No WhatsApp: <b>Configurações</b> → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b>.
                </p>
                {code && (
                  <div className="bg-[hsl(var(--dark-bg))] p-2 rounded-lg text-center">
                    <p className="text-[9px] text-[hsl(var(--dark-muted))] uppercase font-bold tracking-tighter">Código de Pareamento</p>
                    <p className="text-xs font-mono font-bold tracking-widest">{code}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3 py-6">
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--dark-card-hover))] grid place-items-center mx-auto">
                <QrCode className="w-6 h-6 text-[hsl(var(--dark-muted))]" />
              </div>
              <p className="text-xs text-[hsl(var(--dark-muted))] px-6">
                Nenhuma sessão ativa ou QR Code pendente. Clique em <b>Gerar Nova Conexão</b> para iniciar.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* API Secrets Placeholder / Info */}
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-5 border border-[hsl(var(--dark-card-hover))] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold">Segurança & Secrets</p>
          </div>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">BACKEND PROTECTED</span>
        </div>
        
        <p className="text-xs text-[hsl(var(--dark-muted))] leading-relaxed">
          As credenciais sensíveis (<b>API Key</b> e <b>Webhook Secret</b>) estão armazenadas de forma segura nas Edge Functions do Lovable Cloud. O frontend não tem acesso direto a esses tokens, garantindo a proteção dos seus dados.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="bg-[hsl(var(--dark-bg))] p-3 rounded-xl border border-[hsl(var(--dark-card-hover))] space-y-1">
            <p className="text-[10px] font-bold text-[hsl(var(--dark-muted))] uppercase">Webhook Endpoint</p>
            <div className="flex items-center justify-between gap-2">
              <code className="text-[9px] truncate text-primary/80">{webhookUrl || "Aguardando conexão..."}</code>
              {webhookUrl && <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />}
            </div>
          </div>
          <div className="bg-[hsl(var(--dark-bg))] p-3 rounded-xl border border-[hsl(var(--dark-card-hover))] space-y-1">
            <p className="text-[10px] font-bold text-[hsl(var(--dark-muted))] uppercase">API Keys Status</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
              <span className="text-[10px] font-medium italic">Configuradas via Env Vars no backend</span>
            </div>
          </div>
        </div>
      </div>

      {!connected && !qr && !loading && (
        <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/10 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-yellow-500">Atenção</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-normal">
              Se você alterou a URL da Evolution API recentemente e o bot parou de responder, clique em <b>Gerar Nova Conexão</b> para que o Atis reconfigure automaticamente o Webhook e verifique a instância no novo servidor.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtisEvolutionConfig;