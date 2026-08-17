import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function localParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, key: string) => variables[key] ?? "").trim();
}

function defaultMessage(names: string[]) {
  const mention = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} e ${names[1]}` : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  return `🎉🎂 Hoje celebramos a vida de *${mention}*! Que o Senhor continue abençoando, fortalecendo e conduzindo cada passo. 🙏✨\n\nCom carinho, Ministério Atalaias de Betel. ❤️`;
}

function isDue(mode: string, customTime: string | null, local: ReturnType<typeof localParts>) {
  if (mode !== "custom_time") return true;
  if (!customTime) return false;
  const target = customTime.slice(0, 5);
  const current = `${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`;
  return current >= target;
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

  let input: Record<string, unknown> = {};
  try { input = await req.json(); } catch { /* cron body may be empty */ }
  const now = input.now && typeof input.now === "string" ? new Date(input.now) : new Date();
  if (Number.isNaN(now.getTime())) return json({ error: "INVALID_NOW" }, 400);

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: settingsRow, error: settingsError } = await supabase.from("atis_settings").select("value").eq("key", "birthdays").maybeSingle();
    if (settingsError) throw settingsError;
    const birthdaySettings = settingsRow?.value ?? {};
    const customTemplate = firstString(birthdaySettings.message_template);

    const { data: schedules, error: scheduleError } = await supabase
      .from("atis_destination_feature_settings")
      .select("id,group_id,schedule_mode,custom_time,timezone")
      .eq("destination_type", "group")
      .eq("feature_kind", "automation")
      .eq("feature_key", "birthdays")
      .eq("enabled", true);
    if (scheduleError) throw scheduleError;
    if (!schedules?.length) return json({ ok: true, skipped: true, reason: "NO_ENABLED_DESTINATIONS", queued: 0 });

    const { data: birthdays, error: birthdayError } = await supabase
      .from("atis_birthdays")
      .select("id,name,birth_day,birth_month")
      .eq("is_active", true);
    if (birthdayError) throw birthdayError;

    let queued = 0;
    let skipped = 0;
    const results: Record<string, unknown>[] = [];

    for (const schedule of schedules) {
      if (!schedule.group_id) { skipped++; continue; }
      const timeZone = firstString(schedule.timezone) ?? "America/Fortaleza";
      const local = localParts(now, timeZone);
      const today = (birthdays ?? [])
        .filter((row: any) => Number(row.birth_month) === local.month && Number(row.birth_day) === local.day)
        .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), "pt-BR"));

      if (!today.length) {
        skipped++;
        results.push({ group_id: schedule.group_id, reason: "NO_BIRTHDAYS_TODAY" });
        continue;
      }
      if (!isDue(schedule.schedule_mode, schedule.custom_time, local)) {
        skipped++;
        results.push({ group_id: schedule.group_id, reason: "NOT_DUE" });
        continue;
      }

      const { data: group, error: groupError } = await supabase
        .from("atis_groups")
        .select("id,name,provider_group_id,instance_id,is_active,provider_exists,allow_automations")
        .eq("id", schedule.group_id)
        .maybeSingle();
      if (groupError) throw groupError;
      if (!group || !group.is_active || group.provider_exists === false || !group.allow_automations) {
        skipped++;
        results.push({ group_id: schedule.group_id, reason: "GROUP_NOT_ELIGIBLE" });
        continue;
      }

      let instanceId = group.instance_id;
      if (!instanceId) {
        const { data: instance } = await supabase.from("atis_instances").select("id").order("created_at").limit(1).maybeSingle();
        instanceId = instance?.id ?? null;
      }
      if (!instanceId) {
        skipped++;
        results.push({ group_id: schedule.group_id, reason: "INSTANCE_NOT_FOUND" });
        continue;
      }

      const names = today.map((row: any) => String(row.name));
      const dateKey = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
      const content = customTemplate
        ? renderTemplate(customTemplate, {
            nome: names[0] ?? "",
            nomes: names.join(", "),
            quantidade: String(names.length),
            grupo: group.name ?? "",
            data: `${String(local.day).padStart(2, "0")}/${String(local.month).padStart(2, "0")}`,
          })
        : defaultMessage(names);

      if (!content || content.length > 4096) {
        skipped++;
        results.push({ group_id: schedule.group_id, reason: "MESSAGE_INVALID" });
        continue;
      }

      const dedupeKey = `birthday-group:${group.id}:${dateKey}`;
      const { data: existing, error: existingError } = await supabase.from("atis_messages").select("id,status").eq("dedupe_key", dedupeKey).maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        skipped++;
        results.push({ group_id: group.id, reason: "ALREADY_QUEUED", message_id: existing.id });
        continue;
      }

      const scheduledFor = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();
      const { data: message, error: messageError } = await supabase.from("atis_messages").insert({
        instance_id: instanceId,
        source_type: "automation",
        message_type: "text",
        content,
        status: "queued",
        priority: 10,
        scheduled_for: scheduledFor,
        available_at: scheduledFor,
        dedupe_key: dedupeKey,
        metadata: {
          automation_key: "birthdays_group",
          destination_feature_setting_id: schedule.id,
          schedule_mode: schedule.schedule_mode,
          custom_time: schedule.custom_time,
          timezone: timeZone,
          birthday_ids: today.map((row: any) => row.id),
          birthday_names: names,
          date_key: dateKey,
        },
        created_by: null,
      }).select("id,status").single();
      if (messageError) {
        if ((messageError as any).code === "23505") { skipped++; continue; }
        throw messageError;
      }

      const { error: targetError } = await supabase.from("atis_message_targets").insert({
        message_id: message.id,
        target_type: "group",
        target_key: `group:${group.id}`,
        contact_id: null,
        individual_id: null,
        group_id: group.id,
        phone_e164: null,
        provider_target_id: group.provider_group_id,
        display_name: group.name,
        status: "pending",
        attempt_count: 0,
        max_attempts: 3,
        available_at: scheduledFor,
        metadata: { birthday_group: true, date_key: dateKey, schedule_mode: schedule.schedule_mode },
      });
      if (targetError) {
        await supabase.from("atis_messages").delete().eq("id", message.id);
        throw targetError;
      }

      queued++;
      results.push({ group_id: group.id, group_name: group.name, queued: true, message_id: message.id, birthdays: names });
    }

    return json({ ok: true, queued, skipped, destinations: schedules.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATIS_BIRTHDAY_RUNNER_ERROR";
    console.error("[atis-birthday-runner]", message);
    return json({ error: "ATIS_BIRTHDAY_RUNNER_ERROR", message }, 500);
  }
});
