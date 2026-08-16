import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAdminAuth } from "../_shared/auth-utils.ts";

type Json = Record<string, unknown>;

type ResolvedTarget = {
  target_type: "individual" | "contact" | "group";
  target_key: string;
  contact_id: string | null;
  group_id: string | null;
  phone_e164: string | null;
  provider_target_id: string | null;
  display_name: string | null;
  max_attempts: number;
  metadata: Record<string, unknown>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  raw = raw.replace(/@s\.whatsapp\.net$/i, "").replace(/^00/, "+");
  let digits = raw.replace(/\D/g, "");
  if ((digits.length === 10 || digits.length === 11) && defaultCountryCode) digits = `${defaultCountryCode}${digits}`;
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

async function readSettings(supabase: any) {
  const { data, error } = await supabase.from("atis_settings").select("key,value").in("key", ["defaults", "delivery"]);
  if (error) throw error;
  const map = Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value ?? {}]));
  const countryCode = typeof map.defaults?.default_country_code === "string" ? map.defaults.default_country_code : "55";
  const maxAttemptsRaw = Number(map.delivery?.max_attempts ?? 3);
  const maxAttempts = Number.isInteger(maxAttemptsRaw) ? Math.min(10, Math.max(1, maxAttemptsRaw)) : 3;
  return { countryCode, maxAttempts };
}

async function loadInstance(supabase: any, input: Json) {
  let query = supabase.from("atis_instances").select("*").limit(1);
  if (typeof input.instance_id === "string" && input.instance_id) query = query.eq("id", input.instance_id);
  else query = query.eq("name", typeof input.instance_name === "string" && input.instance_name ? input.instance_name : "atis-main");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("INSTANCE_NOT_FOUND");
  return data;
}

