import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { runAtisAssistant } from "../_shared/atis/assistant.ts";
import { EvolutionProvider, getEvolutionConfigFromEnv } from "../_shared/atis/evolution-provider.ts";
import {
  appendContinueInApp,
  assistantButtons,
  confirmationCommand,
  consumeReplyBudget,
  conversationModeCommand,
  isPrayerIntent,
  isQuietNow,
  loadConversationState,
  loadDestinationProfile,
  looksUnanswered,
  normalizeButtonCommand,
  prayerContent,
  recordUnanswered,
  rememberAnswer,
  resolvePendingPrayer,
  setConversationMode,
  startPrayerConfirmation,
  type DestinationProfile,
  type DestinationType as ConversationDestinationType,
} from "../_shared/atis/conversation-runtime.ts";

type Json = Record<string, any>;
type AtisStatus = "disconnected" | "connecting" | "qr_required" | "connected" | "error" | "unknown";
type DestinationType = "contact" | "individual" | "group";

const MAX_BODY_BYTES = 1024 * 1024;
const AI_FEATURE_KEYS = ["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizeEvent(value: unknown) {
  return String(value ?? "UNKNOWN")
    .trim()
    .replace(/[.-]/g, "_")
    .toUpperCase();
}

function normalizeState(raw: unknown): AtisStatus {
  const state = String(raw ?? "").trim().toLowerCase();
  if (["open", "connected", "online", "ready"].includes(state)) return "connected";
  if (["connecting", "opening"].includes(state)) return "connecting";
  if (["qrcode", "qr", "qr_required", "pairing"].includes(state)) return "qr_required";
  if (["close", "closed", "disconnected", "offline", "logout"].includes(state)) return "disconnected";
  if (["error", "failed"].includes(state)) return "error";
  return "unknown";
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function secureEqual(left: string, right: string) {
  const [a, b] = await Promise.all([sha256Hex(left), sha256Hex(right)]);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function qrCount(data: any): number | null {
  const value = data?.count ?? data?.qrcode?.count;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function messageEntries(data: any) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.updates)) return data.updates;
  return data && typeof data === "object" ? [data] : [];
}

function messageId(item: any) {
  return firstString(
    item?.key?.id,
    item?.id,
    item?.messageId,
    item?.update?.key?.id,
    item?.message?.key?.id,
  );
}

function messageProviderStatus(item: any) {
  return firstString(
    item?.status,
    item?.ack,
    item?.update?.status,
    item?.update?.ack,
    item?.message?.status,
  );
}

function inboundRemoteJid(item: any) {
  return firstString(item?.key?.remoteJid, item?.remoteJid, item?.message?.key?.remoteJid);
}

function inboundFromMe(item: any) {
  return item?.key?.fromMe === true || item?.fromMe === true || item?.message?.key?.fromMe === true;
}

function inboundText(item: any) {
  const message = item?.message ?? item?.data?.message ?? {};
  return firstString(
    message?.conversation,
    message?.extendedTextMessage?.text,
    message?.imageMessage?.caption,
    message?.videoMessage?.caption,
    message?.buttonsResponseMessage?.selectedDisplayText,
    message?.buttonsResponseMessage?.selectedButtonId,
    message?.listResponseMessage?.title,
    item?.text,
    item?.body,
  );
}

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

function inboundSenderName(item: any) {
  return firstString(item?.pushName, item?.senderName, item?.notifyName, item?.data?.pushName);
}

function directProviderTarget(remoteJid: string) {
  if (remoteJid.endsWith("@s.whatsapp.net")) return remoteJid.replace(/@s\.whatsapp\.net$/i, "");
  return remoteJid;
}

function remoteJidPhone(remoteJid: string) {
  if (remoteJid.endsWith("@g.us")) return null;
  const digits = directProviderTarget(remoteJid).replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

function normalizeInboundCommand(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[.!?]+$/g, "").trim();
}

function isContactOptOutCommand(value: string) {
  return normalizeInboundCommand(value) === "sair";
}

