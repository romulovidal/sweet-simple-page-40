from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected block not found: {label}")
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# Backend webhook: groups reply by default + optional mention/name-only mode.
# ---------------------------------------------------------------------------
webhook_path = Path("supabase/functions/atis-webhook/index.ts")
webhook = webhook_path.read_text()

helpers = r'''
function normalizeMentionIdentity(value: unknown) {
  const raw = firstString(value);
  if (!raw) return null;
  const beforeAt = raw.split("@")[0] ?? raw;
  const beforeDevice = beforeAt.split(":")[0] ?? beforeAt;
  const digits = beforeDevice.replace(/\D/g, "");
  return digits || raw.toLowerCase();
}

function inboundMentionedJids(item: any): string[] {
  const message = item?.message ?? item?.data?.message ?? {};
  const contexts = [
    message?.extendedTextMessage?.contextInfo,
    message?.imageMessage?.contextInfo,
    message?.videoMessage?.contextInfo,
    message?.documentMessage?.contextInfo,
    message?.buttonsResponseMessage?.contextInfo,
    message?.listResponseMessage?.contextInfo,
    item?.contextInfo,
    item?.data?.contextInfo,
  ].filter(Boolean);
  const values: string[] = [];
  for (const context of contexts) {
    const candidates = [context?.mentionedJid, context?.mentionedJids, context?.mentions];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        for (const value of candidate) {
          const jid = firstString(value, value?.jid, value?.id);
          if (jid) values.push(jid);
        }
      } else {
        const jid = firstString(candidate, candidate?.jid, candidate?.id);
        if (jid) values.push(jid);
      }
    }
  }
  return [...new Set(values)];
}

function textCallsAtis(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /(^|[^a-z0-9])atis([^a-z0-9]|$)/i.test(normalized);
}

function providerOwnerMentionIds(payload: any): string[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : payload && typeof payload === "object"
        ? [payload]
        : [];
  const ids = new Set<string>();
  for (const row of rows) {
    const candidates = [
      row?.ownerJid,
      row?.owner,
      row?.number,
      row?.instance?.ownerJid,
      row?.instance?.owner,
      row?.instance?.number,
      row?.profile?.wid?._serialized,
      row?.profile?.wid?.user,
    ];
    for (const candidate of candidates) {
      const normalized = normalizeMentionIdentity(candidate);
      if (normalized) ids.add(normalized);
    }
  }
  return [...ids];
}
'''
webhook = replace_once(webhook, "\nfunction inboundSenderName(item: any) {", helpers + "\nfunction inboundSenderName(item: any) {", "insert mention helpers")
webhook = replace_once(
    webhook,
    '    autoReplyGroups: data?.value?.auto_reply_groups === true,\n    maxInboundChars:',
    '    autoReplyGroups: data?.value?.auto_reply_groups !== false,\n    groupMentionOnly: data?.value?.group_mention_only === true,\n    maxInboundChars:',
    "assistant runtime group settings",
)
webhook = replace_once(
    webhook,
    '  const defaultEnabled = type !== "group";\n',
    '  // Synced active groups use the assistant by default. Explicit per-group false rows still win.\n  const defaultEnabled = true;\n',
    "group AI default",
)
webhook = replace_once(
    webhook,
    '  let evolution: EvolutionProvider | null = null;\n  const counts =',
    '  let evolution: EvolutionProvider | null = null;\n  let ownerMentionIds: string[] | null = null;\n  const counts =',
    "mention cache",
)

