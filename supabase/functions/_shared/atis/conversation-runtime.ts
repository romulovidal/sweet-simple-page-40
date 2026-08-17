export type DestinationType = "contact" | "individual" | "group";
export type ConversationMode = "normal" | "study" | "concise";

export type DestinationProfile = {
  conversation_mode: ConversationMode;
  response_style: "concise" | "balanced" | "detailed";
  quiet_hours_enabled: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string;
  cooldown_seconds: number;
  max_replies_per_10m: number;
  mention_only: boolean;
  enable_buttons: boolean;
  enable_audio: boolean;
  continue_in_app: boolean;
  custom_instruction: string | null;
};

type Json = Record<string, any>;

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.!?]+$/g, "").replace(/\s+/g, " ").trim();
}

function defaultProfile(type: DestinationType): DestinationProfile {
  return {
    conversation_mode: "normal",
    response_style: "balanced",
    quiet_hours_enabled: false,
    quiet_start: null,
    quiet_end: null,
    timezone: "America/Fortaleza",
    cooldown_seconds: 4,
    max_replies_per_10m: 8,
    mention_only: false,
    enable_buttons: false,
    enable_audio: false,
    continue_in_app: true,
    custom_instruction: null,
  };
}

export async function loadDestinationProfile(supabase: any, type: DestinationType, id: string): Promise<DestinationProfile> {
  const column = type === "contact" ? "contact_id" : type === "individual" ? "individual_id" : "group_id";
  const { data, error } = await supabase
    .from("atis_destination_profiles")
    .select("conversation_mode,response_style,quiet_hours_enabled,quiet_start,quiet_end,timezone,cooldown_seconds,max_replies_per_10m,mention_only,enable_buttons,enable_audio,continue_in_app,custom_instruction")
    .eq("destination_type", type)
    .eq(column, id)
    .maybeSingle();
  if (error) throw error;
  const defaults = defaultProfile(type);
  return {
    ...defaults,
    ...(data ?? {}),
    conversation_mode: ["normal", "study", "concise"].includes(data?.conversation_mode) ? data.conversation_mode : defaults.conversation_mode,
    response_style: ["concise", "balanced", "detailed"].includes(data?.response_style) ? data.response_style : defaults.response_style,
    timezone: firstString(data?.timezone) ?? defaults.timezone,
    cooldown_seconds: Math.max(0, Math.min(300, Number(data?.cooldown_seconds ?? defaults.cooldown_seconds))),
    max_replies_per_10m: Math.max(1, Math.min(50, Number(data?.max_replies_per_10m ?? defaults.max_replies_per_10m))),
    custom_instruction: firstString(data?.custom_instruction),
  };
}

