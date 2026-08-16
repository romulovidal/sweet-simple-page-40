import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import {
  EvolutionProvider,
  EvolutionProviderError,
  getEvolutionConfigFromEnv,
} from "../_shared/atis/evolution-provider.ts";

type Json = Record<string, unknown>;

type ContactInput = {
  user_id?: string | null;
  name: string;
  phone_e164: string;
  source: "app" | "provider";
  provider_contact_id?: string | null;
  whatsapp_opt_in?: boolean;
  opt_in_source?: string | null;
  opt_in_at?: string | null;
  opt_out_at?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function chunks<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size));
  return output;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizePhone(value: unknown, defaultCountryCode = "55"): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  let raw = String(value).trim();
  if (!raw) return null;

  raw = raw
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/@lid$/i, "")
    .replace(/^00/, "+");

  if (/@g\.us$/i.test(raw) || /broadcast/i.test(raw) || /status/i.test(raw)) return null;

  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // App profiles currently store Brazilian DDD + number without +55.
  if ((digits.length === 10 || digits.length === 11) && defaultCountryCode) {
    digits = `${defaultCountryCode}${digits}`;
  }

  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

function jidToPhone(item: any, defaultCountryCode = "55") {
  return normalizePhone(
    firstString(
      item?.phoneNumber,
      item?.phone,
      item?.number,
      item?.remoteJid,
      item?.id,
      item?.jid,
    ),
    defaultCountryCode,
  );
}

function safeProviderMeta(item: any) {
  return {
    remote_jid: firstString(item?.remoteJid, item?.id, item?.jid),
    profile_pic_url: firstString(item?.profilePicUrl, item?.profilePictureUrl, item?.pictureUrl),
  };
}

async function readDefaultCountryCode(supabase: any) {
  const { data } = await supabase.from("atis_settings").select("value").eq("key", "defaults").maybeSingle();
  const configured = (data?.value as any)?.default_country_code;
  return typeof configured === "string" && /^\d{1,4}$/.test(configured) ? configured : "55";
}

async function loadInstance(supabase: any, input: Json) {
  let query = supabase.from("atis_instances").select("*").limit(1);
  if (typeof input.instance_id === "string" && input.instance_id) {
    query = query.eq("id", input.instance_id);
  } else if (typeof input.name === "string" && input.name) {
    query = query.eq("name", input.name);
  } else {
    query = query.eq("name", "atis-main");
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new EvolutionProviderError("ATIS instance not found", 404, "INSTANCE_NOT_FOUND");
  return data;
}

async function existingContactsByPhone(supabase: any, phones: string[]) {
  const map = new Map<string, any>();
  for (const batch of chunks([...new Set(phones)], 100)) {
    if (!batch.length) continue;
    const { data, error } = await supabase.from("atis_contacts").select("*").in("phone_e164", batch);
    if (error) throw error;
    for (const row of data ?? []) map.set(row.phone_e164, row);
  }
  return map;
}

async function syncAppContacts(supabase: any, defaultCountryCode: string) {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, whatsapp, whatsapp_opt_in")
    .not("whatsapp", "is", null);
  if (error) throw error;

  const normalized = (profiles ?? [])
    .map((profile: any) => {
      const phone = normalizePhone(profile.whatsapp, defaultCountryCode);
      if (!phone || !profile.user_id) return null;
      return {
        profile,
        phone,
      };
    })
    .filter(Boolean) as Array<{ profile: any; phone: string }>;

  const existing = await existingContactsByPhone(supabase, normalized.map((row) => row.phone));
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const batch of chunks(normalized, 100)) {
    const rows: ContactInput[] = [];
    for (const { profile, phone } of batch) {
      const current = existing.get(phone);
      if (current?.user_id && current.user_id !== profile.user_id) {
        skipped++;
        continue;
      }

      const optedIn = profile.whatsapp_opt_in === true;
      rows.push({
        user_id: profile.user_id,
        name: firstString(profile.display_name) ?? phone,
        phone_e164: phone,
        source: "app",
        provider_contact_id: current?.provider_contact_id ?? null,
        whatsapp_opt_in: optedIn,
        opt_in_source: optedIn ? "app_profile" : current?.opt_in_source ?? null,
        opt_in_at: optedIn ? current?.opt_in_at ?? now : current?.opt_in_at ?? null,
        opt_out_at: optedIn ? null : current?.whatsapp_opt_in ? now : current?.opt_out_at ?? null,
        is_active: true,
        metadata: {
          ...(current?.metadata ?? {}),
          app_profile_synced_at: now,
        },
      });
      current ? updated++ : created++;
    }

    if (rows.length) {
      const { error: upsertError } = await supabase.from("atis_contacts").upsert(rows, { onConflict: "phone_e164" });
      if (upsertError) throw upsertError;
    }
  }

  return { found: normalized.length, created, updated, skipped };
}