mention_gate = r'''
    // Optional quiet group mode: ignore general group chatter and answer only when
    // someone writes the name "Atis" or explicitly @mentions the connected account.
    if (isGroup && runtime.groupMentionOnly) {
      let addressedToAtis = textCallsAtis(limitedText);
      const mentionedJids = inboundMentionedJids(item);

      if (!addressedToAtis && mentionedJids.length > 0) {
        if (ownerMentionIds === null) {
          ownerMentionIds = providerOwnerMentionIds({
            ownerJid: instance?.metadata?.owner_jid,
            owner: instance?.metadata?.owner,
            number: instance?.metadata?.owner_number,
          });
          if (!ownerMentionIds.length) {
            try {
              if (!evolution) {
                const config = getEvolutionConfigFromEnv();
                evolution = new EvolutionProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey });
              }
              const providerInstances = await evolution.fetchInstances(instance.external_instance_name || instance.name);
              ownerMentionIds = providerOwnerMentionIds(providerInstances);
            } catch (error) {
              console.error("[atis-webhook] could not resolve own JID for group mention", error instanceof Error ? error.message : error);
              ownerMentionIds = [];
            }
          }
        }
        const mentionedIdentities = mentionedJids.map(normalizeMentionIdentity).filter(Boolean) as string[];
        addressedToAtis = mentionedIdentities.some((id) => ownerMentionIds?.includes(id));
      }

      if (!addressedToAtis) {
        await supabase.from("atis_inbound_messages").update({
          status: "ignored",
          processed_at: new Date().toISOString(),
          metadata: {
            truncated: text.length > limitedText.length,
            policy: "group_mention_only",
            mentioned_jids_count: mentionedJids.length,
          },
        }).eq("id", inbound.id);
        counts.ignored++;
        continue;
      }
    }
'''
webhook = replace_once(
    webhook,
    '    counts.received++;\n\n    // App contacts can revoke WhatsApp consent',
    '    counts.received++;\n' + mention_gate + '\n    // App contacts can revoke WhatsApp consent',
    "group mention gate",
)
webhook_path.write_text(webhook)

# ---------------------------------------------------------------------------
# Settings endpoint: expose and save group behavior separately from the prompt.
# ---------------------------------------------------------------------------
settings_path = Path("supabase/functions/atis-settings/index.ts")
settings = settings_path.read_text()
settings = replace_once(
    settings,
    '        auto_reply_groups: row.value?.auto_reply_groups === true,\n        updated_at:',
    '        auto_reply_groups: row.value?.auto_reply_groups !== false,\n        group_mention_only: row.value?.group_mention_only === true,\n        updated_at:',
    "settings get group behavior",
)
behavior_action = r'''
    if (action === "save_behavior") {
      const next = {
        ...(row.value ?? {}),
        auto_reply_direct: input.auto_reply_direct !== false,
        auto_reply_groups: input.auto_reply_groups !== false,
        group_mention_only: input.group_mention_only === true,
      };
      const { data: saved, error: saveError } = await supabase
        .from("atis_settings")
        .update({ value: next })
        .eq("key", "assistant")
        .select("updated_at")
        .single();
      if (saveError) throw saveError;
      return json({
        ok: true,
        auto_reply_direct: next.auto_reply_direct,
        auto_reply_groups: next.auto_reply_groups,
        group_mention_only: next.group_mention_only,
        updated_at: saved.updated_at,
      });
    }
'''
settings = replace_once(settings, '    if (action === "save") {', behavior_action + '\n    if (action === "save") {', "settings save behavior action")
settings_path.write_text(settings)

