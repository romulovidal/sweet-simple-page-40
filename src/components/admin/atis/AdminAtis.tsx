import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ContactRound,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  RotateCw,
  Send,
  Settings2,
  Smartphone,
  Unplug,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";

type AtisInstanceStatus = "disconnected" | "connecting" | "qr_required" | "connected" | "error" | "unknown";

type AtisInstance = {
  id: string;
  name: string;
  provider: string;
  external_instance_name?: string | null;
  status: AtisInstanceStatus;
  connected_number?: string | null;
  connected_name?: string | null;
  last_connected_at?: string | null;
  last_disconnected_at?: string | null;
  last_status_check_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type PanelView = "overview" | "connection";

type Metrics = {
  contacts: number;
  optedIn: number;
  groups: number;
  pending: number;
};

const statusLabel: Record<AtisInstanceStatus, string> = {
  connected: "Conectado",
  connecting: "Conectando",
  qr_required: "Aguardando QR Code",
  disconnected: "Desconectado",
  error: "Erro",
  unknown: "Desconhecido",
};

const statusClass: Record<AtisInstanceStatus, string> = {
  connected: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  connecting: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  qr_required: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  disconnected: "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] border-[hsl(var(--dark-card-hover))]",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  unknown: "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] border-[hsl(var(--dark-card-hover))]",
};

function qrSrc(value: string | null) {
  if (!value) return null;
  if (value.startsWith("data:image/")) return value;
  return `data:image/png;base64,${value}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Fortaleza",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

async function functionErrorMessage(error: any) {
  const fallback = error?.message || "Não foi possível concluir a operação.";
  const response = error?.context;
  if (!(response instanceof Response)) return fallback;
  try {
    const body = await response.clone().json();
    return body?.message || body?.error || fallback;
  } catch {
    try {
      const text = await response.clone().text();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
}

async function invokeAtis<T = any>(functionName: string, body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou. Entre novamente.");

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) throw new Error(await functionErrorMessage(error));
  return data as T;
}

const AdminAtis = () => {
  const [view, setView] = useState<PanelView>("overview");
  const [instance, setInstance] = useState<AtisInstance | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [webhookReady, setWebhookReady] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({ contacts: 0, optedIn: 0, groups: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);

  const clearMessages = () => {
    setError(null);
    setNotice(null);
  };

  const loadMetrics = useCallback(async () => {
    const client = supabase as any;
    const [contactsRes, optedInRes, groupsRes, pendingRes] = await Promise.all([
      client.from("atis_contacts").select("id", { count: "exact", head: true }).eq("is_active", true),
      client.from("atis_contacts").select("id", { count: "exact", head: true }).eq("is_active", true).eq("whatsapp_opt_in", true),
      client.from("atis_groups").select("id", { count: "exact", head: true }).eq("is_active", true),
      client.from("atis_message_targets").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
    ]);
    if (!mounted.current) return;
    setMetrics({
      contacts: contactsRes.count ?? 0,
      optedIn: optedInRes.count ?? 0,
      groups: groupsRes.count ?? 0,
      pending: pendingRes.count ?? 0,
    });
  }, []);

  const loadWebhookStatus = useCallback(async (current: AtisInstance) => {
    try {
      const result = await invokeAtis<{ webhook?: { configured?: boolean; enabled?: boolean; custom_secret_header_present?: boolean } }>(
        "atis-instance",
        { action: "webhook_status", instance_id: current.id },
      );
      if (!mounted.current) return;
      setWebhookReady(Boolean(result.webhook?.enabled && result.webhook?.custom_secret_header_present));
    } catch {
      if (mounted.current) setWebhookReady(false);
    }
  }, []);

  const loadInitial = useCallback(async () => {
    clearMessages();
    setLoading(true);
    try {
      const result = await invokeAtis<{ instances?: AtisInstance[] }>("atis-instance", { action: "list" });
      const current = result.instances?.find((row) => row.name === "atis-main") ?? result.instances?.[0] ?? null;
      if (!mounted.current) return;
      setInstance(current);
      if (current) {
        await Promise.all([loadWebhookStatus(current), loadMetrics()]);
      } else {
        setWebhookReady(null);
        await loadMetrics();
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Falha ao carregar o ATIS.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [loadMetrics, loadWebhookStatus]);

  const refreshStatus = useCallback(async (silent = false) => {
    if (!instance) return;
    if (!silent) {
      clearMessages();
      setBusy("status");
    }
    try {
      const result = await invokeAtis<{ instance: AtisInstance }>("atis-instance", {
        action: "status",
        instance_id: instance.id,
      });
      if (!mounted.current) return;
      setInstance(result.instance);
      if (result.instance.status === "connected") {
        setQr(null);
        setPairingCode(null);
      }
    } catch (err) {
      if (!silent && mounted.current) setError(err instanceof Error ? err.message : "Falha ao atualizar status.");
    } finally {
      if (!silent && mounted.current) setBusy(null);
    }
  }, [instance]);

  useEffect(() => {
    mounted.current = true;
    void loadInitial();
    return () => {
      mounted.current = false;
    };
  }, [loadInitial]);

  useEffect(() => {
    if (!instance || !["connecting", "qr_required"].includes(instance.status)) return;
    const timer = window.setInterval(() => void refreshStatus(true), 3500);
    return () => window.clearInterval(timer);
  }, [instance?.id, instance?.status, refreshStatus]);

  const run = async (key: string, task: () => Promise<void>) => {
    clearMessages();
    setBusy(key);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(null);
    }
  };

  const createInstance = () => run("create", async () => {
    const result = await invokeAtis<{ instance: AtisInstance; connection?: { qr?: string | null; pairing_code?: string | null } }>(
      "atis-instance",
      { action: "create", name: "atis-main" },
    );
    setInstance(result.instance);
    setQr(result.connection?.qr ?? null);
    setPairingCode(result.connection?.pairing_code ?? null);
    setNotice("Instância ATIS preparada. Agora conecte o WhatsApp.");
    await loadWebhookStatus(result.instance);
  });

  const connect = () => run("connect", async () => {
    if (!instance) return;
    const result = await invokeAtis<{ instance: AtisInstance; connection?: { qr?: string | null; pairing_code?: string | null } }>(
      "atis-instance",
      { action: "connect", instance_id: instance.id },
    );
    setInstance(result.instance);
    setQr(result.connection?.qr ?? null);
    setPairingCode(result.connection?.pairing_code ?? null);
    setView("connection");
    setNotice("Escaneie o QR Code no WhatsApp. O status será atualizado automaticamente.");
  });

  const configureWebhook = () => run("webhook", async () => {
    if (!instance) return;
    await invokeAtis("atis-instance", { action: "configure_webhook", instance_id: instance.id });
    setWebhookReady(true);
    setNotice("Webhook seguro configurado com sucesso.");
  });

  const restart = () => run("restart", async () => {
    if (!instance) return;
    const result = await invokeAtis<{ instance: AtisInstance }>("atis-instance", {
      action: "restart",
      instance_id: instance.id,
    });
    setInstance(result.instance);
    setNotice("Reinicialização solicitada.");
  });

  const logout = () => {
    if (!instance) return;
    if (!window.confirm("Desconectar este WhatsApp do ATIS? Será necessário escanear um novo QR Code para reconectar.")) return;
    void run("logout", async () => {
      const result = await invokeAtis<{ instance: AtisInstance }>("atis-instance", {
        action: "logout",
        instance_id: instance.id,
        confirm: true,
      });
      setInstance(result.instance);
      setQr(null);
      setPairingCode(null);
      setNotice("WhatsApp desconectado do ATIS.");
    });
  };

  const syncContactsGroups = () => run("sync", async () => {
    if (!instance || instance.status !== "connected") throw new Error("Conecte o WhatsApp antes de sincronizar contatos e grupos.");
    const result = await invokeAtis<any>("atis-sync", { action: "all", instance_id: instance.id });
    await loadMetrics();
    const contacts = Number(result?.provider_contacts?.found ?? 0);
    const groups = Number(result?.groups?.found ?? 0);
    setNotice(`Sincronização concluída: ${contacts} contatos do WhatsApp e ${groups} grupos encontrados.`);
  });

  const connectionStatus = instance?.status ?? "unknown";
  const isConnected = connectionStatus === "connected";
  const currentQr = useMemo(() => qrSrc(qr), [qr]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm text-[hsl(var(--dark-muted))]">Carregando ATIS…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] text-white overflow-hidden relative">
        <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <span className="w-14 h-14 shrink-0 rounded-2xl grid place-items-center bg-white/15 backdrop-blur">
            <MessageCircle className="w-7 h-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Automação WhatsApp</p>
            <h2 className="text-xl font-bold">ATIS</h2>
            <p className="text-xs text-white/70 mt-1">Mensagens, contatos, grupos e automações em uma única central.</p>
          </div>
          <span className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
            isConnected ? "bg-emerald-400/15 text-emerald-100 border-emerald-300/20" : "bg-white/10 text-white/80 border-white/10"
          }`}>
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {statusLabel[connectionStatus]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
        <button
          onClick={() => setView("overview")}
          className={`shrink-0 h-9 px-4 rounded-xl text-xs font-semibold transition-colors ${
            view === "overview" ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))]"
          }`}
        >
          Visão geral
        </button>
        <button
          onClick={() => setView("connection")}
          className={`shrink-0 h-9 px-4 rounded-xl text-xs font-semibold transition-colors ${
            view === "connection" ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))]"
          }`}
        >
          Conexão
        </button>
        {["Enviar", "Contatos", "Grupos", "Automações"].map((label) => (
          <span key={label} className="shrink-0 h-9 px-4 rounded-xl grid place-items-center text-xs font-semibold bg-[hsl(var(--dark-card))]/60 text-[hsl(var(--dark-muted))]/60">
            {label}
          </span>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl p-4 border border-destructive/20 bg-destructive/10 flex gap-3 text-destructive">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold">Não foi possível concluir</p>
            <p className="text-xs mt-1 opacity-90 break-words">{error}</p>
          </div>
        </div>
      )}

      {notice && (
        <div className="rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/10 flex gap-3 text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{notice}</p>
        </div>
      )}

      {view === "overview" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Contatos", value: metrics.contacts, sub: `${metrics.optedIn} com opt-in`, icon: ContactRound },
              { label: "Grupos", value: metrics.groups, sub: "sincronizados", icon: UsersRound },
              { label: "Fila", value: metrics.pending, sub: "pendentes", icon: Clock3 },
              { label: "WhatsApp", value: isConnected ? "ON" : "OFF", sub: statusLabel[connectionStatus], icon: isConnected ? Wifi : WifiOff },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl p-4 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
                <div className="flex items-start justify-between gap-2">
                  <span className="w-9 h-9 rounded-xl grid place-items-center bg-primary/15 text-primary">
                    <item.icon className="w-4.5 h-4.5" />
                  </span>
                  <span className="text-xl font-bold text-[hsl(var(--dark-text))]">{item.value}</span>
                </div>
                <p className="text-xs font-bold text-[hsl(var(--dark-text))] mt-3">{item.label}</p>
                <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4 sm:p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-xl grid place-items-center bg-primary/15 text-primary shrink-0">
                {isConnected ? <Wifi className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-[hsl(var(--dark-text))]">Conexão principal</h3>
                  <span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold ${statusClass[connectionStatus]}`}>
                    {statusLabel[connectionStatus]}
                  </span>
                </div>
                <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">
                  {instance?.connected_number ? `+${String(instance.connected_number).replace(/^\+/, "")}` : "Nenhum número conectado no momento."}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {!instance ? (
                <button onClick={createInstance} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">
                  {busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Preparar ATIS"}
                </button>
              ) : !isConnected ? (
                <button onClick={connect} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                  {busy === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  Conectar WhatsApp
                </button>
              ) : (
                <button onClick={syncContactsGroups} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                  {busy === "sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sincronizar contatos e grupos
                </button>
              )}
              {instance && (
                <button onClick={() => setView("connection")} className="h-10 px-4 rounded-xl bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] text-xs font-semibold hover:bg-[hsl(var(--dark-card-hover))]">
                  Gerenciar conexão
                </button>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { title: "Enviar", text: "Envio individual, contatos e grupos entra na próxima etapa.", icon: Send },
              { title: "Automações", text: "Motor, fila e idempotência já estão preparados no backend.", icon: Activity },
              { title: "Configurações", text: "Rate limit, tentativas e integração ficam centralizados no ATIS.", icon: Settings2 },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl p-4 bg-[hsl(var(--dark-card))]/70 border border-[hsl(var(--dark-card-hover))]/40">
                <item.icon className="w-5 h-5 text-primary" />
                <p className="text-sm font-bold text-[hsl(var(--dark-text))] mt-3">{item.title}</p>
                <p className="text-[11px] leading-relaxed text-[hsl(var(--dark-muted))] mt-1">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl p-4 sm:p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3 min-w-0">
                <span className="w-11 h-11 rounded-xl grid place-items-center bg-primary/15 text-primary shrink-0">
                  <Smartphone className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[hsl(var(--dark-text))]">WhatsApp principal</p>
                  <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-0.5 truncate">Instância {instance?.name ?? "atis-main"}</p>
                </div>
              </div>
              <span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold shrink-0 ${statusClass[connectionStatus]}`}>
                {statusLabel[connectionStatus]}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl bg-[hsl(var(--dark-bg))] p-3">
                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">Número</p>
                <p className="text-sm font-semibold text-[hsl(var(--dark-text))] mt-1">{instance?.connected_number ? `+${String(instance.connected_number).replace(/^\+/, "")}` : "—"}</p>
              </div>
              <div className="rounded-xl bg-[hsl(var(--dark-bg))] p-3">
                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">Última verificação</p>
                <p className="text-sm font-semibold text-[hsl(var(--dark-text))] mt-1">{formatDateTime(instance?.last_status_check_at)}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {!instance ? (
                <button onClick={createInstance} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">Preparar ATIS</button>
              ) : (
                <>
                  <button onClick={() => void refreshStatus(false)} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                    {busy === "status" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Atualizar
                  </button>
                  {!isConnected && (
                    <button onClick={connect} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] text-xs font-semibold flex items-center gap-2 hover:bg-[hsl(var(--dark-card-hover))] disabled:opacity-50">
                      {busy === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                      Gerar QR Code
                    </button>
                  )}
                  <button onClick={restart} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] text-xs font-semibold flex items-center gap-2 hover:bg-[hsl(var(--dark-card-hover))] disabled:opacity-50">
                    {busy === "restart" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                    Reiniciar
                  </button>
                  <button onClick={logout} disabled={busy !== null || !isConnected} className="h-10 px-4 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-2 disabled:opacity-40">
                    <Unplug className="w-4 h-4" /> Desconectar
                  </button>
                </>
              )}
            </div>
          </div>

          {currentQr && !isConnected && (
            <div className="rounded-2xl p-5 bg-[hsl(var(--dark-card))] border border-primary/20 text-center">
              <div className="w-fit mx-auto rounded-2xl p-3 bg-white shadow-xl shadow-black/20">
                <img src={currentQr} alt="QR Code para conectar o WhatsApp ao ATIS" className="w-60 h-60 max-w-full object-contain" />
              </div>
              <h3 className="text-sm font-bold text-[hsl(var(--dark-text))] mt-4">Escaneie com o WhatsApp</h3>
              <p className="text-xs text-[hsl(var(--dark-muted))] mt-1 max-w-md mx-auto">
                No WhatsApp, abra Aparelhos conectados e escaneie este código. O QR fica somente nesta tela e não é salvo pelo ATIS.
              </p>
              {pairingCode && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--dark-bg))] px-3 py-2">
                  <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">Código</span>
                  <span className="text-sm font-mono font-bold text-[hsl(var(--dark-text))]">{pairingCode}</span>
                </div>
              )}
              <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-amber-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Aguardando conexão…
              </div>
            </div>
          )}

          <div className="rounded-2xl p-4 sm:p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl grid place-items-center bg-primary/15 text-primary">
                <Activity className="w-4.5 h-4.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[hsl(var(--dark-text))]">Webhook em tempo real</p>
                <p className="text-[11px] text-[hsl(var(--dark-muted))]">Atualiza conexão e eventos sem expor credenciais.</p>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full ${webhookReady ? "bg-emerald-400" : webhookReady === false ? "bg-destructive" : "bg-[hsl(var(--dark-muted))]"}`} />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button onClick={configureWebhook} disabled={!instance || busy !== null} className="h-9 px-3 rounded-xl bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] text-[11px] font-semibold hover:bg-[hsl(var(--dark-card-hover))] disabled:opacity-40">
                {busy === "webhook" ? "Configurando…" : webhookReady ? "Reconfigurar webhook" : "Configurar webhook"}
              </button>
              <span className="text-[10px] text-[hsl(var(--dark-muted))]">{webhookReady ? "Protegido e ativo" : "Verificação necessária"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAtis;
