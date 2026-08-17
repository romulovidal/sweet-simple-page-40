import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { validateCronExpression } from "../_shared/atis/automation-engine.ts";

type Json = Record<string, any>;
type DestinationType = "contact" | "individual" | "group";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}
function destinationColumn(type: DestinationType) {
  return type === "contact" ? "contact_id" : type === "individual" ? "individual_id" : "group_id";
}
function validDestinationType(value: unknown): DestinationType | null {
  return value === "contact" || value === "individual" || value === "group" ? value : null;
}
function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  return Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function hhmm(value: unknown) {
  const raw = firstString(value);
  if (!raw) return null;
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  return match ? `${match[1]}:${match[2]}:00` : null;
}

async function ensureDestination(supabase: any, type: DestinationType, id: string) {
  const table = type === "contact" ? "atis_contacts" : type === "individual" ? "atis_individuals" : "atis_groups";
  const { data, error } = await supabase.from(table).select("id,name").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("DESTINATION_NOT_FOUND");
  return data;
}

async function profileGet(supabase: any, type: DestinationType, id: string) {
  await ensureDestination(supabase, type, id);
  const column = destinationColumn(type);
  const { data, error } = await supabase.from("atis_destination_profiles").select("*").eq("destination_type", type).eq(column, id).maybeSingle();
  if (error) throw error;
  return data ?? {
    destination_type: type,
    [column]: id,
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

async function profileSave(supabase: any, auth: any, type: DestinationType, id: string, raw: Json) {
  await ensureDestination(supabase, type, id);
  const column = destinationColumn(type);
  const existing = await profileGet(supabase, type, id);
  const mode = ["normal", "study", "concise"].includes(raw.conversation_mode) ? raw.conversation_mode : existing.conversation_mode;
  const style = ["concise", "balanced", "detailed"].includes(raw.response_style) ? raw.response_style : existing.response_style;
  const quietEnabled = raw.quiet_hours_enabled === true;
  const quietStart = quietEnabled ? hhmm(raw.quiet_start) : null;
  const quietEnd = quietEnabled ? hhmm(raw.quiet_end) : null;
  if (quietEnabled && (!quietStart || !quietEnd)) throw new Error("QUIET_HOURS_REQUIRED");
  const customInstruction = firstString(raw.custom_instruction);
  if (customInstruction && customInstruction.length > 1000) throw new Error("CUSTOM_INSTRUCTION_TOO_LONG");
  const payload: Json = {
    destination_type: type,
    contact_id: type === "contact" ? id : null,
    individual_id: type === "individual" ? id : null,
    group_id: type === "group" ? id : null,
    conversation_mode: mode,
    response_style: style,
    quiet_hours_enabled: quietEnabled,
    quiet_start: quietStart,
    quiet_end: quietEnd,
    timezone: "America/Fortaleza",
    cooldown_seconds: clampInt(raw.cooldown_seconds, 4, 0, 300),
    max_replies_per_10m: clampInt(raw.max_replies_per_10m, 8, 1, 50),
    mention_only: type === "group" ? raw.mention_only === true : false,
    enable_buttons: raw.enable_buttons === true,
    enable_audio: raw.enable_audio === true,
    continue_in_app: raw.continue_in_app !== false,
    custom_instruction: customInstruction,
    updated_by: auth.userId === "service-role" ? null : auth.userId,
    updated_at: new Date().toISOString(),
  };
  let result;
  if (existing?.id) {
    result = await supabase.from("atis_destination_profiles").update(payload).eq("id", existing.id).select("*").single();
  } else {
    result = await supabase.from("atis_destination_profiles").insert(payload).select("*").single();
  }
  if (result.error) throw result.error;
  return result.data;
}

async function dashboard(supabase: any) {
  const now = Date.now();
  const since24h = new Date(now - 24 * 3600_000).toISOString();
  const since7d = new Date(now - 7 * 24 * 3600_000).toISOString();
  const [in24, in7, unanswered, prayers, groups] = await Promise.all([
    supabase.from("atis_inbound_messages").select("id", { count: "exact", head: true }).gte("received_at", since24h),
    supabase.from("atis_inbound_messages").select("id,remote_jid,status,assistant_route,is_group,error,received_at").gte("received_at", since7d).order("received_at", { ascending: false }).limit(5000),
    supabase.from("atis_unanswered_questions").select("id,status,reason,route,occurrence_count,last_seen_at").in("status", ["open", "reviewing"]).order("last_seen_at", { ascending: false }).limit(1000),
    supabase.from("atis_prayer_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "praying"]),
    supabase.from("atis_groups").select("id,name,provider_group_id").eq("is_active", true),
  ]);
  for (const result of [in24, in7, unanswered, prayers, groups]) if (result.error) throw result.error;

  const seven = in7.data ?? [];
  const activeUnanswered = unanswered.data ?? [];
  const replied = seven.filter((row: any) => row.status === "replied");
  const failed = seven.filter((row: any) => row.status === "failed");
  const ignored = seven.filter((row: any) => row.status === "ignored");
  const attempted = replied.length + failed.length;
  const conversations = new Set(seven.map((row: any) => row.remote_jid)).size;

  const routeCounts = new Map<string, number>();
  for (const row of replied) {
    if (!row.assistant_route) continue;
    routeCounts.set(row.assistant_route, (routeCounts.get(row.assistant_route) ?? 0) + 1);
  }
  const routes = [...routeCounts.entries()].map(([route, count]) => ({ route, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const failureCounts = new Map<string, number>();
  for (const row of failed) {
    const reason = firstString(row.error) ?? "erro_sem_codigo";
    failureCounts.set(reason, (failureCounts.get(reason) ?? 0) + 1);
  }
  const failure_reasons = [...failureCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const unansweredReasonCounts = new Map<string, number>();
  let unansweredOccurrences = 0;
  for (const row of activeUnanswered) {
    const count = Math.max(1, Number(row.occurrence_count ?? 1));
    unansweredOccurrences += count;
    const reason = firstString(row.reason) ?? "assistant_uncertain";
    unansweredReasonCounts.set(reason, (unansweredReasonCounts.get(reason) ?? 0) + count);
  }
  const unanswered_reasons = [...unansweredReasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const groupByJid = new Map<string, any>((groups.data ?? []).map((group: any): [string, any] => [String(group.provider_group_id), group]));
  const groupCounts = new Map<string, number>();
  const groupRoutes = new Map<string, Map<string, number>>();
  for (const row of replied) {
    if (!row.is_group || !groupByJid.has(row.remote_jid)) continue;
    groupCounts.set(row.remote_jid, (groupCounts.get(row.remote_jid) ?? 0) + 1);
    const route = row.assistant_route || "sem_rota";
    const routes = groupRoutes.get(row.remote_jid) ?? new Map<string, number>();
    routes.set(route, (routes.get(route) ?? 0) + 1);
    groupRoutes.set(row.remote_jid, routes);
  }
  const group_metrics = [...groupCounts.entries()].map(([jid, count]) => {
    const routes = [...(groupRoutes.get(jid)?.entries() ?? [])].sort((a, b) => b[1] - a[1]);
    return { id: groupByJid.get(jid)?.id, name: groupByJid.get(jid)?.name, messages_7d: count, top_route: routes[0]?.[0] ?? null, top_route_count: routes[0]?.[1] ?? 0, routes: routes.slice(0, 3).map(([route, route_count]) => ({ route, count: route_count })) };
  }).sort((a, b) => b.messages_7d - a.messages_7d).slice(0, 12);

  return {
    inbound_24h: in24.count ?? 0,
    inbound_7d: seven.length,
    conversations_7d: conversations,
    replied_7d: replied.length,
    failed_7d: failed.length,
    ignored_7d: ignored.length,
    private_7d: seven.filter((row: any) => !row.is_group).length,
    groups_7d: seven.filter((row: any) => row.is_group).length,
    reply_success_rate: attempted > 0 ? Math.round((replied.length / attempted) * 1000) / 10 : null,
    unanswered_open: activeUnanswered.length,
    unanswered_occurrences_open: unansweredOccurrences,
    prayer_open: prayers.count ?? 0,
    routes,
    failure_reasons,
    unanswered_reasons,
    group_metrics,
  };
}

async function historyList(supabase: any, raw: Json) {
  const limit = clampInt(raw.limit, 100, 1, 250);
  let query = supabase.from("atis_inbound_messages").select("id,remote_jid,sender_name,message_text,is_group,assistant_route,response_text,status,error,metadata,received_at,processed_at").order("received_at", { ascending: false }).limit(limit);
  const route = firstString(raw.route);
  if (route) query = query.eq("assistant_route", route);
  const status = firstString(raw.status);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function unansweredList(supabase: any, raw: Json) {
  const limit = clampInt(raw.limit, 100, 1, 250);
  let query = supabase.from("atis_unanswered_questions")
    .select("id,question,route,answer,reason,status,resolution_note,resolved_by,resolved_at,occurrence_count,first_seen_at,last_seen_at,created_at,updated_at")
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  const status = firstString(raw.status) ?? "active";
  if (status === "active") query = query.in("status", ["open", "reviewing"]);
  else if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function unansweredUpdate(supabase: any, auth: any, raw: Json) {
  const id = firstString(raw.id);
  if (!id) throw new Error("ID_REQUIRED");
  const status = ["open", "reviewing", "resolved", "ignored"].includes(raw.status) ? raw.status : null;
  if (!status) throw new Error("INVALID_STATUS");
  const note = firstString(raw.resolution_note);
  if (note && note.length > 2000) throw new Error("RESOLUTION_NOTE_TOO_LONG");
  const payload: Json = { status, resolution_note: note, updated_at: new Date().toISOString() };
  if (status === "resolved") {
    payload.resolved_at = new Date().toISOString();
    payload.resolved_by = auth.userId === "service-role" ? null : auth.userId;
  } else {
    payload.resolved_at = null;
    payload.resolved_by = null;
  }
  const { data, error } = await supabase.from("atis_unanswered_questions").update(payload).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

async function prayersList(supabase: any, raw: Json) {
  const limit = clampInt(raw.limit, 100, 1, 250);
  let query = supabase.from("atis_prayer_requests").select("*").order("created_at", { ascending: false }).limit(limit);
  const status = firstString(raw.status) ?? "active";
  if (status === "active") query = query.in("status", ["pending", "praying"]);
  else if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function prayerUpdate(supabase: any, raw: Json) {
  const id = firstString(raw.id);
  if (!id) throw new Error("ID_REQUIRED");
  const status = ["pending", "praying", "answered", "archived"].includes(raw.status) ? raw.status : null;
  if (!status) throw new Error("INVALID_STATUS");
  const note = firstString(raw.admin_note);
  const payload: Json = { status, admin_note: note, updated_at: new Date().toISOString(), answered_at: status === "answered" ? new Date().toISOString() : null };
  const { data, error } = await supabase.from("atis_prayer_requests").update(payload).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

async function automationsList(supabase: any) {
  const { data, error } = await supabase.from("atis_automations").select("id,key,name,description,type,enabled,timezone,trigger_type,schedule_cron,event_key,target_selector,config,last_run_at,next_run_at,created_at,updated_at").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function automationSave(supabase: any, auth: any, raw: Json) {
  const id = firstString(raw.id);
  const name = firstString(raw.name);
  const type = firstString(raw.type) ?? "custom";
  const triggerType = raw.trigger_type === "event" ? "event" : raw.trigger_type === "manual" ? "manual" : "schedule";
  if (!name || name.length > 160) throw new Error("AUTOMATION_NAME_REQUIRED");
  const allowedTypes = ["birthday", "welcome", "devotional", "daily_verse", "reading_plan", "broadcast", "series", "culto", "inactivity", "goal", "custom"];
  if (!allowedTypes.includes(type)) throw new Error("INVALID_AUTOMATION_TYPE");
  const scheduleCron = triggerType === "schedule" ? firstString(raw.schedule_cron) : null;
  if (triggerType === "schedule") {
    if (!scheduleCron) throw new Error("SCHEDULE_REQUIRED");
    validateCronExpression(scheduleCron);
  }
  const eventKey = triggerType === "event" ? firstString(raw.event_key) : null;
  if (triggerType === "event" && !eventKey) throw new Error("EVENT_KEY_REQUIRED");
  const content = firstString(raw.content, raw.config?.content);
  if (!content || content.length > 4096) throw new Error("AUTOMATION_CONTENT_REQUIRED");
  const key = firstString(raw.key) ?? `admin:${crypto.randomUUID()}`;
  const payload: Json = {
    key,
    name,
    description: firstString(raw.description),
    type,
    enabled: raw.enabled === true,
    timezone: "America/Fortaleza",
    trigger_type: triggerType,
    schedule_cron: scheduleCron,
    event_key: eventKey,
    target_selector: raw.target_selector && typeof raw.target_selector === "object" ? raw.target_selector : { mode: "all_opted_in" },
    config: { ...(raw.config && typeof raw.config === "object" ? raw.config : {}), content },
    updated_by: auth.userId === "service-role" ? null : auth.userId,
    updated_at: new Date().toISOString(),
  };
  let result;
  if (id) result = await supabase.from("atis_automations").update(payload).eq("id", id).select("*").single();
  else result = await supabase.from("atis_automations").insert({ ...payload, created_by: auth.userId === "service-role" ? null : auth.userId }).select("*").single();
  if (result.error) throw result.error;
  return result.data;
}

async function automationDelete(supabase: any, raw: Json) {
  const id = firstString(raw.id);
  if (!id) throw new Error("ID_REQUIRED");
  const { error } = await supabase.from("atis_automations").delete().eq("id", id);
  if (error) throw error;
  return { id };
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
  let body: Json = {};
  try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const action = firstString(body.action) ?? "dashboard";
  const data = body.data && typeof body.data === "object" ? body.data : body;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    if (action === "dashboard") return json({ ok: true, metrics: await dashboard(supabase) });
    if (action === "history_list") return json({ ok: true, rows: await historyList(supabase, data) });
    if (action === "unanswered_list") return json({ ok: true, rows: await unansweredList(supabase, data) });
    if (action === "unanswered_update") return json({ ok: true, row: await unansweredUpdate(supabase, auth, data) });
    if (action === "prayers_list") return json({ ok: true, rows: await prayersList(supabase, data) });
    if (action === "prayer_update") return json({ ok: true, row: await prayerUpdate(supabase, data) });
    if (action === "automations_list") return json({ ok: true, rows: await automationsList(supabase) });
    if (action === "automation_save") return json({ ok: true, row: await automationSave(supabase, auth, data) });
    if (action === "automation_delete") return json({ ok: true, row: await automationDelete(supabase, data) });
    if (action === "profile_get" || action === "profile_save") {
      const type = validDestinationType(data.destination_type);
      const id = firstString(data.id, data.destination_id);
      if (!type || !id) return json({ error: "DESTINATION_REQUIRED" }, 400);
      if (action === "profile_get") return json({ ok: true, profile: await profileGet(supabase, type, id) });
      return json({ ok: true, profile: await profileSave(supabase, auth, type, id, data) });
    }
    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const code = error instanceof Error ? error.message : "ATIS_CONSOLE_ERROR";
    console.error("[atis-console]", code);
    const bad = ["DESTINATION_NOT_FOUND", "DESTINATION_REQUIRED", "QUIET_HOURS_REQUIRED", "CUSTOM_INSTRUCTION_TOO_LONG", "ID_REQUIRED", "INVALID_STATUS", "AUTOMATION_NAME_REQUIRED", "INVALID_AUTOMATION_TYPE", "SCHEDULE_REQUIRED", "EVENT_KEY_REQUIRED", "AUTOMATION_CONTENT_REQUIRED", "CRON_REQUIRES_FIVE_FIELDS", "INVALID_CRON_FIELD", "INVALID_CRON_RANGE", "INVALID_CRON_VALUE", "INVALID_CRON_STEP"].includes(code);
    return json({ error: code, message: code }, code === "DESTINATION_NOT_FOUND" ? 404 : bad ? 400 : 500);
  }
});
