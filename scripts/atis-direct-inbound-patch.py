from pathlib import Path

path = Path("supabase/functions/atis-webhook/index.ts")
text = path.read_text()

IMPORT_ANCHOR = 'import { structuredConversationContext } from "../_shared/atis/context-memory.ts";\n'
DIRECT_IMPORT = 'import { directPhoneCandidates, inboundSessionDestinationId, preferredPhoneMatch } from "../_shared/atis/direct-recipient.ts";\n'
if DIRECT_IMPORT not in text:
    if IMPORT_ANCHOR not in text:
        raise SystemExit("context-memory import anchor not found")
    text = text.replace(IMPORT_ANCHOR, IMPORT_ANCHOR + DIRECT_IMPORT, 1)

phone_start = text.index("function remoteJidPhone(remoteJid: string) {")
phone_end_anchor = "\n}\n\nfunction normalizeInboundCommand"
phone_end = text.index(phone_end_anchor, phone_start)
text = (
    text[:phone_start]
    + 'function remoteJidPhone(remoteJid: string) {\n  return directPhoneCandidates(remoteJid)[0] ?? null;'
    + text[phone_end:]
)

policy_start = text.index("async function resolveDestinationAiPolicy(supabase: any, instance: any, remoteJid: string) {")
policy_end = text.index("async function sendReplyWithProfile", policy_start)
helper_and_policy = r'''async function findDirectRecipient(supabase: any, remoteJid: string) {
  const phoneCandidates = directPhoneCandidates(remoteJid);
  if (!phoneCandidates.length) return null;

  const { data: contacts, error: contactError } = await supabase
    .from("atis_contacts")
    .select("id,user_id,name,phone_e164,blocked,is_active,whatsapp_opt_in,reactivation_requires_app")
    .in("phone_e164", phoneCandidates);
  if (contactError) throw contactError;
  const contact = preferredPhoneMatch(contacts, phoneCandidates);
  if (contact) return { type: "contact" as const, record: contact, phoneCandidates };

  const { data: individuals, error: individualError } = await supabase
    .from("atis_individuals")
    .select("id,name,phone_e164,blocked,is_active,allow_messages")
    .in("phone_e164", phoneCandidates);
  if (individualError) throw individualError;
  const individual = preferredPhoneMatch(individuals, phoneCandidates);
  if (individual) return { type: "individual" as const, record: individual, phoneCandidates };

  return null;
}

async function resolveDestinationAiPolicy(supabase: any, instance: any, remoteJid: string) {
  let type: DestinationType | null = null;
  let id: string | null = null;
  let blocked = false;
  let transientDirect = false;
  let matchedPhone: string | null = null;

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
      return { destinationType: null, destinationId: null, blocked: true, allowedAiRoutes: [] as string[], transientDirect: false, matchedPhone: null };
    }
    type = "group";
    id = data.id;
  } else {
    const known = await findDirectRecipient(supabase, remoteJid);
    if (known?.type === "contact") {
      type = "contact";
      id = known.record.id;
      matchedPhone = known.record.phone_e164 ?? null;
      blocked = known.record.blocked === true
        || known.record.is_active !== true
        || known.record.whatsapp_opt_in !== true
        || known.record.reactivation_requires_app === true;
    } else if (known?.type === "individual") {
      type = "individual";
      id = known.record.id;
      matchedPhone = known.record.phone_e164 ?? null;
      blocked = known.record.blocked === true
        || known.record.is_active !== true
        || known.record.allow_messages !== true;
    } else {
      // Self-initiated private conversations are allowed without creating an
      // outbound recipient. This UUID exists only for state/rate-limit/history.
      type = "individual";
      id = await inboundSessionDestinationId(remoteJid);
      transientDirect = true;
    }
  }

  if (!type || !id) {
    return { destinationType: null, destinationId: null, blocked: true, allowedAiRoutes: [] as string[], transientDirect: false, matchedPhone };
  }
  if (blocked) {
    return { destinationType: type, destinationId: id, blocked: true, allowedAiRoutes: [] as string[], transientDirect: false, matchedPhone };
  }
  if (transientDirect) {
    return { destinationType: type, destinationId: id, blocked: false, allowedAiRoutes: [...AI_FEATURE_KEYS], transientDirect: true, matchedPhone: null };
  }

  const column = type === "contact" ? "contact_id" : type === "individual" ? "individual_id" : "group_id";
  const { data: rows, error } = await supabase
    .from("atis_destination_feature_settings")
    .select("feature_key,enabled")
    .eq("destination_type", type)
    .eq(column, id)
    .eq("feature_kind", "ai");
  if (error) throw error;

  const stored = new Map((rows ?? []).map((row: any) => [row.feature_key, row.enabled === true]));
  const defaultEnabled = true;
  const allowedAiRoutes = AI_FEATURE_KEYS.filter((key) => stored.has(key) ? stored.get(key) === true : defaultEnabled);
  return { destinationType: type, destinationId: id, blocked: false, allowedAiRoutes, transientDirect: false, matchedPhone };
}

'''
text = text[:policy_start] + helper_and_policy + text[policy_end:]