# ---------------------------------------------------------------------------
# Admin UI: behavior controls in Configurações.
# ---------------------------------------------------------------------------
ui_path = Path("src/components/admin/atis/AtisSettings.tsx")
ui_path.write_text(r'''import { useEffect, useMemo, useState } from "react";
import { AtSign, BrainCircuit, Loader2, MessageCircle, Save, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

async function invoke(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sua sessão administrativa expirou.");
  const { data, error } = await supabase.functions.invoke("atis-settings", { body, headers: { Authorization: `Bearer ${token}` } });
  if (error) {
    const response = error?.context;
    if (response instanceof Response) {
      try { const payload = await response.clone().json(); throw new Error(payload?.message || payload?.error || error.message); } catch (cause) { if (cause instanceof Error && cause.message !== "Unexpected end of JSON input") throw cause; }
    }
    throw error;
  }
  return data as any;
}

const Toggle = ({ enabled, onChange, disabled = false, label }: { enabled: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!enabled)}
    className={`relative w-12 h-7 rounded-full transition-all shrink-0 disabled:opacity-35 ${enabled ? "bg-primary" : "bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))]"}`}
  >
    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${enabled ? "left-6" : "left-1"}`} />
  </button>
);

type Behavior = { direct: boolean; groups: boolean; mentionOnly: boolean };

const AtisSettings = () => {
  const [prompt, setPrompt] = useState("");
  const [original, setOriginal] = useState("");
  const [behavior, setBehavior] = useState<Behavior>({ direct: true, groups: true, mentionOnly: false });
  const [behaviorOriginal, setBehaviorOriginal] = useState<Behavior>({ direct: true, groups: true, mentionOnly: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [behaviorSaving, setBehaviorSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [behaviorSaved, setBehaviorSaved] = useState(false);

  useEffect(() => {
    let active = true;
    invoke({ action: "get" }).then((data) => {
      if (!active) return;
      setPrompt(data.prompt ?? "");
      setOriginal(data.prompt ?? "");
      const nextBehavior = {
        direct: data.auto_reply_direct !== false,
        groups: data.auto_reply_groups !== false,
        mentionOnly: data.group_mention_only === true,
      };
      setBehavior(nextBehavior);
      setBehaviorOriginal(nextBehavior);
    }).catch((err) => active && setError(err instanceof Error ? err.message : "Falha ao carregar as configurações."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const behaviorChanged = useMemo(() => (
    behavior.direct !== behaviorOriginal.direct
    || behavior.groups !== behaviorOriginal.groups
    || behavior.mentionOnly !== behaviorOriginal.mentionOnly
  ), [behavior, behaviorOriginal]);

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const result = await invoke({ action: "save", prompt });
      setPrompt(result.prompt ?? prompt); setOriginal(result.prompt ?? prompt); setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };

  const saveBehavior = async () => {
    setBehaviorSaving(true); setError(null); setBehaviorSaved(false);
    try {
      const result = await invoke({
        action: "save_behavior",
        auto_reply_direct: behavior.direct,
        auto_reply_groups: behavior.groups,
        group_mention_only: behavior.mentionOnly,
      });
      const nextBehavior = {
        direct: result.auto_reply_direct !== false,
        groups: result.auto_reply_groups !== false,
        mentionOnly: result.group_mention_only === true,
      };
      setBehavior(nextBehavior);
      setBehaviorOriginal(nextBehavior);
      setBehaviorSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar o comportamento do ATIS."); }
    finally { setBehaviorSaving(false); }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/60">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-2xl grid place-items-center bg-primary/15 text-primary shrink-0"><SlidersHorizontal className="w-5 h-5" /></span>
          <div><p className="text-[10px] uppercase tracking-[0.2em] text-primary">Configurações do ATIS</p><h2 className="text-xl font-bold mt-1">Personalize o comportamento</h2><p className="text-xs text-[hsl(var(--dark-muted))] mt-2 leading-relaxed">Controle quando o ATIS participa das conversas e ajuste sua identidade ministerial.</p></div>
        </div>
      </div>

      {error && <div className="rounded-2xl p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
      {behaviorSaved && <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">Comportamento salvo. As próximas mensagens já usarão esta configuração.</div>}
      {saved && <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">Prompt salvo. As próximas conversas já usarão esta versão.</div>}

      <section className="rounded-3xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/60 overflow-hidden">
        <div className="p-4 sm:p-5 flex items-start gap-3 border-b border-[hsl(var(--dark-card-hover))]/60">
          <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1"><h3 className="text-sm font-bold">Conversas e grupos</h3><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Defina onde o ATIS responde automaticamente e se ele deve aguardar ser chamado nos grupos.</p></div>
        </div>
        <div className="divide-y divide-[hsl(var(--dark-card-hover))]/50">
          <div className="p-4 sm:p-5 flex items-center gap-4">
            <span className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/10 text-primary shrink-0"><MessageCircle className="w-4 h-4" /></span>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold">Responder conversas individuais</p><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Mantém o atendimento automático nas conversas privadas autorizadas.</p></div>
            <Toggle enabled={behavior.direct} onChange={(direct) => { setBehavior((current) => ({ ...current, direct })); setBehaviorSaved(false); }} label="Responder conversas individuais" />
          </div>

          <div className="p-4 sm:p-5 flex items-center gap-4">
            <span className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/10 text-primary shrink-0"><Users className="w-4 h-4" /></span>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold">Responder em grupos</p><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Quando ativo, grupos sincronizados e habilitados podem conversar normalmente com o ATIS.</p></div>
            <Toggle enabled={behavior.groups} onChange={(groups) => { setBehavior((current) => ({ ...current, groups, mentionOnly: groups ? current.mentionOnly : false })); setBehaviorSaved(false); }} label="Responder em grupos" />
          </div>

          <div className={`p-4 sm:p-5 flex items-center gap-4 ${!behavior.groups ? "opacity-50" : ""}`}>
            <span className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/10 text-primary shrink-0"><AtSign className="w-4 h-4" /></span>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold">Somente quando o ATIS for chamado</p><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1 leading-relaxed">Nos grupos, responde somente quando alguém escrever <b>Atis</b> na mensagem ou marcar a conta do ATIS com @. Conversas gerais do grupo são ignoradas.</p></div>
            <Toggle disabled={!behavior.groups} enabled={behavior.groups && behavior.mentionOnly} onChange={(mentionOnly) => { setBehavior((current) => ({ ...current, mentionOnly })); setBehaviorSaved(false); }} label="Responder somente quando o ATIS for chamado" />
          </div>
        </div>
        <div className="p-4 sm:p-5 border-t border-[hsl(var(--dark-card-hover))]/60">
          <button onClick={saveBehavior} disabled={behaviorSaving || !behaviorChanged} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">{behaviorSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{behaviorSaving ? "Salvando..." : "Salvar comportamento"}</button>
        </div>
      </section>

      <section className="rounded-3xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/60 overflow-hidden">
        <div className="p-4 sm:p-5 flex items-start gap-3 border-b border-[hsl(var(--dark-card-hover))]/60">
          <BrainCircuit className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1"><h3 className="text-sm font-bold">Prompt-base do ATIS</h3><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Este é o prompt ministerial editável. As proteções técnicas e de segurança permanecem separadas e não podem ser removidas por engano.</p></div>
        </div>
        <div className="p-4 sm:p-5">
          <textarea value={prompt} onChange={(e) => { setPrompt(e.target.value); setSaved(false); }} rows={20} spellCheck={false} className="w-full min-h-[55dvh] md:min-h-[440px] rounded-2xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] p-4 text-xs sm:text-sm leading-relaxed outline-none focus:border-primary/50 resize-y" />
          <div className="mt-2 flex items-center justify-between text-[10px] text-[hsl(var(--dark-muted))]"><span>{prompt.length.toLocaleString("pt-BR")} / 20.000 caracteres</span><span>{prompt === original ? "Sem alterações" : "Alterações não salvas"}</span></div>
          <div className="mt-4 rounded-2xl p-3 bg-primary/5 border border-primary/10 flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" /><p className="text-[10px] leading-relaxed text-[hsl(var(--dark-muted))]">Regras fixas continuam protegendo segredos, ações administrativas e a exigência de usar Bíblia/Harpa/dados do próprio app como fonte quando disponíveis.</p></div>
          <button onClick={save} disabled={saving || prompt.trim().length < 200 || prompt === original} className="w-full h-12 mt-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? "Salvando..." : "Salvar prompt"}</button>
        </div>
      </section>
    </div>
  );
};

export default AtisSettings;
''')

print("ATIS group response controls patch applied")
