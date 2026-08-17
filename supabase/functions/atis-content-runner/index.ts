import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

type Json = Record<string, any>;
type DestinationType = "contact" | "individual" | "group";

type Schedule = {
  id: string;
  destination_type: DestinationType;
  contact_id?: string | null;
  individual_id?: string | null;
  group_id?: string | null;
  schedule_mode: "system" | "instant" | "custom_time";
  custom_time?: string | null;
  timezone?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function localParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const year = String(parts.year ?? "0000");
  const month = String(parts.month ?? "00");
  const day = String(parts.day ?? "00");
  const hour = String(parts.hour ?? "00").padStart(2, "0");
  const minute = String(parts.minute ?? "00").padStart(2, "0");
  return { dateKey: `${year}-${month}-${day}`, hhmm: `${hour}:${minute}` };
}

function clockFromSetting(value: unknown, fallback = "06:00") {
  let current: unknown = value;
  for (let i = 0; i < 4; i++) {
    if (typeof current !== "string") break;
    const clean = current.trim().replace(/^"|"$/g, "");
    const match = clean.match(/^([01]\d|2[0-3]):([0-5]\d)/);
    if (match) return `${match[1]}:${match[2]}`;
    try { current = JSON.parse(current); } catch { break; }
  }
  return fallback;
}