async function syncProviderContacts(
  supabase: any,
  provider: EvolutionProvider,
  instance: any,
  defaultCountryCode: string,
) {
  const providerName = instance.external_instance_name || instance.name;
  const contacts = await provider.findContacts(providerName, 5000, 0);

  const normalized = contacts
    .map((contact: any) => {
      const phone = jidToPhone(contact, defaultCountryCode);
      if (!phone) return null;
      const providerId = firstString(contact?.remoteJid, contact?.id, contact?.jid, contact?.phoneNumber);
      return { contact, phone, providerId };
    })
    .filter(Boolean) as Array<{ contact: any; phone: string; providerId: string | null }>;

  const existing = await existingContactsByPhone(supabase, normalized.map((row) => row.phone));
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  for (const batch of chunks(normalized, 100)) {
    const rows: ContactInput[] = batch.map(({ contact, phone, providerId }) => {
      const current = existing.get(phone);
      current ? updated++ : created++;

      // Provider synchronization never grants consent. Existing consent from the app/manual source is preserved.
      return {
        user_id: current?.user_id ?? null,
        name: firstString(contact?.pushName, contact?.name, contact?.notify, current?.name) ?? phone,
        phone_e164: phone,
        source: current?.source === "app" || current?.source === "manual" ? current.source : "provider",
        provider_contact_id: providerId ?? current?.provider_contact_id ?? null,
        whatsapp_opt_in: current?.whatsapp_opt_in === true,
        opt_in_source: current?.opt_in_source ?? null,
        opt_in_at: current?.opt_in_at ?? null,
        opt_out_at: current?.opt_out_at ?? null,
        is_active: current?.is_active !== false,
        metadata: {
          ...(current?.metadata ?? {}),
          ...safeProviderMeta(contact),
          provider_synced_at: now,
        },
      };
    });

    if (rows.length) {
      const { error: upsertError } = await supabase.from("atis_contacts").upsert(rows, { onConflict: "phone_e164" });
      if (upsertError) throw upsertError;
    }
  }

  return { found: normalized.length, created, updated };
}

function groupId(item: any) {
  return firstString(item?.id, item?.jid, item?.remoteJid, item?.groupJid);
}

function participantId(item: any) {
  return firstString(item?.id, item?.jid, item?.remoteJid, item?.phoneNumber, item?.phone);
}

