import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { validateCronExpression } from "../_shared/atis/automation-engine.ts";

type Json = Record<string, any>;

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

function normalizePhone(value: unknown, countryCode = "55") {
  if (typeof value !== "string" && typeof value !== "number") return null;
  let raw = String(value).trim().replace(/^00/, "+");
  let digits = raw.replace(/\D/g, "");
  if ((digits.length === 10 || digits.length === 11) && countryCode) digits = `${countryCode}${digits}`;
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

function validDateOnly(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("INVALID_BIRTH_DATE");
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error("INVALID_BIRTH_DATE");
  return text;
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 50);
}

function placeholders(content: string) {
  const variables = new Set<string>();
  for (const match of content.matchAll(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g)) variables.add(match[1]);
  return [...variables];
}

function validateTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
  } catch {
    throw new Error("INVALID_TIMEZONE");
  }
  return value;
}

function validateTargetSelector(selector: any) {
  const value = selector && typeof selector === "object" && !Array.isArray(selector) ? selector : {};
  const mode = String(value.mode ?? "all_opted_in");
  const allowed = ["all_opted_in", "contacts", "tags", "groups", "all_groups", "mixed", "birthday"];
  if (!allowed.includes(mode)) throw new Error("INVALID_TARGET_SELECTOR_MODE");
  if (["contacts", "mixed"].includes(mode) && value.contact_ids !== undefined && !Array.isArray(value.contact_ids)) {
    throw new Error("INVALID_CONTACT_IDS");
  }
  if (["groups", "mixed"].includes(mode) && value.group_ids !== undefined && !Array.isArray(value.group_ids)) {
    throw new Error("INVALID_GROUP_IDS");
  }
  if (mode === "tags" && (!Array.isArray(value.tags) || value.tags.length === 0)) throw new Error("TAGS_REQUIRED");
  return value;
}

function validateJsonSize(value: unknown, max = 20000) {
  const serialized = JSON.stringify(value ?? {});
  if (serialized.length > max) throw new Error("CONFIG_TOO_LARGE");
  return value ?? {};
}

