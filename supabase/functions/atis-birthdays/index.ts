import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

type Json = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v).trim()).filter(Boolean))].slice(0, 50);
}

function validBirthDate(value: unknown) {
  const text = firstString(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("INVALID_BIRTH_DATE");
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error("INVALID_BIRTH_DATE");
  }
  return text;
}

function normalizePhone(value: unknown, countryCode = "55") {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  let digits = String(value).trim().replace(/^00/, "+").replace(/\D/g, "");
  if ((digits.length === 10 || digits.length === 11) && countryCode) digits = `${countryCode}${digits}`;
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) throw new Error("INVALID_PHONE");
  return `+${digits}`;
}

function currentMonth(timezone = "America/Fortaleza") {
  const value = new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: timezone }).format(new Date());
  return Number(value);
}

async function birthdaySettings(supabase: any) {
  const { data, error } = await supabase.from("atis_settings").select("value").eq("key", "birthdays").maybeSingle();
  if (error) throw error;
  return {
    enabled: data?.value?.enabled === true,
    mode: "group_only",
    group_id: firstString(data?.value?.group_id),
    send_time: firstString(data?.value?.send_time),
    timezone: firstString(data?.value?.timezone) ?? "America/Fortaleza",
    message_template: firstString(data?.value?.message_template),
  };
}