function safePayload(event: string, body: Json) {
  const data = body?.data;
  const base: Json = {
    event,
    instance: firstString(body?.instance),
    date_time: firstString(body?.date_time, body?.dateTime),
  };

  if (event === "QRCODE_UPDATED") {
    return { ...base, data: { count: qrCount(data) } };
  }

  if (event === "CONNECTION_UPDATE" || event === "STATUS_INSTANCE" || event === "LOGOUT_INSTANCE") {
    return {
      ...base,
      data: {
        state: firstString(data?.state, data?.status, data?.connection, body?.state),
        status_reason: firstString(data?.statusReason, data?.reason, data?.lastDisconnect?.error?.message),
      },
    };
  }

  if (["MESSAGES_UPDATE", "SEND_MESSAGE_UPDATE", "SEND_MESSAGE", "MESSAGES_UPSERT"].includes(event)) {
    return {
      ...base,
      data: messageEntries(data).slice(0, 50).map((item: any) => ({
        message_id: messageId(item),
        status: messageProviderStatus(item),
        remote_jid: inboundRemoteJid(item),
        from_me: inboundFromMe(item),
        has_text: Boolean(inboundText(item)),
      })),
    };
  }

  if (event.startsWith("CONTACTS_")) {
    const items = Array.isArray(data) ? data : Array.isArray(data?.contacts) ? data.contacts : data ? [data] : [];
    return {
      ...base,
      data: {
        count: items.length,
        ids: items.slice(0, 50).map((item: any) => firstString(item?.id, item?.remoteJid, item?.jid)).filter(Boolean),
      },
    };
  }

  if (event.startsWith("GROUP")) {
    const items = Array.isArray(data) ? data : Array.isArray(data?.groups) ? data.groups : data ? [data] : [];
    return {
      ...base,
      data: {
        count: items.length,
        ids: items.slice(0, 50).map((item: any) => firstString(item?.id, item?.jid, item?.remoteJid, item?.groupJid)).filter(Boolean),
      },
    };
  }

  return { ...base, data: { received: true } };
}