function scheduleClock(value: unknown) {
  const raw = firstString(value);
  const match = raw?.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function isDue(schedule: Schedule, localTime: string, systemTime: string) {
  if (schedule.schedule_mode === "instant") return true;
  const target = schedule.schedule_mode === "custom_time" ? scheduleClock(schedule.custom_time) : systemTime;
  if (!target) return false;
  return localTime >= target;
}

async function loadDefaultInstance(supabase: any) {
  const { data, error } = await supabase.from("atis_instances").select("id,status").eq("status", "connected").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function resolveDestination(supabase: any, schedule: Schedule, defaultInstanceId: string | null) {
  if (schedule.destination_type === "contact") {
    if (!schedule.contact_id) return null;
    const { data, error } = await supabase.from("atis_contacts").select("id,name,phone_e164,is_active,whatsapp_opt_in,blocked").eq("id", schedule.contact_id).maybeSingle();
    if (error) throw error;
    if (!data || !data.is_active || !data.whatsapp_opt_in || data.blocked || !data.phone_e164 || !defaultInstanceId) return null;
    return { instanceId: defaultInstanceId, targetType: "contact", targetKey: `contact:${data.id}`, contactId: data.id, individualId: null, groupId: null, phone: data.phone_e164, providerTargetId: null, name: data.name ?? data.phone_e164 };
  }
  if (schedule.destination_type === "individual") {
    if (!schedule.individual_id) return null;
    const { data, error } = await supabase.from("atis_individuals").select("id,name,phone_e164,is_active,allow_messages,blocked").eq("id", schedule.individual_id).maybeSingle();
    if (error) throw error;
    if (!data || !data.is_active || !data.allow_messages || data.blocked || !data.phone_e164 || !defaultInstanceId) return null;
    return { instanceId: defaultInstanceId, targetType: "individual", targetKey: `individual:${data.id}`, contactId: null, individualId: data.id, groupId: null, phone: data.phone_e164, providerTargetId: null, name: data.name ?? data.phone_e164 };
  }
  if (!schedule.group_id) return null;
  const { data, error } = await supabase.from("atis_groups").select("id,name,provider_group_id,instance_id,is_active,provider_exists,allow_automations").eq("id", schedule.group_id).maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active || data.provider_exists === false || !data.allow_automations || !data.provider_group_id) return null;
  const instanceId = data.instance_id ?? defaultInstanceId;
  if (!instanceId) return null;
  return { instanceId, targetType: "group", targetKey: `group:${data.id}`, contactId: null, individualId: null, groupId: data.id, phone: null, providerTargetId: data.provider_group_id, name: data.name ?? "Grupo" };
}

async function dailyDevotionalContent(supabase: any, dateKey: string, verseRef: string, url: string, serviceKey: string) {
  const { data: cached, error: cacheError } = await supabase.from("atis_settings").select("value").eq("key", "daily_devotional_cache").maybeSingle();
  if (cacheError) throw cacheError;
  const value = cached?.value ?? {};
  if (value.date === dateKey && value.reference === verseRef && typeof value.content === "string" && value.content.trim()) {
    return value.content.trim();
  }

  const response = await fetch(`${url}/functions/v1/atis-ai`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Faça uma reflexão devocional curta e prática sobre ${verseRef}. Use o texto bíblico do aplicativo como fonte.`,
    }),
  });
  const result = await response.json().catch(() => null) as any;
  if (!response.ok || result?.route !== "devotional" || typeof result?.text !== "string" || !result.text.trim()) {
    throw new Error("DEVOTIONAL_GENERATION_FAILED");
  }

  const content = `🌿 *Reflexão devocional*\n📖 *${verseRef}*\n\n${result.text.trim()}`;
  const { error } = await supabase.from("atis_settings").upsert({
    key: "daily_devotional_cache",
    value: { date: dateKey, reference: verseRef, content, generated_at: new Date().toISOString(), source: "current_daily_verse+atis-ai:devotional" },
    description: "Cache diário da reflexão devocional do ATIS, gerada a partir do Versículo do Dia do app.",
  }, { onConflict: "key" });
  if (error) throw error;
  return content;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const auth = await validateAdminAuth(req, url, serviceKey);
  if (!auth.authorized) return json({ error: "UNAUTHORIZED", message: auth.error }, 401);
  if (auth.role !== "service_role") return json({ error: "SERVICE_ROLE_REQUIRED" }, 403);

  let input: Json = {};
  try { input = await req.json(); } catch { /* cron may send an empty body */ }
  const now = typeof input.now === "string" ? new Date(input.now) : new Date();
  if (Number.isNaN(now.getTime())) return json({ error: "INVALID_NOW" }, 400);

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: schedules, error: scheduleError } = await supabase
      .from("atis_destination_feature_settings")
      .select("id,destination_type,contact_id,individual_id,group_id,schedule_mode,custom_time,timezone")
      .eq("feature_kind", "automation")
      .eq("feature_key", "daily_devotional")
      .eq("enabled", true);
    if (scheduleError) throw scheduleError;
    if (!schedules?.length) return json({ ok: true, skipped: true, reason: "NO_ENABLED_DESTINATIONS", queued: 0 });

    const { data: systemRow, error: systemError } = await supabase.from("admin_settings").select("value").eq("key", "daily_verse_push_time").maybeSingle();
    if (systemError) throw systemError;
    const systemTime = clockFromSetting(systemRow?.value, "06:00");

    const defaultInstanceId = await loadDefaultInstance(supabase);
    let queued = 0;
    let skipped = 0;
    let content: string | null = null;
    let contentDate = "";
    let contentReference = "";
    const results: Json[] = [];

    for (const raw of schedules as Schedule[]) {
      const timeZone = firstString(raw.timezone) ?? "America/Fortaleza";
      const local = localParts(now, timeZone);
      if (!isDue(raw, local.hhmm, systemTime)) {
        skipped++;
        results.push({ setting_id: raw.id, reason: "NOT_DUE" });
        continue;
      }

      const { data: verse, error: verseError } = await supabase
        .from("current_daily_verse")
        .select("verse_ref,verse_text,scheduled_date,created_at")
        .eq("scheduled_date", local.dateKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (verseError) throw verseError;
      if (!verse?.verse_ref) {
        skipped++;
        results.push({ setting_id: raw.id, reason: "DAILY_VERSE_NOT_READY" });
        continue;
      }

      const destination = await resolveDestination(supabase, raw, defaultInstanceId);
      if (!destination) {
        skipped++;
        results.push({ setting_id: raw.id, reason: "DESTINATION_NOT_ELIGIBLE" });
        continue;
      }

      const dedupeKey = `daily-devotional:${raw.destination_type}:${raw.contact_id ?? raw.individual_id ?? raw.group_id}:${local.dateKey}`;
      const { data: existing, error: existingError } = await supabase.from("atis_messages").select("id").eq("dedupe_key", dedupeKey).maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        skipped++;
        results.push({ setting_id: raw.id, reason: "ALREADY_QUEUED", message_id: existing.id });
        continue;
      }

      if (!content || contentDate !== local.dateKey || contentReference !== verse.verse_ref) {
        content = await dailyDevotionalContent(supabase, local.dateKey, verse.verse_ref, url, serviceKey);
        contentDate = local.dateKey;
        contentReference = verse.verse_ref;
      }

      const availableAt = now.toISOString();
      const { data: message, error: messageError } = await supabase.from("atis_messages").insert({
        instance_id: destination.instanceId,
        source_type: "automation",
        message_type: "text",
        content,
        status: "queued",
        priority: 8,
        scheduled_for: availableAt,
        available_at: availableAt,
        dedupe_key: dedupeKey,
        metadata: {
          automation_key: "daily_devotional",
          destination_feature_setting_id: raw.id,
          schedule_mode: raw.schedule_mode,
          custom_time: raw.custom_time,
          system_time: systemTime,
          timezone: timeZone,
          date_key: local.dateKey,
          verse_ref: verse.verse_ref,
          source: "current_daily_verse",
        },
        created_by: null,
      }).select("id").single();
      if (messageError) {
        if ((messageError as any).code === "23505") { skipped++; continue; }
        throw messageError;
      }

      const { error: targetError } = await supabase.from("atis_message_targets").insert({
        message_id: message.id,
        target_type: destination.targetType,
        target_key: destination.targetKey,
        contact_id: destination.contactId,
        individual_id: destination.individualId,
        group_id: destination.groupId,
        phone_e164: destination.phone,
        provider_target_id: destination.providerTargetId,
        display_name: destination.name,
        status: "pending",
        attempt_count: 0,
        max_attempts: 3,
        available_at: availableAt,
        metadata: { automation_key: "daily_devotional", date_key: local.dateKey, verse_ref: verse.verse_ref },
      });
      if (targetError) {
        await supabase.from("atis_messages").delete().eq("id", message.id);
        throw targetError;
      }

      queued++;
      results.push({ setting_id: raw.id, destination_type: raw.destination_type, destination_name: destination.name, queued: true, message_id: message.id });
    }

    return json({ ok: true, queued, skipped, destinations: schedules.length, system_time: systemTime, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATIS_CONTENT_RUNNER_ERROR";
    console.error("[atis-content-runner]", message);
    return json({ error: message, message }, 500);
  }
});