async function countryCode(supabase: any) {
  const { data } = await supabase.from("atis_settings").select("value").eq("key", "defaults").maybeSingle();
  const value = data?.value?.default_country_code;
  return typeof value === "string" && /^\d{1,4}$/.test(value) ? value : "55";
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
  try { input = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const action = String(input.action ?? "").trim();
  const data = input.data && typeof input.data === "object" && !Array.isArray(input.data) ? input.data : {};
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const actorId = auth.userId === "service-role" ? null : auth.userId;

  try {
    if (action === "contact_create") {
      const name = firstString(data.name);
      const phone = normalizePhone(data.phone ?? data.phone_e164, await countryCode(supabase));
      if (!name || !phone) return json({ error: "NAME_AND_VALID_PHONE_REQUIRED" }, 400);
      const optedIn = data.whatsapp_opt_in === true;
      const now = new Date().toISOString();
      const { data: row, error } = await supabase.from("atis_contacts").insert({
        name,
        phone_e164: phone,
        source: "manual",
        tags: cleanTags(data.tags),
        notes: firstString(data.notes),
        birth_date: validDateOnly(data.birth_date),
        whatsapp_opt_in: optedIn,
        opt_in_source: optedIn ? "admin_manual" : null,
        opt_in_at: optedIn ? now : null,
        opt_out_at: optedIn ? null : now,
        is_active: data.is_active !== false,
        metadata: validateJsonSize(data.metadata),
        created_by: actorId,
      }).select("*").single();
      if (error) throw error;
      return json({ contact: row }, 201);
    }

    if (action === "contact_update") {
      const id = firstString(data.id);
      if (!id) return json({ error: "CONTACT_ID_REQUIRED" }, 400);
      const { data: current, error: currentError } = await supabase.from("atis_contacts").select("*").eq("id", id).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return json({ error: "CONTACT_NOT_FOUND" }, 404);
      const patch: Json = {};
      if (data.name !== undefined) patch.name = firstString(data.name) || current.name;
      if (data.phone !== undefined || data.phone_e164 !== undefined) {
        const phone = normalizePhone(data.phone ?? data.phone_e164, await countryCode(supabase));
        if (!phone) return json({ error: "INVALID_PHONE" }, 400);
        patch.phone_e164 = phone;
      }
      if (data.tags !== undefined) patch.tags = cleanTags(data.tags);
      if (data.notes !== undefined) patch.notes = firstString(data.notes);
      if (data.birth_date !== undefined) patch.birth_date = validDateOnly(data.birth_date);
      if (data.is_active !== undefined) patch.is_active = data.is_active === true;
      if (data.metadata !== undefined) patch.metadata = validateJsonSize(data.metadata);
      const { data: row, error } = await supabase.from("atis_contacts").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ contact: row });
    }

    if (action === "contact_set_opt_in") {
      const id = firstString(data.id);
      if (!id || typeof data.whatsapp_opt_in !== "boolean") return json({ error: "CONTACT_ID_AND_OPT_IN_REQUIRED" }, 400);
      const optedIn = data.whatsapp_opt_in;
      const now = new Date().toISOString();
      const { data: row, error } = await supabase.from("atis_contacts").update({
        whatsapp_opt_in: optedIn,
        opt_in_source: optedIn ? firstString(data.source) ?? "admin_manual" : null,
        opt_in_at: optedIn ? now : null,
        opt_out_at: optedIn ? null : now,
      }).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ contact: row });
    }

    if (action === "contact_archive") {
      const id = firstString(data.id);
      if (!id) return json({ error: "CONTACT_ID_REQUIRED" }, 400);
      const now = new Date().toISOString();
      const { data: row, error } = await supabase.from("atis_contacts").update({
        is_active: false,
        whatsapp_opt_in: false,
        opt_out_at: now,
      }).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ contact: row });
    }

    if (action === "group_set_automations") {
      const id = firstString(data.id);
      if (!id || typeof data.allow_automations !== "boolean") return json({ error: "GROUP_ID_AND_VALUE_REQUIRED" }, 400);
      const { data: row, error } = await supabase.from("atis_groups").update({ allow_automations: data.allow_automations }).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ group: row });
    }

    if (action === "template_create" || action === "template_update") {
      const isUpdate = action === "template_update";
      const id = firstString(data.id);
      if (isUpdate && !id) return json({ error: "TEMPLATE_ID_REQUIRED" }, 400);
      const patch: Json = {};
      if (!isUpdate || data.key !== undefined) {
        const key = firstString(data.key);
        if (!key || !/^[a-z0-9][a-z0-9._:-]{1,79}$/i.test(key)) return json({ error: "INVALID_TEMPLATE_KEY" }, 400);
        patch.key = key;
      }
      if (!isUpdate || data.name !== undefined) {
        const name = firstString(data.name);
        if (!name) return json({ error: "TEMPLATE_NAME_REQUIRED" }, 400);
        patch.name = name;
      }
      if (!isUpdate || data.category !== undefined) patch.category = firstString(data.category) ?? "custom";
      if (!isUpdate || data.content !== undefined) {
        const content = String(data.content ?? "").trim();
        if (!content || content.length > 4096) return json({ error: "INVALID_TEMPLATE_CONTENT" }, 400);
        patch.content = content;
        patch.variables = placeholders(content);
      }
      if (data.is_active !== undefined) patch.is_active = data.is_active === true;
      if (isUpdate) patch.updated_by = actorId; else patch.created_by = actorId;
      const query = isUpdate ? supabase.from("atis_templates").update(patch).eq("id", id) : supabase.from("atis_templates").insert(patch);
      const { data: row, error } = await query.select("*").single();
      if (error) throw error;
      return json({ template: row }, isUpdate ? 200 : 201);
    }

    if (action === "template_archive") {
      const id = firstString(data.id);
      if (!id) return json({ error: "TEMPLATE_ID_REQUIRED" }, 400);
      const { data: row, error } = await supabase.from("atis_templates").update({ is_active: false, updated_by: actorId }).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ template: row });
    }

    if (action === "automation_create" || action === "automation_update") {
      const isUpdate = action === "automation_update";
      const id = firstString(data.id);
      if (isUpdate && !id) return json({ error: "AUTOMATION_ID_REQUIRED" }, 400);
      const patch: Json = {};
      if (!isUpdate || data.key !== undefined) {
        const key = firstString(data.key);
        if (!key || !/^[a-z0-9][a-z0-9._:-]{1,79}$/i.test(key)) return json({ error: "INVALID_AUTOMATION_KEY" }, 400);
        patch.key = key;
      }
      if (!isUpdate || data.name !== undefined) {
        const name = firstString(data.name);
        if (!name) return json({ error: "AUTOMATION_NAME_REQUIRED" }, 400);
        patch.name = name;
      }
      if (data.description !== undefined) patch.description = firstString(data.description);
      if (!isUpdate || data.type !== undefined) patch.type = firstString(data.type) ?? "custom";
      if (!isUpdate || data.trigger_type !== undefined) patch.trigger_type = firstString(data.trigger_type) ?? "schedule";
      if (data.timezone !== undefined || !isUpdate) patch.timezone = validateTimezone(firstString(data.timezone) ?? "America/Fortaleza");
      if (data.schedule_cron !== undefined || !isUpdate) {
        const cron = firstString(data.schedule_cron);
        const trigger = patch.trigger_type ?? data.trigger_type ?? "schedule";
        if (trigger === "schedule") {
          if (!cron) return json({ error: "SCHEDULE_CRON_REQUIRED" }, 400);
          validateCronExpression(cron);
          patch.schedule_cron = cron;
        } else patch.schedule_cron = cron;
      }
      if (data.event_key !== undefined) patch.event_key = firstString(data.event_key);
      if (data.template_id !== undefined) patch.template_id = firstString(data.template_id);
      if (data.target_selector !== undefined || !isUpdate) patch.target_selector = validateTargetSelector(data.target_selector);
      if (data.config !== undefined || !isUpdate) patch.config = validateJsonSize(data.config);
      if (data.enabled !== undefined) patch.enabled = data.enabled === true;
      if (isUpdate) patch.updated_by = actorId; else patch.created_by = actorId;
      const query = isUpdate ? supabase.from("atis_automations").update(patch).eq("id", id) : supabase.from("atis_automations").insert(patch);
      const { data: row, error } = await query.select("*").single();
      if (error) throw error;
      return json({ automation: row }, isUpdate ? 200 : 201);
    }

    if (action === "automation_set_enabled") {
      const id = firstString(data.id);
      if (!id || typeof data.enabled !== "boolean") return json({ error: "AUTOMATION_ID_AND_ENABLED_REQUIRED" }, 400);
      const { data: row, error } = await supabase.from("atis_automations").update({ enabled: data.enabled, updated_by: actorId }).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ automation: row });
    }

    if (action === "settings_update") {
      const key = firstString(data.key);
      if (!key || !["defaults", "delivery"].includes(key)) return json({ error: "INVALID_SETTINGS_KEY" }, 400);
      const { data: current, error: currentError } = await supabase.from("atis_settings").select("*").eq("key", key).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return json({ error: "SETTINGS_NOT_FOUND" }, 404);
      const patch = { ...(current.value ?? {}) } as Json;
      if (key === "defaults") {
        if (data.timezone !== undefined) patch.timezone = validateTimezone(firstString(data.timezone) ?? "America/Fortaleza");
        if (data.default_country_code !== undefined) {
          const code = String(data.default_country_code).replace(/\D/g, "");
          if (!/^\d{1,4}$/.test(code)) return json({ error: "INVALID_COUNTRY_CODE" }, 400);
          patch.default_country_code = code;
        }
      } else {
        if (data.max_messages_per_minute !== undefined) patch.max_messages_per_minute = Math.max(1, Math.min(20, Number(data.max_messages_per_minute) || 8));
        if (data.min_delay_ms !== undefined) patch.min_delay_ms = Math.max(0, Math.min(15000, Number(data.min_delay_ms) || 0));
        if (data.max_attempts !== undefined) patch.max_attempts = Math.max(1, Math.min(10, Number(data.max_attempts) || 3));
        if (data.retry_delays_seconds !== undefined) {
          if (!Array.isArray(data.retry_delays_seconds)) return json({ error: "INVALID_RETRY_DELAYS" }, 400);
          patch.retry_delays_seconds = data.retry_delays_seconds.map((value: unknown) => Math.max(0, Math.min(86400, Number(value) || 0))).slice(0, 10);
        }
        if (data.quiet_hours !== undefined) patch.quiet_hours = validateJsonSize(data.quiet_hours, 2000);
      }
      const { data: row, error } = await supabase.from("atis_settings").update({ value: patch, updated_by: actorId }).eq("key", key).select("*").single();
      if (error) throw error;
      return json({ settings: row });
    }

    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (error) {
    console.error("[atis-admin] failed", error instanceof Error ? error.message : error);
    const code = error instanceof Error ? error.message : "ATIS_ADMIN_ERROR";
    if (code.startsWith("INVALID_") || code.includes("REQUIRED") || code.includes("CRON") || code === "CONFIG_TOO_LARGE") {
      return json({ error: code }, 400);
    }
    return json({ error: "ATIS_ADMIN_ERROR", message: code }, 500);
  }
});