function localClock(date: Date, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${String(parts.hour ?? "00").padStart(2, "0")}:${String(parts.minute ?? "00").padStart(2, "0")}`;
}

export function isQuietNow(profile: DestinationProfile, now = new Date()) {
  if (!profile.quiet_hours_enabled || !profile.quiet_start || !profile.quiet_end) return false;
  const current = localClock(now, profile.timezone);
  const start = profile.quiet_start.slice(0, 5);
  const end = profile.quiet_end.slice(0, 5);
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export async function loadConversationState(supabase: any, instanceId: string, remoteJid: string, destinationType: DestinationType, destinationId: string, fallbackMode: ConversationMode) {
  const { data: existing, error } = await supabase
    .from("atis_conversation_state")
    .select("*")
    .eq("instance_id", instanceId)
    .eq("remote_jid", remoteJid)
    .maybeSingle();
  if (error) throw error;
  if (existing) {
    if (!existing.destination_type || !existing.destination_id) {
      await supabase.from("atis_conversation_state").update({ destination_type: destinationType, destination_id: destinationId, updated_at: new Date().toISOString() }).eq("id", existing.id);
    }
    return existing;
  }
  const { data, error: insertError } = await supabase.from("atis_conversation_state").insert({
    instance_id: instanceId,
    remote_jid: remoteJid,
    destination_type: destinationType,
    destination_id: destinationId,
    conversation_mode: fallbackMode,
    memory: {},
    pending_action: {},
    reply_window_count: 0,
  }).select("*").single();
  if (insertError) throw insertError;
  return data;
}

export async function setConversationMode(supabase: any, stateId: string, mode: ConversationMode) {
  const { error } = await supabase.from("atis_conversation_state").update({ conversation_mode: mode, updated_at: new Date().toISOString() }).eq("id", stateId);
  if (error) throw error;
}

export function conversationModeCommand(message: string): { mode: ConversationMode; text: string } | null {
  const q = normalize(message).replace(/^atis[,:\s-]*/i, "");
  if (/^(modo\s+)?(estudo|estudar|aprofundado)$/.test(q) || /ativar modo estudo/.test(q)) {
    return { mode: "study", text: "📚 *Modo Estudo ativado.* Vou responder com mais contexto, conexões bíblicas, aplicação e perguntas para aprofundamento quando fizer sentido." };
  }
  if (/^(modo\s+)?(curto|conciso|resumido)$/.test(q) || /ativar modo (curto|conciso)/.test(q)) {
    return { mode: "concise", text: "⚡ *Modo Conciso ativado.* Vou priorizar respostas curtas e diretas para WhatsApp." };
  }
  if (/^(modo\s+)?(normal|padrao)$/.test(q) || /voltar (ao )?modo normal/.test(q)) {
    return { mode: "normal", text: "✅ *Modo Normal ativado.* Voltei ao equilíbrio entre objetividade e explicação." };
  }
  return null;
}

export async function consumeReplyBudget(supabase: any, instanceId: string, remoteJid: string, profile: DestinationProfile) {
  const { data, error } = await supabase.rpc("atis_check_reply_budget", {
    _instance_id: instanceId,
    _remote_jid: remoteJid,
    _cooldown_seconds: profile.cooldown_seconds,
    _max_replies_per_10m: profile.max_replies_per_10m,
    _now: new Date().toISOString(),
  });
  if (error) throw error;
  return data ?? { allowed: true, reason: "OK" };
}

export function isPrayerIntent(message: string) {
  const q = normalize(message);
  return /\b(pedido de oracao|pedido de oração|ore por|ora por|orar por mim|ore por mim|oracao por mim|oração por mim|quero pedir oracao|quero pedir oração)\b/.test(q);
}

export function prayerContent(message: string) {
  const raw = message.trim();
  const cleaned = raw
    .replace(/^atis[,:\s-]*/i, "")
    .replace(/^(quero\s+)?(fazer\s+)?(um\s+)?pedido\s+de\s+ora[cç][aã]o[,:\s-]*/i, "")
    .replace(/^ore\s+por[,:\s-]*/i, "")
    .replace(/^ora\s+por[,:\s-]*/i, "")
    .trim();
  return cleaned.length >= 3 ? cleaned.slice(0, 4000) : raw.slice(0, 4000);
}

export function confirmationCommand(message: string) {
  const q = normalize(message);
  if (/^(confirmar|confirmo|sim confirmar|sim)$/.test(q)) return "confirm" as const;
  if (/^(cancelar|cancela|nao|não)$/.test(q)) return "cancel" as const;
  return null;
}

export async function startPrayerConfirmation(supabase: any, stateId: string, content: string) {
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { error } = await supabase.from("atis_conversation_state").update({
    pending_action: { type: "prayer_request", content: content.slice(0, 4000), expires_at: expiresAt },
    updated_at: new Date().toISOString(),
  }).eq("id", stateId);
  if (error) throw error;
  return "🙏 Posso registrar esse *pedido de oração* no painel privado do ATIS para a liderança acompanhar.\n\nPor privacidade, ele não será publicado no grupo nem enviado para outros contatos.\n\nResponda *CONFIRMAR* para registrar ou *CANCELAR* para desistir.";
}

export async function resolvePendingPrayer(supabase: any, state: any, command: "confirm" | "cancel", context: {
  instanceId: string;
  remoteJid: string;
  senderName: string | null;
  destinationType: DestinationType;
  destinationId: string;
}) {
  const pending = state?.pending_action ?? {};
  if (pending?.type !== "prayer_request") return null;
  const expires = firstString(pending.expires_at);
  if (expires && new Date(expires).getTime() < Date.now()) {
    await supabase.from("atis_conversation_state").update({ pending_action: {}, updated_at: new Date().toISOString() }).eq("id", state.id);
    return "⌛ A confirmação anterior expirou. Envie novamente o pedido de oração para começar de novo.";
  }
  if (command === "cancel") {
    await supabase.from("atis_conversation_state").update({ pending_action: {}, updated_at: new Date().toISOString() }).eq("id", state.id);
    return "✅ Tudo bem. O pedido não foi registrado.";
  }
  const content = firstString(pending.content);
  if (!content) return null;
  const payload: Json = {
    instance_id: context.instanceId,
    source_remote_jid: context.remoteJid,
    sender_name: context.senderName,
    content,
    is_private: true,
    consent_confirmed_at: new Date().toISOString(),
    status: "pending",
    contact_id: context.destinationType === "contact" ? context.destinationId : null,
    individual_id: context.destinationType === "individual" ? context.destinationId : null,
  };
  const { error } = await supabase.from("atis_prayer_requests").insert(payload);
  if (error) throw error;
  await supabase.from("atis_conversation_state").update({ pending_action: {}, updated_at: new Date().toISOString() }).eq("id", state.id);
  return "🙏 *Pedido de oração registrado com sua confirmação.* Ele ficará privado no painel do ATIS para acompanhamento da liderança.";
}

export function continueInAppLink(route: string, reference?: string | null) {
  const base = "https://biblia.atalaias.online";
  if (route === "harpa_lookup" || route === "harpa_study") return `${base}/harpa`;
  if (route === "canticos_info") return `${base}/canticos`;
  if (route === "culto_info") return `${base}/harpa`;
  if (["bible_lookup", "ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline"].includes(route)) return `${base}/biblia`;
  if (route === "birthdays") return base;
  if (route === "daily_verse" || route === "devotional") return base;
  return reference ? `${base}/biblia` : base;
}

export function appendContinueInApp(text: string, route: string, enabled: boolean, reference?: string | null) {
  if (!enabled || /https?:\/\/biblia\.atalaias\.online/i.test(text)) return text;
  const link = continueInAppLink(route, reference);
  return `${text.trim()}\n\n📱 *Continue no app:*\n${link}`;
}

export function assistantButtons(route: string) {
  if (["bible_lookup", "ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline"].includes(route)) {
    return [
      { id: "atis:mode:study", text: "📚 Modo Estudo" },
      { id: "atis:devotional", text: "🌿 Devocional" },
      { id: "atis:app", text: "📱 Abrir app" },
    ];
  }
  if (route === "harpa_lookup" || route === "harpa_study" || route === "canticos_info") {
    return [
      { id: "atis:app", text: "📱 Abrir app" },
      { id: "atis:mode:study", text: "📚 Modo Estudo" },
    ];
  }
  return [
    { id: "atis:mode:study", text: "📚 Modo Estudo" },
    { id: "atis:app", text: "📱 Abrir app" },
  ];
}

export function normalizeButtonCommand(message: string) {
  const value = message.trim().toLowerCase();
  const plain = normalize(message).replace(/^[^a-z0-9]+/g, "");
  if (value === "atis:mode:study" || plain.includes("modo estudo")) return "modo estudo";
  if (value === "atis:devotional" || plain.includes("devocional")) return "reflexão devocional";
  if (value === "atis:app" || plain.includes("abrir app")) return "__ATIS_OPEN_APP__";
  return message;
}

export function unansweredReason(text: string, route: string) {
  const q = normalize(text);
  if (/nao consegui identificar uma referencia biblica completa|não consegui identificar uma referência bíblica completa/.test(q)) return "input_incomplete";
  if (/preciso de um culto lembrado|preciso que o usuario escolha um item|preciso que o usuário escolha um item|faltam dados|dados suficientes/.test(q)) return "grounding_missing";
  if (/nao encontrei|não encontrei|nao foi encontrado|não foi encontrado|nao possui letra disponivel|não possui letra disponível/.test(q)) return "lookup_not_found";
  if (/nao sei|não sei|nao consegui responder|não consegui responder|nao tenho informacao|não tenho informação|nao tenho certeza|não tenho certeza|nao posso confirmar|não posso confirmar/.test(q)) return "assistant_uncertain";
  return null;
}

export function looksUnanswered(text: string, route: string) {
  return unansweredReason(text, route) !== null;
}

export function runtimeFailureReason(message: string) {
  const value = String(message ?? "").trim().toUpperCase();
  if (value.includes("AI_PROVIDER_UNAVAILABLE")) return "ai_provider_unavailable";
  if (value.includes("AI_EMPTY_RESPONSE")) return "ai_empty_response";
  if (value.includes("EVOLUTION_") || value.includes("EVOLUTION API")) return "delivery_unavailable";
  if (value.includes("APP_") || value.includes("SOURCE_")) return "source_unavailable";
  return "runtime_error";
}

export async function rememberAnswer(supabase: any, stateId: string, route: string, reference: string | null | undefined, userMessage: string) {
  const memory = {
    last_route: route,
    last_reference: reference ?? null,
    last_user_topic: userMessage.slice(0, 500),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("atis_conversation_state").update({ last_route: route, memory, updated_at: new Date().toISOString() }).eq("id", stateId);
  if (error) throw error;
}

export async function recordUnanswered(supabase: any, input: {
  inboundId: string;
  destinationType: DestinationType;
  destinationId: string;
  question: string;
  route?: string | null;
  answer?: string | null;
  reason: string;
}) {
  const { error } = await supabase.rpc("atis_record_unanswered", {
    _inbound_message_id: input.inboundId,
    _destination_type: input.destinationType,
    _destination_id: input.destinationId,
    _question: input.question.slice(0, 5000),
    _route: input.route ?? null,
    _answer: input.answer?.slice(0, 5000) ?? null,
    _reason: input.reason,
  });
  if (error) throw error;
}
