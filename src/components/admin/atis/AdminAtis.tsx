import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Smartphone,
  Unplug,
  UserRound,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AtisInstanceStatus = "disconnected" | "connecting" | "qr_required" | "connected" | "error" | "unknown";
type AtisInstance = {
  id: string;
  name: string;
  status: AtisInstanceStatus;
  connected_number?: string | null;
  last_status_check_at?: string | null;
};
type Metrics = { contacts: number; individuals: number; groups: number; pending: number };

const labels: Record<AtisInstanceStatus, string> = {
  connected: "Conectado",
  connecting: "Conectando",
  qr_required: "Aguardando QR Code",
  disconnected: "Desconectado",
  error: "Erro",
  unknown: "Desconhecido",
};
const badge: Record<AtisInstanceStatus, string> = {
  connected: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  connecting: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  qr_required: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  disconnected: "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] border-[hsl(var(--dark-card-hover))]",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  unknown: "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] border-[hsl(var(--dark-card-hover))]",
};

async function functionErrorMessage(error: any) {
  const fallback = error?.message || "Não foi possível concluir a operação.";
  const response = error?.context;
  if (!(response instanceof Response)) return fallback;
  try {
    const body = await response.clone().json();
    return body?.message || body?.error || fallback;
  } catch { return fallback; }
}
async function invokeAtis<T = any>(functionName: string, body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou. Entre novamente.");
  const { data, error } = await supabase.functions.invoke(functionName, { body, headers: { Authorization: `Bearer ${accessToken}` } });
  if (error) throw new Error(await functionErrorMessage(error));
  return data as T;
}
function qrSrc(value: string | null) {
  if (!value) return null;
  return value.startsWith("data:image/") ? value : `data:image/png;base64,${value}`;
}
function formatDate(value?: string | null) {
  if (!value) return "—";
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value)); }
  catch { return "—"; }
}

type AdminAtisProps = { initialView?: "overview" | "connection" };

