import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, Send, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TargetType = "contact" | "individual" | "group";
type Target = {
  id: string;
  type: TargetType;
  name: string;
  detail: string;
  eligible: boolean;
  reason?: string;
};

async function invokeSend(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sua sessão administrativa expirou.");
  const { data, error } = await supabase.functions.invoke("atis-send", { body, headers: { Authorization: `Bearer ${token}` } });
  if (error) {
    const response = error?.context;
    if (response instanceof Response) {
      try {
        const detail = await response.clone().json();
        throw new Error(detail?.message || detail?.error || error.message);
      } catch (parsed) {
        if (parsed instanceof Error && parsed.message !== error.message) throw parsed;
      }
    }
    throw new Error(error.message || "Falha ao preparar envio.");
  }
  return data as any;
}

export default function AtisSend() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const [contacts, individuals, groups] = await Promise.all([
        (supabase as any).from("atis_contacts").select("id,name,phone_e164,is_active,whatsapp_opt_in,blocked").eq("source", "app").eq("is_active", true).order("name"),
        (supabase as any).from("atis_individuals").select("id,name,phone_e164,is_active,allow_messages,blocked").eq("is_active", true).order("name"),
        (supabase as any).from("atis_groups").select("id,name,participant_count,is_active,provider_exists,allow_manual_send").eq("is_active", true).order("name"),
      ]);
      if (!active) return;
      const problems = [contacts.error, individuals.error, groups.error].filter(Boolean);
      if (problems.length) {
        setError("Não foi possível carregar todos os destinatários.");
        setLoading(false);
        return;
      }
      const rows: Target[] = [
        ...(contacts.data ?? []).map((row: any) => ({
          id: row.id,
          type: "contact" as const,
          name: row.name || row.phone_e164,
          detail: row.phone_e164 || "Contato do app",
          eligible: row.whatsapp_opt_in === true && row.blocked !== true,
          reason: row.blocked ? "bloqueado" : row.whatsapp_opt_in !== true ? "sem consentimento" : undefined,
        })),
        ...(individuals.data ?? []).map((row: any) => ({
          id: row.id,
          type: "individual" as const,
          name: row.name || row.phone_e164,
          detail: row.phone_e164 || "Individual",
          eligible: row.allow_messages === true && row.blocked !== true,
          reason: row.blocked ? "bloqueado" : row.allow_messages !== true ? "mensagens desativadas" : undefined,
        })),
        ...(groups.data ?? []).map((row: any) => ({
          id: row.id,
          type: "group" as const,
          name: row.name || "Grupo",
          detail: `${Number(row.participant_count ?? 0)} participante(s)`,
          eligible: row.provider_exists !== false && row.allow_manual_send === true,
          reason: row.provider_exists === false ? "não existe mais no WhatsApp" : row.allow_manual_send !== true ? "envio manual desativado" : undefined,
        })),
      ];
      setTargets(rows);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const eligible = useMemo(() => targets.filter((item) => item.eligible), [targets]);
  const selectedTargets = useMemo(() => eligible.filter((item) => selected.has(`${item.type}:${item.id}`)), [eligible, selected]);

  const toggle = (target: Target) => {
    if (!target.eligible) return;
    const key = `${target.type}:${target.id}`;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const payloadTargets = () => selectedTargets.map((target) => target.type === "contact"
    ? { type: "contact", contact_id: target.id }
    : target.type === "individual"
      ? { type: "individual", individual_id: target.id }
      : { type: "group", group_id: target.id });

  const validate = () => {
    if (!message.trim()) throw new Error("Escreva a mensagem antes de continuar.");
    if (message.trim().length > 4096) throw new Error("A mensagem deve ter no máximo 4096 caracteres.");
    if (!selectedTargets.length) throw new Error("Selecione pelo menos um destinatário elegível.");
  };

  const preview = async () => {
    setError(null); setNotice(null);
    try {
      validate(); setBusy("preview");
      const result = await invokeSend({ content: message.trim(), source_type: "manual", targets: payloadTargets(), dry_run: true });
      setNotice(`Validação concluída: ${Number(result?.targets?.length ?? 0)} destinatário(s) apto(s) para receber.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha na validação."); }
    finally { setBusy(null); }
  };

  const send = async () => {
    setError(null); setNotice(null);
    try {
      validate(); setBusy("send");
      const result = await invokeSend({
        content: message.trim(),
        source_type: "manual",
        targets: payloadTargets(),
        client_request_id: crypto.randomUUID(),
        ...(scheduledFor ? { scheduled_for: new Date(scheduledFor).toISOString() } : {}),
      });
      setNotice(`${Number(result?.targets?.length ?? 0)} envio(s) colocado(s) na fila do ATIS${scheduledFor ? " para o horário escolhido" : ""}.`);
      setMessage(""); setSelected(new Set()); setScheduledFor("");
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao colocar mensagem na fila."); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex gap-3"><Send className="w-5 h-5 text-primary mt-0.5" /><div><h2 className="font-bold text-sm">Enviar pelo ATIS</h2><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">O painel apenas coloca a mensagem na fila segura. Consentimento, bloqueios e regras de grupos continuam validados no backend.</p></div></div>
      </div>

      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{notice}</div>}

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4 space-y-3">
        <label className="block"><span className="text-xs font-bold">Mensagem</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={4096} placeholder="Escreva a mensagem…" className="mt-2 w-full rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] p-3 text-sm outline-none resize-y" /><span className="block text-right text-[9px] text-[hsl(var(--dark-muted))] mt-1">{message.length}/4096</span></label>
        <label className="block"><span className="text-xs font-bold inline-flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-primary" /> Agendar (opcional)</span><input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="mt-2 h-11 w-full rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-sm outline-none" /></label>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] overflow-hidden">
        <div className="p-4 border-b border-[hsl(var(--dark-card-hover))] flex items-center justify-between"><div><p className="text-sm font-bold flex items-center gap-2"><UsersRound className="w-4 h-4 text-primary" /> Destinatários</p><p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">{selectedTargets.length} selecionado(s) de {eligible.length} elegível(is)</p></div><button disabled={!eligible.length} onClick={() => setSelected(new Set(eligible.map((item) => `${item.type}:${item.id}`)))} className="text-[10px] font-bold text-primary disabled:opacity-40">Selecionar aptos</button></div>
        {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : <div className="max-h-[50vh] overflow-y-auto divide-y divide-[hsl(var(--dark-card-hover))]/60">{targets.map((target) => { const key = `${target.type}:${target.id}`; return <button key={key} onClick={() => toggle(target)} disabled={!target.eligible} className="w-full p-3 text-left flex items-center gap-3 disabled:opacity-45"><span className={`w-5 h-5 rounded-md border grid place-items-center ${selected.has(key) ? "bg-primary border-primary" : "border-[hsl(var(--dark-muted))]/40"}`}>{selected.has(key) && <span className="text-primary-foreground text-xs">✓</span>}</span><span className="min-w-0 flex-1"><span className="block text-xs font-bold truncate">{target.name}</span><span className="block text-[10px] text-[hsl(var(--dark-muted))] truncate">{target.type === "contact" ? "Contato" : target.type === "individual" ? "Individual" : "Grupo"} · {target.detail}{target.reason ? ` · ${target.reason}` : ""}</span></span></button>; })}</div>}
      </div>

      <div className="grid grid-cols-2 gap-2 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-3 z-20 rounded-2xl bg-[hsl(var(--dark-bg))]/95 backdrop-blur p-2 border border-[hsl(var(--dark-card-hover))]">
        <button onClick={preview} disabled={busy !== null} className="h-11 rounded-xl bg-[hsl(var(--dark-card))] text-xs font-bold disabled:opacity-40">{busy === "preview" ? "Validando…" : "Validar envio"}</button>
        <button onClick={send} disabled={busy !== null} className="h-11 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40">{busy === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{busy === "send" ? "Enfileirando…" : scheduledFor ? "Agendar" : "Enviar"}</button>
      </div>
    </div>
  );
}