optout_start = text.index("    if (!isGroup && isContactOptOutCommand(limitedText)) {")
optout_end = text.index("    const autoReplyAllowed", optout_start)
new_optout = r'''    if (!isGroup && isContactOptOutCommand(limitedText)) {
      const known = await findDirectRecipient(supabase, remoteJid);
      const now = new Date().toISOString();
      let confirmation = "✅ Tudo certo. Este número não está cadastrado para envios automáticos do ATIS, então não há assinatura ativa para cancelar. 🙏";
      let action = "guest_no_subscription";
      let recipientId: string | null = null;

      if (known?.type === "contact") {
        const contact = known.record;
        recipientId = contact.id;
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
        confirmation = "✅ Pronto! Você não receberá mais mensagens automáticas do ATIS. Para reativar, abra o app *A Bíblia do Atalaia* → *Perfil* → *Notificações no WhatsApp* e autorize novamente. 🙏";
        action = "contact_opt_out";
      } else if (known?.type === "individual") {
        recipientId = known.record.id;
        const { error: individualError } = await supabase.from("atis_individuals").update({ allow_messages: false }).eq("id", known.record.id);
        if (individualError) throw individualError;
        await supabase.from("atis_message_targets").update({
          status: "cancelled",
          last_error_code: "INDIVIDUAL_OPTED_OUT",
          last_error_message: "Recipient sent SAIR.",
          updated_at: now,
        }).eq("individual_id", known.record.id).eq("status", "pending");
        confirmation = "✅ Pronto! Os envios automáticos do ATIS para este número foram desativados. 🙏";
        action = "individual_opt_out";
      }

      if (!evolution) {
        const config = getEvolutionConfigFromEnv();
        evolution = new EvolutionProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey });
      }
      const sent = await evolution.sendText(providerInstanceName, directProviderTarget(remoteJid), confirmation);
      await supabase.from("atis_inbound_messages").update({
        assistant_route: null,
        response_text: confirmation,
        status: "replied",
        processed_at: now,
        error: null,
        metadata: { action, recipient_id: recipientId, provider_response_message_id: sent.providerMessageId ?? null },
      }).eq("id", inbound.id);
      counts.replied++;
      continue;
    }

'''
text = text[:optout_start] + new_optout + text[optout_end:]

confirmation_old = '      } else if (!isGroup && confirmation && state?.pending_action?.type === "prayer_request") {'
confirmation_new = '      } else if (!isGroup && policy.transientDirect !== true && confirmation && state?.pending_action?.type === "prayer_request") {'
if confirmation_old not in text:
    raise SystemExit("pending prayer confirmation anchor not found")
text = text.replace(confirmation_old, confirmation_new, 1)

start_prayer = '          specialReply = await startPrayerConfirmation(supabase, state.id, prayerContent(commandText));'
if text.count(start_prayer) != 1:
    raise SystemExit(f"expected one startPrayerConfirmation call, got {text.count(start_prayer)}")
text = text.replace(
    start_prayer,
    '''          specialReply = policy.transientDirect === true
            ? "🙏 Recebi seu pedido. Posso conversar com você por aqui normalmente. Para *registrar* um pedido de oração no painel privado para acompanhamento da liderança, primeiro vincule e autorize este WhatsApp no app *A Bíblia do Atalaia*."
            : await startPrayerConfirmation(supabase, state.id, prayerContent(commandText));''',
    1,
)

special_metadata = 'metadata: { destination_type: destinationType, destination_id: destinationId, provider_response_message_id: delivery.sent?.providerMessageId ?? null, special_action: specialRoute }'
if special_metadata not in text:
    raise SystemExit("special metadata anchor not found")
text = text.replace(
    special_metadata,
    'metadata: { destination_type: destinationType, destination_id: destinationId, provider_response_message_id: delivery.sent?.providerMessageId ?? null, special_action: specialRoute, transient_direct: policy.transientDirect === true, matched_phone: policy.matchedPhone ?? null }',
    1,
)

normal_metadata = '          context_memory_reason: structuredContext.reason,\n'
if normal_metadata not in text:
    raise SystemExit("normal metadata anchor not found")
text = text.replace(
    normal_metadata,
    normal_metadata + '          transient_direct: policy.transientDirect === true,\n          matched_phone: policy.matchedPhone ?? null,\n',
    1,
)

path.write_text(text)