const AdminAtis = ({ initialView = "overview" }: AdminAtisProps) => {
  const navigate = useNavigate();
  const [view, setView] = useState<"overview" | "connection">(initialView);
  const [instance, setInstance] = useState<AtisInstance | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({ contacts: 0, individuals: 0, groups: 0, pending: 0 });
  const [qr, setQr] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [webhookReady, setWebhookReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);

  const clearMessages = () => { setError(null); setNotice(null); };
  const loadMetrics = useCallback(async () => {
    const result = await invokeAtis<Metrics>("atis-recipients", { action: "summary" });
    const client = supabase as any;
    const pending = await client.from("atis_message_targets").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]);
    if (mounted.current) setMetrics({ contacts: result.contacts ?? 0, individuals: result.individuals ?? 0, groups: result.groups ?? 0, pending: pending.count ?? 0 });
  }, []);
  const loadWebhook = useCallback(async (current: AtisInstance) => {
    try {
      const result = await invokeAtis<any>("atis-instance", { action: "webhook_status", instance_id: current.id });
      if (mounted.current) setWebhookReady(Boolean(result.webhook?.enabled && result.webhook?.custom_secret_header_present));
    } catch { if (mounted.current) setWebhookReady(false); }
  }, []);
  const load = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const result = await invokeAtis<{ instances?: AtisInstance[] }>("atis-instance", { action: "list" });
      const current = result.instances?.find((r) => r.name === "atis-main") ?? result.instances?.[0] ?? null;
      if (!mounted.current) return;
      setInstance(current);
      await loadMetrics();
      if (current) await loadWebhook(current);
    } catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : "Falha ao carregar o ATIS."); }
    finally { if (mounted.current) setLoading(false); }
  }, [loadMetrics, loadWebhook]);

  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);
  useEffect(() => { setView(initialView); }, [initialView]);

  const refreshStatus = useCallback(async (silent = false) => {
    if (!instance) return;
    if (!silent) { clearMessages(); setBusy("status"); }
    try {
      const result = await invokeAtis<{ instance: AtisInstance }>("atis-instance", { action: "status", instance_id: instance.id });
      if (!mounted.current) return;
      setInstance(result.instance);
      if (result.instance.status === "connected") { setQr(null); setPairingCode(null); }
    } catch (err) { if (!silent && mounted.current) setError(err instanceof Error ? err.message : "Falha ao atualizar status."); }
    finally { if (!silent && mounted.current) setBusy(null); }
  }, [instance]);
  useEffect(() => {
    if (!instance || !["connecting", "qr_required"].includes(instance.status)) return;
    const timer = window.setInterval(() => void refreshStatus(true), 3500);
    return () => window.clearInterval(timer);
  }, [instance?.id, instance?.status, refreshStatus]);

  const run = async (key: string, task: () => Promise<void>) => {
    clearMessages(); setBusy(key);
    try { await task(); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível concluir a operação."); }
    finally { setBusy(null); }
  };
  const createInstance = () => run("create", async () => {
    const result = await invokeAtis<any>("atis-instance", { action: "create", name: "atis-main" });
    setInstance(result.instance); setQr(result.connection?.qr ?? null); setPairingCode(result.connection?.pairing_code ?? null);
    setNotice("Instância preparada. Conecte o WhatsApp para continuar.");
    await loadWebhook(result.instance);
  });
  const connect = () => run("connect", async () => {
    if (!instance) return;
    const result = await invokeAtis<any>("atis-instance", { action: "connect", instance_id: instance.id });
    setInstance(result.instance); setQr(result.connection?.qr ?? null); setPairingCode(result.connection?.pairing_code ?? null); setView("connection"); navigate("/atis/conexao");
  });
  const configureWebhook = () => run("webhook", async () => {
    if (!instance) return;
    await invokeAtis("atis-instance", { action: "configure_webhook", instance_id: instance.id }); setWebhookReady(true); setNotice("Webhook configurado.");
  });
  const restart = () => run("restart", async () => {
    if (!instance) return;
    const result = await invokeAtis<{ instance: AtisInstance }>("atis-instance", { action: "restart", instance_id: instance.id }); setInstance(result.instance);
  });
  const logout = () => {
    if (!instance || !window.confirm("Desconectar este WhatsApp do ATIS?")) return;
    void run("logout", async () => {
      const result = await invokeAtis<{ instance: AtisInstance }>("atis-instance", { action: "logout", instance_id: instance.id, confirm: true });
      setInstance(result.instance); setQr(null); setPairingCode(null);
    });
  };
  const syncAppContacts = () => run("sync-app", async () => {
    const result = await invokeAtis<any>("atis-sync", { action: "app_contacts" });
    await loadMetrics();
    setNotice(`${Number(result?.app_contacts?.found ?? 0)} cadastro(s) com WhatsApp conferidos. Nenhum contato do celular foi importado.`);
  });
  const syncRegisteredGroups = () => run("sync-groups", async () => {
    if (!instance || instance.status !== "connected") throw new Error("Conecte o WhatsApp primeiro.");
    const result = await invokeAtis<any>("atis-sync", { action: "registered_groups", instance_id: instance.id });
    await loadMetrics();
    setNotice(`${Number(result?.registered_groups?.refreshed ?? 0)} grupo(s) cadastrado(s) atualizados.`);
  });

  const status = instance?.status ?? "unknown";
  const connected = status === "connected";
  const currentQr = useMemo(() => qrSrc(qr), [qr]);

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <span className="w-14 h-14 rounded-2xl grid place-items-center bg-white/15"><MessageCircle className="w-7 h-7" /></span>
          <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Automação WhatsApp</p><h2 className="text-xl font-bold">ATIS</h2><p className="text-xs text-white/70 mt-1">Canal, destinatários, fila e automações em uma central independente.</p></div>
          <span className={`hidden sm:inline-flex px-3 py-1.5 rounded-full border text-xs font-semibold ${connected ? "bg-emerald-400/15 text-emerald-100 border-emerald-300/20" : "bg-white/10 text-white/80 border-white/10"}`}>{connected ? "Conectado" : labels[status]}</span>
        </div>
      </div>

      <div className="hidden md:flex gap-2">
        <button onClick={() => setView("overview")} className={`h-9 px-4 rounded-xl text-xs font-bold ${view === "overview" ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}>Visão geral</button>
        <button onClick={() => setView("connection")} className={`h-9 px-4 rounded-xl text-xs font-bold ${view === "connection" ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}>Conexão</button>
      </div>

      {error && <div className="rounded-2xl p-4 border border-destructive/20 bg-destructive/10 flex gap-3 text-destructive"><AlertTriangle className="w-5 h-5" /><p className="text-sm">{error}</p></div>}
      {notice && <div className="rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/10 flex gap-3 text-emerald-400"><CheckCircle2 className="w-5 h-5" /><p className="text-sm">{notice}</p></div>}

      {view === "overview" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Contatos", metrics.contacts, "cadastros do app", ContactRound],
              ["Individuais", metrics.individuals, "adicionados por você", UserRound],
              ["Grupos", metrics.groups, "cadastrados no ATIS", UsersRound],
              ["Fila", metrics.pending, "pendentes", Clock3],
            ].map(([label, value, sub, Icon]: any) => <div key={label} className="rounded-2xl p-4 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50"><div className="flex items-start justify-between"><span className="w-9 h-9 rounded-xl grid place-items-center bg-primary/15 text-primary"><Icon className="w-4 h-4" /></span><span className="text-xl font-bold">{value}</span></div><p className="text-xs font-bold mt-3">{label}</p><p className="text-[10px] text-[hsl(var(--dark-muted))] mt-0.5">{sub}</p></div>)}
          </div>

          <div className="rounded-2xl p-4 sm:p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
            <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-xl grid place-items-center bg-primary/15 text-primary">{connected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}</span><div className="flex-1"><p className="text-sm font-bold">WhatsApp principal</p><p className="text-xs text-[hsl(var(--dark-muted))] mt-1">{instance?.connected_number ? `+${String(instance.connected_number).replace(/^\+/, "")}` : "Nenhum número conectado."}</p></div><span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold ${badge[status]}`}>{labels[status]}</span></div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!instance ? <button onClick={createInstance} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40">Preparar ATIS</button> : !connected ? <button onClick={connect} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex gap-2 items-center disabled:opacity-40"><QrCode className="w-4 h-4" /> Conectar WhatsApp</button> : null}
              <button onClick={syncAppContacts} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-[hsl(var(--dark-bg))] text-xs font-semibold flex gap-2 items-center disabled:opacity-40"><RefreshCw className="w-4 h-4" /> Atualizar cadastros do app</button>
              {connected && <button onClick={syncRegisteredGroups} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-[hsl(var(--dark-bg))] text-xs font-semibold flex gap-2 items-center disabled:opacity-40"><RefreshCw className="w-4 h-4" /> Atualizar grupos cadastrados</button>}
            </div>
            <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-3">A agenda pessoal do WhatsApp conectado nunca é usada como fonte de contatos.</p>
          </div>

          <button onClick={() => navigate("/atis/destinatarios")} className="w-full rounded-2xl p-4 bg-primary/10 border border-primary/20 text-left hover:bg-primary/15 transition-colors"><div className="flex items-center gap-3"><ContactRound className="w-5 h-5 text-primary" /><div><p className="text-sm font-bold">Gerenciar destinatários</p><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-0.5">Contatos do app, individuais manuais e grupos escolhidos.</p></div></div></button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl p-4 sm:p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
            <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-xl grid place-items-center bg-primary/15 text-primary"><Smartphone className="w-5 h-5" /></span><div className="flex-1"><p className="text-sm font-bold">WhatsApp principal</p><p className="text-[11px] text-[hsl(var(--dark-muted))]">Instância {instance?.name ?? "atis-main"}</p></div><span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold ${badge[status]}`}>{labels[status]}</span></div>
            <div className="grid sm:grid-cols-2 gap-3 mt-4"><div className="rounded-xl bg-[hsl(var(--dark-bg))] p-3"><p className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">Número</p><p className="text-sm font-semibold mt-1">{instance?.connected_number ? `+${String(instance.connected_number).replace(/^\+/, "")}` : "—"}</p></div><div className="rounded-xl bg-[hsl(var(--dark-bg))] p-3"><p className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">Última verificação</p><p className="text-sm font-semibold mt-1">{formatDate(instance?.last_status_check_at)}</p></div></div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!instance ? <button onClick={createInstance} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold">Preparar ATIS</button> : <><button onClick={() => void refreshStatus(false)} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-40"><RefreshCw className="w-4 h-4" /> Atualizar</button>{!connected && <button onClick={connect} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-[hsl(var(--dark-bg))] text-xs font-semibold flex items-center gap-2"><QrCode className="w-4 h-4" /> Gerar QR Code</button>}<button onClick={restart} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-[hsl(var(--dark-bg))] text-xs font-semibold flex items-center gap-2"><RotateCw className="w-4 h-4" /> Reiniciar</button><button onClick={logout} disabled={busy !== null || !connected} className="h-10 px-4 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-2 disabled:opacity-40"><Unplug className="w-4 h-4" /> Desconectar</button></>}
            </div>
          </div>

          {currentQr && !connected && <div className="rounded-2xl p-5 bg-[hsl(var(--dark-card))] border border-primary/20 text-center"><div className="w-fit mx-auto rounded-2xl p-3 bg-white"><img src={currentQr} alt="QR Code para conectar o WhatsApp ao ATIS" className="w-60 h-60 max-w-full object-contain" /></div><p className="text-sm font-bold mt-4">Escaneie com o WhatsApp</p><p className="text-xs text-[hsl(var(--dark-muted))] mt-1">O QR é transitório e não vira fonte de contatos.</p>{pairingCode && <p className="mt-3 font-mono font-bold">{pairingCode}</p>}<div className="mt-3 flex justify-center gap-2 text-[11px] text-amber-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Aguardando conexão…</div></div>}

          <div className="rounded-2xl p-4 sm:p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50"><div className="flex items-center gap-3"><Activity className="w-5 h-5 text-primary" /><div className="flex-1"><p className="text-sm font-bold">Webhook em tempo real</p><p className="text-[11px] text-[hsl(var(--dark-muted))]">Conexão e eventos do provider sem expor credenciais.</p></div><span className={`w-2.5 h-2.5 rounded-full ${webhookReady ? "bg-emerald-400" : webhookReady === false ? "bg-destructive" : "bg-[hsl(var(--dark-muted))]"}`} /></div><button onClick={configureWebhook} disabled={!instance || busy !== null} className="mt-4 h-9 px-3 rounded-xl bg-[hsl(var(--dark-bg))] text-[11px] font-semibold disabled:opacity-40">{busy === "webhook" ? "Configurando…" : webhookReady ? "Reconfigurar webhook" : "Configurar webhook"}</button></div>
        </div>
      )}
    </div>
  );
};

export default AdminAtis;