async function markDeliveryMetadata(supabase: any, event: string, data: any) {
  let matched = 0;
  for (const item of messageEntries(data).slice(0, 100)) {
    const id = messageId(item);
    if (!id) continue;
    const providerStatus = messageProviderStatus(item);
    const { data: targets, error } = await supabase
      .from("atis_message_targets")
      .select("id,metadata")
      .eq("provider_message_id", id);
    if (error) throw error;

    for (const target of targets ?? []) {
      const { error: updateError } = await supabase
        .from("atis_message_targets")
        .update({
          metadata: {
            ...(target.metadata ?? {}),
            provider_delivery: {
              event,
              status: providerStatus,
              updated_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", target.id);
      if (updateError) throw updateError;
      matched++;
    }
  }
  return matched;
}

async function assistantRuntime(supabase: any) {
  const { data, error } = await supabase.from("atis_settings").select("value").eq("key", "assistant").maybeSingle();
  if (error) throw error;
  return {
    enabled: data?.value?.enabled !== false,
    autoReplyDirect: data?.value?.auto_reply_direct !== false,
    autoReplyGroups: data?.value?.auto_reply_groups !== false,
    groupMentionOnly: data?.value?.group_mention_only === true,
    maxInboundChars: Math.max(100, Math.min(10000, Number(data?.value?.max_inbound_chars ?? 5000))),
    historyInteractions: Math.max(20, Math.min(50, Number(data?.value?.history_messages ?? 20))),
  };
}

async function loadConversationHistory(supabase: any, instanceId: string, remoteJid: string, limit: number) {
  const { data, error } = await supabase
    .from("atis_inbound_messages")
    .select("message_text,response_text,received_at")
    .eq("instance_id", instanceId)
    .eq("remote_jid", remoteJid)
    .eq("status", "replied")
    .not("response_text", "is", null)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const row of [...(data ?? [])].reverse()) {
    const userText = firstString(row.message_text);
    const assistantText = firstString(row.response_text);
    if (userText) history.push({ role: "user", content: userText.slice(0, 1800) });
    if (assistantText) history.push({ role: "assistant", content: assistantText.slice(0, 2200) });
  }
  return history;
}

async function resolveDestinationAiPolicy(supabase: any, instance: any, remoteJid: string) {
  let type: DestinationType | null = null;
  let id: string | null = null;
  let blocked = false;

  if (remoteJid.endsWith("@g.us")) {
    const { data, error } = await supabase
      .from("atis_groups")
      .select("id,is_active,provider_exists")
      .eq("instance_id", instance.id)
      .eq("provider_group_id", remoteJid)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.provider_exists === false) {
      return { destinationType: null, destinationId: null, blocked: true, allowedAiRoutes: [] as string[] };
    }
    type = "group";
    id = data.id;
  } else {
    const phone = remoteJidPhone(remoteJid);
    if (phone) {
      const { data: contact, error: contactError } = await supabase
        .from("atis_contacts")
        .select("id,blocked,is_active,whatsapp_opt_in,reactivation_requires_app")
        .eq("phone_e164", phone)
        .eq("is_active", true)
        .maybeSingle();
      if (contactError) throw contactError;
      if (contact) {
        type = "contact";
        id = contact.id;
        blocked = contact.blocked === true || contact.whatsapp_opt_in !== true || contact.reactivation_requires_app === true;
      } else {
        const { data: individual, error: individualError } = await supabase
          .from("atis_individuals")
          .select("id,blocked,is_active,allow_messages")
          .eq("phone_e164", phone)
          .eq("is_active", true)
          .maybeSingle();
        if (individualError) throw individualError;
        if (individual) {
          type = "individual";
          id = individual.id;
          blocked = individual.blocked === true || individual.allow_messages !== true;
        }
      }
    }
  }

  // Unknown numbers are never auto-enrolled. Only app contacts and admin-created individuals
  // may use the assistant automatically.
  if (!type || !id) return { destinationType: null, destinationId: null, blocked: true, allowedAiRoutes: [] as string[] };
  if (blocked) return { destinationType: type, destinationId: id, blocked: true, allowedAiRoutes: [] as string[] };

  const column = type === "contact" ? "contact_id" : type === "individual" ? "individual_id" : "group_id";
  const { data: rows, error } = await supabase
    .from("atis_destination_feature_settings")
    .select("feature_key,enabled")
    .eq("destination_type", type)
    .eq(column, id)
    .eq("feature_kind", "ai");
  if (error) throw error;

  const stored = new Map((rows ?? []).map((row: any) => [row.feature_key, row.enabled === true]));
  // Synced active groups use the assistant by default. Explicit per-group false rows still win.
  const defaultEnabled = true;
  const allowedAiRoutes = AI_FEATURE_KEYS.filter((key) => stored.has(key) ? stored.get(key) === true : defaultEnabled);
  return { destinationType: type, destinationId: id, blocked: false, allowedAiRoutes };
}


async function sendReplyWithProfile(
  provider: EvolutionProvider,
  instanceName: string,
  target: string,
  text: string,
  profile: DestinationProfile,
  route: string | null,
  withButtons = false,
) {
  let sent: any = null;
  let usedButtons = false;
  if (withButtons && profile.enable_buttons && route) {
    try {
      sent = await provider.sendButtons(instanceName, target, text, assistantButtons(route));
      usedButtons = true;
    } catch (error) {
      console.error("[atis-webhook] interactive buttons failed; falling back to text", error instanceof Error ? error.message : error);
    }
  }
  if (!sent) sent = await provider.sendText(instanceName, target, text);

  let audioSent = false;
  if (profile.enable_audio && text.length <= 1800) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (supabaseUrl && serviceKey) {
        const cleanText = text.replace(/https?:\/\/\S+/g, "").replace(/[\*_`>#]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200);
        if (cleanText.length >= 8) {
          const response = await fetch(`${supabaseUrl}/functions/v1/tts-verse`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
            body: JSON.stringify({ text: cleanText }),
          });
          if (response.ok) {
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length > 44 && bytes.length < 8_000_000) {
              await provider.sendAudio(instanceName, target, bytes, response.headers.get("content-type") || "audio/wav");
              audioSent = true;
            }
          } else {
            console.error("[atis-webhook] optional TTS unavailable", response.status);
          }
        }
      }
    } catch (error) {
      console.error("[atis-webhook] optional audio reply failed", error instanceof Error ? error.message : error);
    }
  }
  return { sent, usedButtons, audioSent };
}
async function processInboundMessages(supabase: any, instance: any, data: any) {
  const runtime = await assistantRuntime(supabase);
  if (!runtime.enabled) return { received: 0, replied: 0, ignored: 0, failed: 0 };

  let evolution: EvolutionProvider | null = null;
  let ownerMentionIds: string[] | null = null;
  const counts = { received: 0, replied: 0, ignored: 0, failed: 0 };
  const providerInstanceName = instance.external_instance_name || instance.name;

  for (const item of messageEntries(data).slice(0, 20)) {
    const providerMessageId = messageId(item);
    const remoteJid = inboundRemoteJid(item);
    const rawText = inboundText(item);
    if (!providerMessageId || !remoteJid || !rawText || inboundFromMe(item)) {
      counts.ignored++;
      continue;
    }

    const isGroup = remoteJid.endsWith("@g.us");
    const limitedText = rawText.slice(0, runtime.maxInboundChars);
    const commandText = normalizeButtonCommand(limitedText);
    const senderName = inboundSenderName(item);
    const { data: inbound, error: insertError } = await supabase
      .from("atis_inbound_messages")
      .insert({
        instance_id: instance.id,
        provider_message_id: providerMessageId,
        remote_jid: remoteJid,
        sender_name: senderName,
        message_text: limitedText,
        is_group: isGroup,
        status: "received",
        metadata: { truncated: rawText.length > limitedText.length },
      })
      .select("id")
      .single();

    if (insertError?.code === "23505") { counts.ignored++; continue; }
    if (insertError) throw insertError;
    counts.received++;

    if (!isGroup && isContactOptOutCommand(limitedText)) {
      const phone = remoteJidPhone(remoteJid);
      if (phone) {
        const { data: contact, error: contactError } = await supabase
          .from("atis_contacts")
          .select("id,user_id,name,phone_e164")
          .eq("source", "app")
          .eq("phone_e164", phone)
          .maybeSingle();
        if (contactError) throw contactError;
        if (contact) {
          const now = new Date().toISOString();
          if (contact.user_id) {
            const { error: profileError } = await supabase.from("profiles").update({ whatsapp_opt_in: false }).eq("user_id", contact.user_id);
            if (profileError) throw profileError;
          }
          const { error: contactUpdateError } = await supabase.from("atis_contacts").update({
            whatsapp_opt_in: false,
            opt_out_at: now,
            opt_out_source: "whatsapp_keyword",
            reactivation_requires_app: true,
            consent_updated_at: now,
          }).eq("id", contact.id);
          if (contactUpdateError) throw contactUpdateError;
          await supabase.from("atis_message_targets").update({
            status: "cancelled",
            last_error_code: "CONTACT_OPTED_OUT",
            last_error_message: "Recipient sent SAIR. Reactivation is allowed only from the app.",
            updated_at: now,
          }).eq("contact_id", contact.id).eq("status", "pending");
          const confirmation = "✅ Pronto! Você não receberá mais mensagens do ATIS. Para reativar, abra o app *A Bíblia do Atalaia* → *Perfil* → *Notificações no WhatsApp* e autorize novamente. 🙏";
          if (!evolution) { const config = getEvolutionConfigFromEnv(); evolution = new EvolutionProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey }); }
          const sent = await evolution.sendText(providerInstanceName, directProviderTarget(remoteJid), confirmation);
          await supabase.from("atis_inbound_messages").update({ assistant_route: null, response_text: confirmation, status: "replied", processed_at: now, error: null, metadata: { action: "contact_opt_out", contact_id: contact.id, provider_response_message_id: sent.providerMessageId ?? null } }).eq("id", inbound.id);
          counts.replied++;
          continue;
        }
      }
    }

    const autoReplyAllowed = isGroup ? runtime.autoReplyGroups : runtime.autoReplyDirect;
    if (!autoReplyAllowed) {
      await supabase.from("atis_inbound_messages").update({ status: "ignored", processed_at: new Date().toISOString(), metadata: { policy: "auto_reply_disabled" } }).eq("id", inbound.id);
      counts.ignored++;
      continue;
    }

    let policyForFailure: any = null;
    try {
      const policy = await resolveDestinationAiPolicy(supabase, instance, remoteJid);
      policyForFailure = policy;
      if (policy.blocked || !policy.destinationType || !policy.destinationId) {
        await supabase.from("atis_inbound_messages").update({ status: "ignored", processed_at: new Date().toISOString(), metadata: { destination_type: policy.destinationType, destination_id: policy.destinationId, policy: "blocked_or_unknown" } }).eq("id", inbound.id);
        counts.ignored++;
        continue;
      }
      const destinationType = policy.destinationType as ConversationDestinationType;
      const destinationId = policy.destinationId as string;
      const profile = await loadDestinationProfile(supabase, destinationType, destinationId);
      const state = await loadConversationState(supabase, instance.id, remoteJid, destinationType, destinationId, profile.conversation_mode);

      if (isGroup && (runtime.groupMentionOnly || profile.mention_only)) {
        let addressedToAtis = textCallsAtis(limitedText);
        const mentionedJids = inboundMentionedJids(item);
        if (!addressedToAtis && mentionedJids.length > 0) {
          if (ownerMentionIds === null) {
            ownerMentionIds = providerOwnerMentionIds({ ownerJid: instance?.metadata?.owner_jid, owner: instance?.metadata?.owner, number: instance?.metadata?.owner_number });
            if (!ownerMentionIds.length) {
              try {
                if (!evolution) { const config = getEvolutionConfigFromEnv(); evolution = new EvolutionProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey }); }
                ownerMentionIds = providerOwnerMentionIds(await evolution.fetchInstances(providerInstanceName));
              } catch (error) {
                console.error("[atis-webhook] could not resolve own JID for group mention", error instanceof Error ? error.message : error);
                ownerMentionIds = [];
              }
            }
          }
          const mentioned = mentionedJids.map(normalizeMentionIdentity).filter(Boolean) as string[];
          addressedToAtis = mentioned.some((id) => ownerMentionIds?.includes(id));
        }
        if (!addressedToAtis) {
          await supabase.from("atis_inbound_messages").update({ status: "ignored", processed_at: new Date().toISOString(), metadata: { policy: "group_mention_only", destination_type: destinationType, destination_id: destinationId } }).eq("id", inbound.id);
          counts.ignored++;
          continue;
        }
      }

      if (isQuietNow(profile)) {
        await supabase.from("atis_inbound_messages").update({ status: "ignored", processed_at: new Date().toISOString(), metadata: { policy: "quiet_hours", destination_type: destinationType, destination_id: destinationId } }).eq("id", inbound.id);
        counts.ignored++;
        continue;
      }

      let specialReply: string | null = null;
      let specialRoute: string | null = null;
      const mode = conversationModeCommand(commandText);
      const confirmation = confirmationCommand(commandText);

      if (commandText === "__ATIS_OPEN_APP__") {
        specialReply = "📱 Continue na *Bíblia do Atalaia*:\nhttps://biblia.atalaias.online";
        specialRoute = "open_app";
      } else if (mode) {
        await setConversationMode(supabase, state.id, mode.mode);
        state.conversation_mode = mode.mode;
        specialReply = mode.text;
        specialRoute = "conversation_mode";
      } else if (!isGroup && confirmation && state?.pending_action?.type === "prayer_request") {
        specialReply = await resolvePendingPrayer(supabase, state, confirmation, { instanceId: instance.id, remoteJid, senderName, destinationType, destinationId });
        specialRoute = "prayer_request";
      } else if (isPrayerIntent(commandText)) {
        if (isGroup) {
          specialReply = "🙏 Para proteger sua privacidade, envie o pedido de oração *no privado do ATIS*. Eu só registro o pedido depois de pedir sua confirmação.";
        } else {
          specialReply = await startPrayerConfirmation(supabase, state.id, prayerContent(commandText));
        }
        specialRoute = "prayer_request";
      }

      const budget = await consumeReplyBudget(supabase, instance.id, remoteJid, profile);
      if (budget?.allowed !== true) {
        await supabase.from("atis_inbound_messages").update({ status: "ignored", processed_at: new Date().toISOString(), metadata: { policy: String(budget?.reason ?? "rate_limit").toLowerCase(), retry_after_seconds: budget?.retry_after_seconds ?? null, destination_type: destinationType, destination_id: destinationId } }).eq("id", inbound.id);
        counts.ignored++;
        continue;
      }

      if (!evolution) { const config = getEvolutionConfigFromEnv(); evolution = new EvolutionProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey }); }

      if (specialReply) {
        const delivery = await sendReplyWithProfile(evolution, providerInstanceName, directProviderTarget(remoteJid), specialReply, { ...profile, enable_audio: false }, specialRoute, false);
        await supabase.from("atis_inbound_messages").update({ assistant_route: specialRoute, response_text: specialReply, status: "replied", processed_at: new Date().toISOString(), error: null, metadata: { destination_type: destinationType, destination_id: destinationId, provider_response_message_id: delivery.sent?.providerMessageId ?? null, special_action: specialRoute } }).eq("id", inbound.id);
        counts.replied++;
        continue;
      }

      await supabase.from("atis_inbound_messages").update({ status: "processing" }).eq("id", inbound.id);
      const conversationHistory = await loadConversationHistory(supabase, instance.id, remoteJid, runtime.historyInteractions);
      const styleInstruction = [
        profile.response_style === "concise" ? "Prefira respostas curtas." : profile.response_style === "detailed" ? "Quando útil, dê uma explicação um pouco mais detalhada." : null,
        profile.custom_instruction,
      ].filter(Boolean).join(" ");
      const answer = await runAtisAssistant(supabase, commandText, {
        allowedAiRoutes: policy.allowedAiRoutes,
        conversationHistory,
        conversationMode: state.conversation_mode ?? profile.conversation_mode,
        destinationInstruction: styleInstruction || null,
      });
      const answerText = appendContinueInApp(answer.text, answer.route, profile.continue_in_app, answer.reference);
      const delivery = await sendReplyWithProfile(evolution, providerInstanceName, directProviderTarget(remoteJid), answerText, profile, answer.route, true);
      await rememberAnswer(supabase, state.id, answer.route, answer.reference, commandText);
      if (looksUnanswered(answerText, answer.route)) {
        await recordUnanswered(supabase, { inboundId: inbound.id, destinationType, destinationId, question: limitedText, route: answer.route, answer: answerText, reason: "assistant_uncertain" });
      }
      await supabase.from("atis_inbound_messages").update({
        assistant_route: answer.route,
        response_text: answerText,
        status: "replied",
        processed_at: new Date().toISOString(),
        error: null,
        metadata: {
          answer_source: answer.source,
          answer_reference: answer.reference ?? null,
          provider_response_message_id: delivery.sent?.providerMessageId ?? null,
          destination_type: destinationType,
          destination_id: destinationId,
          conversation_mode: state.conversation_mode ?? profile.conversation_mode,
          buttons_sent: delivery.usedButtons,
          audio_sent: delivery.audioSent,
          history_interactions_used: Math.floor(conversationHistory.length / 2),
          history_messages_used: conversationHistory.length,
        },
      }).eq("id", inbound.id);
      counts.replied++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "ATIS_ASSISTANT_INBOUND_ERROR";
      console.error("[atis-webhook] inbound assistant failed", message);
      await supabase.from("atis_inbound_messages").update({ status: "failed", error: message.slice(0, 500), processed_at: new Date().toISOString() }).eq("id", inbound.id);
      if (policyForFailure?.destinationType && policyForFailure?.destinationId) {
        try {
          await recordUnanswered(supabase, { inboundId: inbound.id, destinationType: policyForFailure.destinationType, destinationId: policyForFailure.destinationId, question: limitedText, reason: `error:${message.slice(0, 120)}` });
        } catch (recordError) {
          console.error("[atis-webhook] could not record unanswered", recordError instanceof Error ? recordError.message : recordError);
        }
      }
      counts.failed++;
    }
  }

  return counts;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);

  const suppliedSecret = req.headers.get("x-webhook-secret")?.trim() ?? "";
  if (!suppliedSecret) return json({ error: "UNAUTHORIZED" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: expectedSecret, error: secretError } = await supabase.rpc("atis_get_webhook_secret");
  if (secretError || typeof expectedSecret !== "string" || !expectedSecret) {
    console.error("[atis-webhook] webhook secret unavailable");
    return json({ error: "SERVER_AUTH_CONFIG_ERROR" }, 500);
  }

  if (!(await secureEqual(suppliedSecret, expectedSecret))) return json({ error: "FORBIDDEN" }, 403);

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);

  let body: Json;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const event = normalizeEvent(body?.event);
  const instanceName = firstString(body?.instance);
  if (!instanceName) return json({ error: "INSTANCE_REQUIRED" }, 400);

  try {
    const hash = await sha256Hex(raw);
    const providerEventId = `sha256:${hash}`;
    const { data: instance, error: instanceError } = await supabase
      .from("atis_instances")
      .select("*")
      .or(`name.eq.${instanceName},external_instance_name.eq.${instanceName}`)
      .limit(1)
      .maybeSingle();
    if (instanceError) throw instanceError;

    const payload = safePayload(event, body);
    const { data: inserted, error: insertError } = await supabase
      .from("atis_webhook_events")
      .insert({
        instance_id: instance?.id ?? null,
        provider_event_id: providerEventId,
        event_type: event,
        payload_hash: hash,
        payload,
        status: instance ? "received" : "ignored",
        ...(instance ? {} : { processed_at: new Date().toISOString(), error: "UNKNOWN_INSTANCE" }),
      })
      .select("id")
      .single();

    if (insertError?.code === "23505") return json({ ok: true, duplicate: true });
    if (insertError) throw insertError;
    if (!instance) return json({ ok: true, ignored: true, reason: "UNKNOWN_INSTANCE" });

    const now = new Date().toISOString();
    let deliveryMatches = 0;
    let inbound = { received: 0, replied: 0, ignored: 0, failed: 0 };

    if (event === "QRCODE_UPDATED") {
      const { error } = await supabase.from("atis_instances").update({
        status: "qr_required",
        last_status_check_at: now,
        metadata: {
          ...(instance.metadata ?? {}),
          provider_state: "qr_required",
          qr_updated_at: now,
          qr_count: qrCount(body?.data),
        },
      }).eq("id", instance.id);
      if (error) throw error;
    } else if (["CONNECTION_UPDATE", "STATUS_INSTANCE", "LOGOUT_INSTANCE"].includes(event)) {
      const providerState = firstString(body?.data?.state, body?.data?.status, body?.data?.connection, body?.state, event === "LOGOUT_INSTANCE" ? "logout" : null);
      const status = normalizeState(providerState);
      const patch: Json = {
        status,
        last_status_check_at: now,
        metadata: {
          ...(instance.metadata ?? {}),
          provider_state: providerState,
          last_provider_webhook_at: now,
        },
      };
      if (status === "connected" && instance.status !== "connected") patch.last_connected_at = now;
      if (status === "disconnected" && instance.status === "connected") patch.last_disconnected_at = now;
      const { error } = await supabase.from("atis_instances").update(patch).eq("id", instance.id);
      if (error) throw error;
    } else if (["MESSAGES_UPDATE", "SEND_MESSAGE_UPDATE", "SEND_MESSAGE"].includes(event)) {
      deliveryMatches = await markDeliveryMetadata(supabase, event, body?.data);
    } else if (event === "MESSAGES_UPSERT") {
      inbound = await processInboundMessages(supabase, instance, body?.data);
    } else if (event.startsWith("CONTACTS_") || event.startsWith("GROUP")) {
      const marker = event.startsWith("CONTACTS_") ? "contacts_sync_needed_at" : "groups_sync_needed_at";
      const { error } = await supabase.from("atis_instances").update({
        metadata: {
          ...(instance.metadata ?? {}),
          [marker]: now,
          last_provider_webhook_at: now,
        },
      }).eq("id", instance.id);
      if (error) throw error;
    }

    const { error: processedError } = await supabase.from("atis_webhook_events").update({
      status: "processed",
      processed_at: now,
      error: null,
    }).eq("id", inserted.id);
    if (processedError) throw processedError;

    return json({ ok: true, event, delivery_matches: deliveryMatches, inbound });
  } catch (error) {
    console.error("[atis-webhook] processing failed", error instanceof Error ? error.message : error);
    return json({ error: "WEBHOOK_PROCESSING_FAILED" }, 500);
  }
});