async function resolveTargets(
  supabase: any,
  rawTargets: unknown,
  options: {
    countryCode: string;
    maxAttempts: number;
    sourceType: string;
    isSuperAdmin: boolean;
    overrideOptIn: boolean;
    confirmDirect: boolean;
  },
) {
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) throw new Error("TARGETS_REQUIRED");
  if (rawTargets.length > 500) throw new Error("TOO_MANY_TARGETS");

  const resolved: ResolvedTarget[] = [];
  const seen = new Set<string>();
  const rejected: Array<{ index: number; reason: string }> = [];

  for (let index = 0; index < rawTargets.length; index++) {
    const raw = rawTargets[index] as any;
    const type = String(raw?.type ?? "").trim();

    if (type === "contact") {
      const contactId = firstString(raw?.contact_id, raw?.id);
      if (!contactId) {
        rejected.push({ index, reason: "CONTACT_ID_REQUIRED" });
        continue;
      }
      const { data: contact, error } = await supabase.from("atis_contacts").select("*").eq("id", contactId).maybeSingle();
      if (error) throw error;
      if (!contact || !contact.is_active) {
        rejected.push({ index, reason: "CONTACT_NOT_ACTIVE" });
        continue;
      }
      if (!contact.whatsapp_opt_in && !(options.isSuperAdmin && options.overrideOptIn)) {
        rejected.push({ index, reason: "CONTACT_OPT_IN_REQUIRED" });
        continue;
      }
      const key = `contact:${contact.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push({
        target_type: "contact",
        target_key: key,
        contact_id: contact.id,
        group_id: null,
        phone_e164: contact.phone_e164,
        provider_target_id: null,
        display_name: contact.name ?? null,
        max_attempts: options.maxAttempts,
        metadata: options.overrideOptIn ? { opt_in_override: true } : {},
      });
      continue;
    }

    if (type === "group") {
      const groupId = firstString(raw?.group_id, raw?.id);
      if (!groupId) {
        rejected.push({ index, reason: "GROUP_ID_REQUIRED" });
        continue;
      }
      const { data: group, error } = await supabase.from("atis_groups").select("*").eq("id", groupId).maybeSingle();
      if (error) throw error;
      if (!group || !group.is_active) {
        rejected.push({ index, reason: "GROUP_NOT_ACTIVE" });
        continue;
      }
      if (options.sourceType === "automation" && !group.allow_automations) {
        rejected.push({ index, reason: "GROUP_AUTOMATIONS_DISABLED" });
        continue;
      }
      const key = `group:${group.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push({
        target_type: "group",
        target_key: key,
        contact_id: null,
        group_id: group.id,
        phone_e164: null,
        provider_target_id: group.provider_group_id,
        display_name: group.name ?? null,
        max_attempts: options.maxAttempts,
        metadata: {},
      });
      continue;
    }

    if (type === "individual") {
      const phone = normalizePhone(raw?.phone ?? raw?.phone_e164 ?? raw?.number, options.countryCode);
      if (!phone) {
        rejected.push({ index, reason: "INVALID_PHONE" });
        continue;
      }

      const { data: contact, error } = await supabase.from("atis_contacts").select("*").eq("phone_e164", phone).maybeSingle();
      if (error) throw error;

      if (contact && (!contact.is_active || !contact.whatsapp_opt_in) && !(options.isSuperAdmin && options.overrideOptIn)) {
        rejected.push({ index, reason: !contact.is_active ? "CONTACT_NOT_ACTIVE" : "CONTACT_OPT_IN_REQUIRED" });
        continue;
      }

      if (!contact && options.sourceType !== "manual") {
        rejected.push({ index, reason: "UNREGISTERED_INDIVIDUAL_NOT_ALLOWED_FOR_AUTOMATION" });
        continue;
      }

      if (!contact && !options.confirmDirect) {
        rejected.push({ index, reason: "DIRECT_NUMBER_CONFIRMATION_REQUIRED" });
        continue;
      }

      const key = `phone:${phone}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push({
        target_type: "individual",
        target_key: key,
        contact_id: contact?.id ?? null,
        group_id: null,
        phone_e164: phone,
        provider_target_id: null,
        display_name: contact?.name ?? firstString(raw?.name),
        max_attempts: options.maxAttempts,
        metadata: {
          direct_number: !contact,
          ...(options.overrideOptIn ? { opt_in_override: true } : {}),
        },
      });
      continue;
    }

    rejected.push({ index, reason: "INVALID_TARGET_TYPE" });
  }

  if (!resolved.length) {
    const error = new Error("NO_VALID_TARGETS");
    (error as any).rejected = rejected;
    throw error;
  }

  return { resolved, rejected };
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

  let input: Json;
  try {
    input = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const content = String(input.content ?? "").trim();
    if (!content || content.length > 4096) return json({ error: "INVALID_CONTENT" }, 400);

    const messageType = String(input.message_type ?? "text");
    if (messageType !== "text") {
      return json({ error: "MESSAGE_TYPE_NOT_READY", message: "Only text is enabled in the first ATIS backend milestone" }, 422);
    }

    const sourceType = String(input.source_type ?? "manual");
    if (!['manual','automation','event','system'].includes(sourceType)) return json({ error: "INVALID_SOURCE_TYPE" }, 400);
    if (sourceType !== "manual" && auth.role !== "service_role") {
      return json({ error: "SERVICE_ONLY_SOURCE", message: "Automation/event/system messages must be queued server-side" }, 403);
    }

    const settings = await readSettings(supabase);
    const instance = await loadInstance(supabase, input);
    const overrideOptIn = input.override_opt_in === true;
    if (overrideOptIn && auth.role !== "super_admin" && auth.role !== "service_role") {
      return json({ error: "SUPER_ADMIN_REQUIRED_FOR_OPT_IN_OVERRIDE" }, 403);
    }

    const { resolved, rejected } = await resolveTargets(supabase, input.targets, {
      countryCode: settings.countryCode,
      maxAttempts: settings.maxAttempts,
      sourceType,
      isSuperAdmin: auth.role === "super_admin" || auth.role === "service_role",
      overrideOptIn,
      confirmDirect: input.confirm_direct === true,
    });

    const scheduled = typeof input.scheduled_for === "string" ? new Date(input.scheduled_for) : new Date();
    if (Number.isNaN(scheduled.getTime())) return json({ error: "INVALID_SCHEDULE" }, 400);
    const priorityRaw = Number(input.priority ?? 0);
    const priority = Number.isInteger(priorityRaw) ? Math.max(-100, Math.min(100, priorityRaw)) : 0;

    if (input.dry_run === true) {
      return json({
        valid: true,
        dry_run: true,
        instance: { id: instance.id, name: instance.name, status: instance.status },
        targets: resolved.map((target) => ({ type: target.target_type, key: target.target_key, display_name: target.display_name })),
        rejected,
      });
    }

    const clientRequestId = firstString(input.client_request_id);
    if (!clientRequestId || clientRequestId.length < 8 || clientRequestId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(clientRequestId)) {
      return json({ error: "CLIENT_REQUEST_ID_REQUIRED", message: "Provide a stable client_request_id for idempotency" }, 400);
    }

    const dedupeKey = `${sourceType}:${auth.userId}:${clientRequestId}`;
    const { data: existingMessage, error: existingError } = await supabase
      .from("atis_messages")
      .select("*")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingMessage) {
      const { data: existingTargets, error: targetError } = await supabase
        .from("atis_message_targets")
        .select("id,target_type,target_key,status,display_name")
        .eq("message_id", existingMessage.id);
      if (targetError) throw targetError;
      return json({ queued: false, idempotent_replay: true, message: existingMessage, targets: existingTargets ?? [] });
    }

    const { data: message, error: messageError } = await supabase
      .from("atis_messages")
      .insert({
        instance_id: instance.id,
        source_type: sourceType,
        message_type: "text",
        content,
        status: "queued",
        priority,
        scheduled_for: scheduled.toISOString(),
        available_at: scheduled.toISOString(),
        dedupe_key: dedupeKey,
        metadata: {
          client_request_id: clientRequestId,
          rejected_target_count: rejected.length,
          ...(overrideOptIn ? { opt_in_override: true } : {}),
        },
        created_by: auth.userId === "service-role" ? null : auth.userId,
      })
      .select("*")
      .single();
    if (messageError) {
      if ((messageError as any)?.code === "23505") {
        const { data: replay } = await supabase.from("atis_messages").select("*").eq("dedupe_key", dedupeKey).single();
        return json({ queued: false, idempotent_replay: true, message: replay });
      }
      throw messageError;
    }

    const targetRows = resolved.map((target) => ({
      message_id: message.id,
      ...target,
      status: "pending",
      available_at: scheduled.toISOString(),
    }));

    const { data: savedTargets, error: targetError } = await supabase
      .from("atis_message_targets")
      .insert(targetRows)
      .select("id,target_type,target_key,status,display_name");
    if (targetError) {
      await supabase.from("atis_messages").delete().eq("id", message.id);
      throw targetError;
    }

    return json({
      queued: true,
      idempotent_replay: false,
      message: { ...message, status: "queued" },
      targets: savedTargets ?? [],
      rejected,
      instance_status: instance.status,
    }, 201);
  } catch (error) {
    console.error("[atis-send] failed", error instanceof Error ? error.message : error);
    const code = error instanceof Error ? error.message : "ATIS_SEND_ERROR";
    const rejected = (error as any)?.rejected;
    if (["TARGETS_REQUIRED", "TOO_MANY_TARGETS", "NO_VALID_TARGETS", "INSTANCE_NOT_FOUND"].includes(code)) {
      return json({ error: code, ...(rejected ? { rejected } : {}) }, code === "INSTANCE_NOT_FOUND" ? 404 : 400);
    }
    return json({ error: "ATIS_SEND_ERROR", message: code }, 500);
  }
});
