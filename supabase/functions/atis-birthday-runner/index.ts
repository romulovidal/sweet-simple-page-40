import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    const settings = settingsRow?.value ?? {};
    const enabled = settings.enabled === true;
    const groupId = firstString(settings.group_id);
    const sendTime = firstString(settings.send_time);
    const timeZone = firstString(settings.timezone) ?? "America/Fortaleza";
    if (!enabled) return json({ ok: true, skipped: true, reason: "DISABLED" });
    if (!groupId || !sendTime) return json({ ok: true, skipped: true, reason: "NOT_CONFIGURED" });
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) return json({ error: "INVALID_SEND_TIME" }, 500);

    const local = localParts(now, timeZone);
    const currentTime = `${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`;
    if (currentTime !== sendTime) return json({ ok: true, skipped: true, reason: "NOT_DUE", local_time: currentTime });

    const { data: birthdays, error: birthdayError } = await supabase
      .from("atis_birthdays")
      .select("id,name,birth_date,birth_day,birth_month")
      .eq("is_active", true);
    if (birthdayError) throw birthdayError;
    const today = (birthdays ?? []).filter((row: any) => {
      const legacy = String(row.birth_date ?? "");
      const month = Number(row.birth_month ?? legacy.slice(5, 7));
      const day = Number(row.birth_day ?? legacy.slice(8, 10));
      return month === local.month && day === local.day;
    }).sort((a: any, b: any) => a.name.localeCompare(b.name, "pt-BR"));

    if (!today.length) return json({ ok: true, skipped: true, reason: "NO_BIRTHDAYS_TODAY" });

    const { data: group, error: groupError } = await supabase
      .from("atis_groups")
      .select("id,name,provider_group_id,is_active,provider_exists,allow_automations")
      .eq("id", groupId)
      .maybeSingle();
    if (groupError) throw groupError;
    if (!group || !group.is_active || group.provider_exists === false) return json({ error: "BIRTHDAY_GROUP_NOT_ACTIVE" }, 409);
    if (!group.allow_automations) return json({ error: "BIRTHDAY_GROUP_AUTOMATIONS_DISABLED" }, 409);

    const { data: instance, error: instanceError } = await supabase
      .from("atis_instances")
      .select("id,name,status")
      .eq("name", "atis-main")
      .maybeSingle();
    if (instanceError) throw instanceError;
    if (!instance) return json({ error: "INSTANCE_NOT_FOUND" }, 404);

    const names = today.map((row: any) => String(row.name));
    const dateKey = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
    const customTemplate = firstString(settings.message_template);
    const content = customTemplate
      ? renderTemplate(customTemplate, {
          nome: names[0] ?? "",
          nomes: names.join(", "),
          quantidade: String(names.length),
          grupo: group.name ?? "",
          data: new Intl.DateTimeFormat("pt-BR", { timeZone }).format(now),
        })
      : defaultMessage(names);

    if (!content || content.length > 4096) return json({ error: "BIRTHDAY_MESSAGE_INVALID" }, 500);
    const dedupeKey = `birthday-group:${group.id}:${dateKey}`;

    const { data: existing, error: existingError } = await supabase.from("atis_messages").select("id,status").eq("dedupe_key", dedupeKey).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ ok: true, skipped: true, reason: "ALREADY_QUEUED", message_id: existing.id, status: existing.status });

    const scheduledFor = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();
    const { data: message, error: messageError } = await supabase.from("atis_messages").insert({
      instance_id: instance.id,
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
        birthday_ids: today.map((row: any) => row.id),
        birthday_names: names,
        group_only: true,
        date_key: dateKey,
      },
      created_by: null,
    }).select("id,status").single();
    if (messageError) {
      if ((messageError as any).code === "23505") return json({ ok: true, skipped: true, reason: "ALREADY_QUEUED" });
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
      metadata: { birthday_group: true, date_key: dateKey },
    });
    if (targetError) {
      await supabase.from("atis_messages").delete().eq("id", message.id);
      throw targetError;
    }

    return json({
      ok: true,
      queued: true,
      message_id: message.id,
      group: { id: group.id, name: group.name },
      birthdays: names,
      date: dateKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATIS_BIRTHDAY_RUNNER_ERROR";
    console.error("[atis-birthday-runner]", message);
    return json({ error: "ATIS_BIRTHDAY_RUNNER_ERROR", message }, 500);
  }
});