async function syncAppBirthdays(supabase: any, countryCode: string) {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id,display_name,birth_date,whatsapp")
    .not("birth_date", "is", null);
  if (error) throw error;

  const now = new Date().toISOString();
  const validUsers = new Set<string>();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const profile of profiles ?? []) {
    if (!profile.user_id || !profile.birth_date) {
      skipped++;
      continue;
    }
    const name = firstString(profile.display_name) ?? "Membro";
    let phone: string | null = null;
    try {
      phone = normalizePhone(profile.whatsapp, countryCode);
    } catch {
      phone = null;
    }
    validUsers.add(profile.user_id);

    const { data: current, error: currentError } = await supabase
      .from("atis_birthdays")
      .select("id,metadata")
      .eq("source", "app")
      .eq("user_id", profile.user_id)
      .maybeSingle();
    if (currentError) throw currentError;

    const payload = {
      source: "app",
      user_id: profile.user_id,
      name,
      birth_date: profile.birth_date,
      phone_e164: phone,
      is_active: true,
      metadata: { ...(current?.metadata ?? {}), app_profile_synced_at: now },
    };

    if (current) {
      const { error: updateError } = await supabase.from("atis_birthdays").update(payload).eq("id", current.id);
      if (updateError) throw updateError;
      updated++;
    } else {
      const { error: insertError } = await supabase.from("atis_birthdays").insert(payload);
      if (insertError) throw insertError;
      created++;
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("atis_birthdays")
    .select("id,user_id")
    .eq("source", "app")
    .eq("is_active", true);
  if (existingError) throw existingError;

  const staleIds = (existing ?? [])
    .filter((row: any) => !row.user_id || !validUsers.has(row.user_id))
    .map((row: any) => row.id);
  if (staleIds.length) {
    const { error: staleError } = await supabase.from("atis_birthdays").update({ is_active: false }).in("id", staleIds);
    if (staleError) throw staleError;
  }

  return { found: validUsers.size, created, updated, skipped, deactivated: staleIds.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const auth = await validateAdminAuth(req, url, serviceKey);
  if (!auth.authorized) {
    const forbidden = auth.error === "Administrative access required";
    return json({ error: forbidden ? "FORBIDDEN" : "UNAUTHORIZED", message: auth.error }, forbidden ? 403 : 401);
  }

  let input: Json = {};
  try { input = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const action = String(input.action ?? "list");
  const data = input.data && typeof input.data === "object" ? input.data : input;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    if (action === "list") {
      const settings = await birthdaySettings(supabase);
      const monthRaw = Number(data.month ?? currentMonth(settings.timezone));
      const month = Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : currentMonth(settings.timezone);
      const { data: rows, error } = await supabase
        .from("atis_birthdays")
        .select("id,source,user_id,name,birth_date,phone_e164,tags,notes,is_active,created_at,updated_at")
        .eq("is_active", true)
        .order("birth_date");
      if (error) throw error;
      const birthdays = (rows ?? [])
        .filter((row: any) => Number(String(row.birth_date).slice(5, 7)) === month)
        .sort((a: any, b: any) => Number(String(a.birth_date).slice(8, 10)) - Number(String(b.birth_date).slice(8, 10)) || a.name.localeCompare(b.name, "pt-BR"));
      return json({ month, birthdays, count: birthdays.length, settings });
    }

    if (action === "sync_app") {
      const { data: defaults } = await supabase.from("atis_settings").select("value").eq("key", "defaults").maybeSingle();
      const countryCode = firstString(defaults?.value?.default_country_code) ?? "55";
      return json({ app_birthdays: await syncAppBirthdays(supabase, countryCode) });
    }

    if (action === "create") {
      const name = firstString(data.name);
      if (!name) return json({ error: "NAME_REQUIRED" }, 400);
      const birthDate = validBirthDate(data.birth_date);
      const phone = normalizePhone(data.phone ?? data.phone_e164);
      const { data: row, error } = await supabase.from("atis_birthdays").insert({
        source: "manual",
        name,
        birth_date: birthDate,
        phone_e164: phone,
        tags: cleanTags(data.tags),
        notes: firstString(data.notes),
        is_active: true,
        metadata: {},
        created_by: auth.userId === "service-role" ? null : auth.userId,
      }).select("*").single();
      if (error) throw error;
      return json({ birthday: row }, 201);
    }

    if (action === "update") {
      const id = firstString(data.id);
      if (!id) return json({ error: "BIRTHDAY_ID_REQUIRED" }, 400);
      const { data: current, error: currentError } = await supabase.from("atis_birthdays").select("*").eq("id", id).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return json({ error: "BIRTHDAY_NOT_FOUND" }, 404);

      const patch: Json = {};
      if (data.tags !== undefined) patch.tags = cleanTags(data.tags);
      if (data.notes !== undefined) patch.notes = firstString(data.notes);
      if (current.source === "manual") {
        if (data.name !== undefined) {
          const name = firstString(data.name);
          if (!name) return json({ error: "NAME_REQUIRED" }, 400);
          patch.name = name;
        }
        if (data.birth_date !== undefined) patch.birth_date = validBirthDate(data.birth_date);
        if (data.phone !== undefined || data.phone_e164 !== undefined) patch.phone_e164 = normalizePhone(data.phone ?? data.phone_e164);
      } else if (data.name !== undefined || data.birth_date !== undefined || data.phone !== undefined || data.phone_e164 !== undefined) {
        return json({ error: "APP_BIRTHDAY_SOURCE_MANAGED" }, 409);
      }

      const { data: row, error } = await supabase.from("atis_birthdays").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ birthday: row });
    }

    if (action === "archive") {
      const id = firstString(data.id);
      if (!id) return json({ error: "BIRTHDAY_ID_REQUIRED" }, 400);
      const { data: current, error: currentError } = await supabase.from("atis_birthdays").select("source").eq("id", id).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return json({ error: "BIRTHDAY_NOT_FOUND" }, 404);
      if (current.source === "app") return json({ error: "APP_BIRTHDAY_SOURCE_MANAGED" }, 409);
      const { data: row, error } = await supabase.from("atis_birthdays").update({ is_active: false }).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ birthday: row });
    }

    if (action === "groups") {
      const { data: rows, error } = await supabase
        .from("atis_groups")
        .select("id,name,participant_count,allow_automations,is_active,provider_exists")
        .eq("is_active", true)
        .eq("provider_exists", true)
        .order("name");
      if (error) throw error;
      return json({ groups: rows ?? [] });
    }

    if (action === "settings_get") {
      const settings = await birthdaySettings(supabase);
      let group = null;
      if (settings.group_id) {
        const { data: row } = await supabase.from("atis_groups").select("id,name,allow_automations,is_active,provider_exists").eq("id", settings.group_id).maybeSingle();
        group = row ?? null;
      }
      return json({ settings, group });
    }

    if (action === "settings_update") {
      const current = await birthdaySettings(supabase);
      const groupId = data.group_id === null || data.group_id === "" ? null : firstString(data.group_id) ?? current.group_id;
      const sendTime = data.send_time === null || data.send_time === "" ? null : firstString(data.send_time) ?? current.send_time;
      const enabled = data.enabled === undefined ? current.enabled : data.enabled === true;
      const timezone = firstString(data.timezone) ?? current.timezone;
      const template = data.message_template === undefined ? current.message_template : firstString(data.message_template);

      if (sendTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) return json({ error: "INVALID_SEND_TIME" }, 400);
      if (groupId) {
        const { data: group, error: groupError } = await supabase.from("atis_groups").select("id,name,is_active,provider_exists,allow_automations").eq("id", groupId).maybeSingle();
        if (groupError) throw groupError;
        if (!group || !group.is_active || group.provider_exists === false) return json({ error: "GROUP_NOT_ACTIVE" }, 409);
        if (enabled && !group.allow_automations) return json({ error: "GROUP_AUTOMATIONS_DISABLED" }, 409);
      }
      if (enabled && (!groupId || !sendTime)) return json({ error: "GROUP_AND_SEND_TIME_REQUIRED" }, 400);

      const value = {
        enabled,
        mode: "group_only",
        group_id: groupId,
        send_time: sendTime,
        timezone,
        message_template: template,
      };
      const { error } = await supabase.from("atis_settings").upsert({
        key: "birthdays",
        value,
        description: "Birthday automation configuration. Group-only mode; phone numbers are optional in birthday records.",
        updated_by: auth.userId === "service-role" ? null : auth.userId,
      }, { onConflict: "key" });
      if (error) throw error;
      return json({ settings: value });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATIS_BIRTHDAYS_ERROR";
    const status = message.startsWith("INVALID_") ? 400 : 500;
    console.error("[atis-birthdays]", message);
    return json({ error: message, message }, status);
  }
});