async function syncGroups(
  supabase: any,
  provider: EvolutionProvider,
  instance: any,
  defaultCountryCode: string,
) {
  const providerName = instance.external_instance_name || instance.name;
  const groups = await provider.fetchAllGroups(providerName, true);
  const now = new Date().toISOString();
  const returnedIds = new Set<string>();
  let created = 0;
  let updated = 0;
  let memberCount = 0;

  for (const group of groups) {
    const providerGroupId = groupId(group);
    if (!providerGroupId || !providerGroupId.endsWith("@g.us")) continue;
    returnedIds.add(providerGroupId);

    const { data: current, error: currentError } = await supabase
      .from("atis_groups")
      .select("*")
      .eq("instance_id", instance.id)
      .eq("provider_group_id", providerGroupId)
      .maybeSingle();
    if (currentError) throw currentError;

    const participants = Array.isArray(group?.participants)
      ? group.participants
      : Array.isArray(group?.participantsData)
      ? group.participantsData
      : [];

    const row = {
      instance_id: instance.id,
      provider_group_id: providerGroupId,
      name: firstString(group?.subject, group?.name) ?? providerGroupId,
      description: firstString(group?.desc, group?.description),
      participant_count: Number.isInteger(group?.size) ? group.size : participants.length,
      allow_automations: current?.allow_automations ?? true,
      is_active: true,
      synced_at: now,
      metadata: {
        ...(current?.metadata ?? {}),
        owner: firstString(group?.owner),
        announce: typeof group?.announce === "boolean" ? group.announce : null,
        restrict: typeof group?.restrict === "boolean" ? group.restrict : null,
        picture_url: firstString(group?.pictureUrl, group?.profilePicUrl),
      },
    };

    const { data: savedGroup, error: groupError } = await supabase
      .from("atis_groups")
      .upsert(row, { onConflict: "instance_id,provider_group_id" })
      .select("*")
      .single();
    if (groupError) throw groupError;
    current ? updated++ : created++;

    // A successful full group fetch is authoritative for current membership.
    const { error: deactivateError } = await supabase
      .from("atis_group_members")
      .update({ is_active: false, synced_at: now })
      .eq("group_id", savedGroup.id);
    if (deactivateError) throw deactivateError;

    const participantPhones = participants
      .map((participant: any) => jidToPhone(participant, defaultCountryCode))
      .filter(Boolean) as string[];
    const contacts = await existingContactsByPhone(supabase, participantPhones);

    const memberRows = participants
      .map((participant: any) => {
        const providerMemberId = participantId(participant);
        if (!providerMemberId) return null;
        const phone = jidToPhone(participant, defaultCountryCode);
        const linked = phone ? contacts.get(phone) : null;
        const adminValue = firstString(participant?.admin)?.toLowerCase();
        return {
          group_id: savedGroup.id,
          provider_member_id: providerMemberId,
          contact_id: linked?.id ?? null,
          phone_e164: phone,
          display_name: firstString(participant?.name, participant?.pushName, participant?.notify, linked?.name),
          is_admin: adminValue === "admin" || adminValue === "superadmin" || participant?.isAdmin === true,
          is_super_admin: adminValue === "superadmin" || participant?.isSuperAdmin === true,
          is_active: true,
          synced_at: now,
          metadata: {},
        };
      })
      .filter(Boolean);

    for (const batch of chunks(memberRows, 200)) {
      if (!batch.length) continue;
      const { error: memberError } = await supabase
        .from("atis_group_members")
        .upsert(batch, { onConflict: "group_id,provider_member_id" });
      if (memberError) throw memberError;
      memberCount += batch.length;
    }
  }

  const { data: currentGroups, error: existingGroupsError } = await supabase
    .from("atis_groups")
    .select("id, provider_group_id")
    .eq("instance_id", instance.id)
    .eq("is_active", true);
  if (existingGroupsError) throw existingGroupsError;

  const staleIds = (currentGroups ?? [])
    .filter((row: any) => !returnedIds.has(row.provider_group_id))
    .map((row: any) => row.id);
  if (staleIds.length) {
    const { error: staleError } = await supabase
      .from("atis_groups")
      .update({ is_active: false, synced_at: now })
      .in("id", staleIds);
    if (staleError) throw staleError;
  }

  return {
    found: returnedIds.size,
    created,
    updated,
    deactivated: staleIds.length,
    members: memberCount,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const auth = await validateAdminAuth(req, supabaseUrl, serviceKey);
  if (!auth.authorized) {
    const status = auth.error === "Administrative access required" ? 403 : 401;
    return json({ error: status === 403 ? "FORBIDDEN" : "UNAUTHORIZED", message: auth.error }, status);
  }

  let input: Json = {};
  try {
    input = await req.json();
  } catch {
    // Empty body is equivalent to action=all.
  }

  const action = String(input.action ?? "all").trim();
  if (!["all", "app_contacts", "provider_contacts", "groups"].includes(action)) {
    return json({ error: "UNKNOWN_ACTION", action }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const defaultCountryCode = await readDefaultCountryCode(supabase);
    const result: Record<string, unknown> = { action, default_country_code: defaultCountryCode };

    if (action === "all" || action === "app_contacts") {
      result.app_contacts = await syncAppContacts(supabase, defaultCountryCode);
    }

    if (action === "all" || action === "provider_contacts" || action === "groups") {
      const instance = await loadInstance(supabase, input);
      const provider = new EvolutionProvider(getEvolutionConfigFromEnv());
      const state = await provider.connectionState(instance.external_instance_name || instance.name);

      if (state.status !== "connected") {
        return json(
          {
            error: "INSTANCE_NOT_CONNECTED",
            message: "WhatsApp must be connected before provider contacts/groups can be synchronized",
            provider_state: state.providerState,
            completed: result,
          },
          409,
        );
      }

      if (action === "all" || action === "provider_contacts") {
        result.provider_contacts = await syncProviderContacts(
          supabase,
          provider,
          instance,
          defaultCountryCode,
        );
      }

      if (action === "all" || action === "groups") {
        result.groups = await syncGroups(supabase, provider, instance, defaultCountryCode);
      }
    }

    return json(result);
  } catch (error) {
    console.error("[atis-sync] failed", error instanceof Error ? error.message : error);
    if (error instanceof EvolutionProviderError) {
      return json({ error: error.code, message: error.message }, error.status);
    }
    return json(
      {
        error: "ATIS_SYNC_ERROR",
        message: error instanceof Error ? error.message : "Unexpected synchronization error",
      },
      500,
    );
  }
});
