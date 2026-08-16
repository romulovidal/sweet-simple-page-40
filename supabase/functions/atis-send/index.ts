import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Json = Record<string, any>;
type ResolvedTarget = {
  target_type: "individual" | "contact" | "group";
  target_key: string;
  contact_id: string | null;
  individual_id: string | null;
  group_id: string | null;
  phone_e164: string | null;
  provider_target_id: string | null;
  display_name: string | null;
  max_attempts: number;
  metadata: Record<string, unknown>;
};
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function firstString(...values: unknown[]) { for (const v of values) if (typeof v === "string" && v.trim()) return v.trim(); return null; }
async function authorize(req: Request, url: string, serviceKey: string) {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Missing token" };
  if (token === serviceKey) return { ok: true, role: "service_role", userId: "service-role" };
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: "Invalid or expired token" };
  const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", data.user.id).in("role", ["admin", "super_admin"]);
  if (roleError) return { ok: false, status: 500, error: "Role validation failed" };
  const role = roles?.some((r: any) => r.role === "super_admin") ? "super_admin" : roles?.some((r: any) => r.role === "admin") ? "admin" : null;
  if (!role) return { ok: false, status: 403, error: "Administrative access required" };
  return { ok: true, role, userId: data.user.id };
}
async function readSettings(supabase: any) {
  const { data, error } = await supabase.from("atis_settings").select("key,value").in("key", ["defaults", "delivery"]);
  if (error) throw error;
  const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value ?? {}]));
  const raw = Number(map.delivery?.max_attempts ?? 3);
  return { maxAttempts: Number.isInteger(raw) ? Math.max(1, Math.min(10, raw)) : 3 };
}
async function loadInstance(supabase: any, input: Json) {
  let q = supabase.from("atis_instances").select("*").limit(1);
  q = input.instance_id ? q.eq("id", input.instance_id) : q.eq("name", input.instance_name || "atis-main");
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("INSTANCE_NOT_FOUND");
  return data;
}
async function resolveTargets(supabase: any, rawTargets: unknown, options: { maxAttempts: number; sourceType: string; isSuperAdmin: boolean; overrideOptIn: boolean }) {
  if (!Array.isArray(rawTargets) || !rawTargets.length) throw new Error("TARGETS_REQUIRED");
  if (rawTargets.length > 500) throw new Error("TOO_MANY_TARGETS");
  const resolved: ResolvedTarget[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];
  const seen = new Set<string>();
  for (let index = 0; index < rawTargets.length; index++) {
    const raw = rawTargets[index] as any;
    const type = String(raw?.type ?? "").trim();
    if (type === "contact") {
      const id = firstString(raw?.contact_id, raw?.id);
      if (!id) { rejected.push({ index, reason: "CONTACT_ID_REQUIRED" }); continue; }
      const { data: c, error } = await supabase.from("atis_contacts").select("*").eq("id", id).eq("source", "app").maybeSingle();
      if (error) throw error;
      if (!c || !c.is_active) { rejected.push({ index, reason: "CONTACT_NOT_ACTIVE" }); continue; }
      if (c.blocked) { rejected.push({ index, reason: "CONTACT_BLOCKED" }); continue; }
      if (!c.whatsapp_opt_in && !(options.isSuperAdmin && options.overrideOptIn)) { rejected.push({ index, reason: "CONTACT_OPT_IN_REQUIRED" }); continue; }
      const key = `contact:${c.id}`; if (seen.has(key)) continue; seen.add(key);
      resolved.push({ target_type: "contact", target_key: key, contact_id: c.id, individual_id: null, group_id: null, phone_e164: c.phone_e164, provider_target_id: null, display_name: c.name, max_attempts: options.maxAttempts, metadata: options.overrideOptIn ? { opt_in_override: true } : {} });
      continue;
    }
    if (type === "individual") {
      const id = firstString(raw?.individual_id, raw?.id);
      if (!id) { rejected.push({ index, reason: "INDIVIDUAL_MUST_BE_REGISTERED" }); continue; }
      const { data: person, error } = await supabase.from("atis_individuals").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!person || !person.is_active) { rejected.push({ index, reason: "INDIVIDUAL_NOT_ACTIVE" }); continue; }
      if (person.blocked) { rejected.push({ index, reason: "INDIVIDUAL_BLOCKED" }); continue; }
      if (!person.allow_messages) { rejected.push({ index, reason: "INDIVIDUAL_MESSAGES_DISABLED" }); continue; }
      const key = `individual:${person.id}`; if (seen.has(key)) continue; seen.add(key);
      resolved.push({ target_type: "individual", target_key: key, contact_id: null, individual_id: person.id, group_id: null, phone_e164: person.phone_e164, provider_target_id: null, display_name: person.name, max_attempts: options.maxAttempts, metadata: {} });
      continue;
    }
    if (type === "group") {
      const id = firstString(raw?.group_id, raw?.id);
      if (!id) { rejected.push({ index, reason: "GROUP_ID_REQUIRED" }); continue; }
      const { data: g, error } = await supabase.from("atis_groups").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!g || !g.is_active || g.provider_exists === false) { rejected.push({ index, reason: "GROUP_NOT_ACTIVE" }); continue; }
      if (options.sourceType === "manual" && !g.allow_manual_send) { rejected.push({ index, reason: "GROUP_MANUAL_SEND_DISABLED" }); continue; }
      if (options.sourceType === "automation" && !g.allow_automations) { rejected.push({ index, reason: "GROUP_AUTOMATIONS_DISABLED" }); continue; }
      const key = `group:${g.id}`; if (seen.has(key)) continue; seen.add(key);
      resolved.push({ target_type: "group", target_key: key, contact_id: null, individual_id: null, group_id: g.id, phone_e164: null, provider_target_id: g.provider_group_id, display_name: g.name, max_attempts: options.maxAttempts, metadata: {} });
      continue;
    }
    rejected.push({ index, reason: "INVALID_TARGET_TYPE" });
  }
  if (!resolved.length) { const e: any = new Error("NO_VALID_TARGETS"); e.rejected = rejected; throw e; }
  return { resolved, rejected };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return json({ error: "SERVER_CONFIG_MISSING" }, 500);
  const auth = await authorize(req, url, key);
  if (!auth.ok) return json({ error: auth.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED", message: auth.error }, auth.status);
  let input: Json;
  try { input = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const content = String(input.content ?? "").trim();
    if (!content || content.length > 4096) return json({ error: "INVALID_CONTENT" }, 400);
    const messageType = String(input.message_type ?? "text");
    if (messageType !== "text") return json({ error: "MESSAGE_TYPE_NOT_READY" }, 422);
    const sourceType = String(input.source_type ?? "manual");
    if (!["manual", "automation", "event", "system"].includes(sourceType)) return json({ error: "INVALID_SOURCE_TYPE" }, 400);
    if (sourceType !== "manual" && auth.role !== "service_role") return json({ error: "SERVICE_ONLY_SOURCE" }, 403);
    const settings = await readSettings(supabase);
    const instance = await loadInstance(supabase, input);
    const overrideOptIn = input.override_opt_in === true;
    if (overrideOptIn && auth.role !== "super_admin" && auth.role !== "service_role") return json({ error: "SUPER_ADMIN_REQUIRED_FOR_OPT_IN_OVERRIDE" }, 403);
    const { resolved, rejected } = await resolveTargets(supabase, input.targets, { maxAttempts: settings.maxAttempts, sourceType, isSuperAdmin: auth.role === "super_admin" || auth.role === "service_role", overrideOptIn });
    if (input.dry_run === true) return json({ valid: true, dry_run: true, instance: { id: instance.id, name: instance.name, status: instance.status }, targets: resolved.map((t) => ({ type: t.target_type, key: t.target_key, display_name: t.display_name })), rejected });
    const clientRequestId = firstString(input.client_request_id);
    if (!clientRequestId || clientRequestId.length < 8 || clientRequestId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(clientRequestId)) return json({ error: "CLIENT_REQUEST_ID_REQUIRED" }, 400);
    const scheduled = input.scheduled_for ? new Date(input.scheduled_for) : new Date();
    if (Number.isNaN(scheduled.getTime())) return json({ error: "INVALID_SCHEDULE" }, 400);
    const priorityRaw = Number(input.priority ?? 0);
    const priority = Number.isInteger(priorityRaw) ? Math.max(-100, Math.min(100, priorityRaw)) : 0;
    const dedupeKey = `${sourceType}:${auth.userId}:${clientRequestId}`;
    const { data: existing, error: existingError } = await supabase.from("atis_messages").select("*").eq("dedupe_key", dedupeKey).maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const { data: targets } = await supabase.from("atis_message_targets").select("id,target_type,target_key,status,display_name").eq("message_id", existing.id);
      return json({ queued: false, idempotent_replay: true, message: existing, targets: targets ?? [] });
    }
    const { data: message, error: messageError } = await supabase.from("atis_messages").insert({
      instance_id: instance.id,
      source_type: sourceType,
      message_type: "text",
      content,
      status: "queued",
      priority,
      scheduled_for: scheduled.toISOString(),
      available_at: scheduled.toISOString(),
      dedupe_key: dedupeKey,
      metadata: { client_request_id: clientRequestId, rejected_target_count: rejected.length, ...(overrideOptIn ? { opt_in_override: true } : {}) },
      created_by: auth.userId === "service-role" ? null : auth.userId,
    }).select("*").single();
    if (messageError) throw messageError;
    const rows = resolved.map((t) => ({ message_id: message.id, ...t, status: "pending", available_at: scheduled.toISOString() }));
    const { data: saved, error: targetError } = await supabase.from("atis_message_targets").insert(rows).select("id,target_type,target_key,status,display_name");
    if (targetError) { await supabase.from("atis_messages").delete().eq("id", message.id); throw targetError; }
    return json({ queued: true, message, targets: saved ?? [], rejected, instance_status: instance.status }, 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : "ATIS_SEND_ERROR";
    const rejected = (error as any)?.rejected;
    console.error("[atis-send]", code);
    if (["TARGETS_REQUIRED", "TOO_MANY_TARGETS", "NO_VALID_TARGETS", "INSTANCE_NOT_FOUND"].includes(code)) return json({ error: code, ...(rejected ? { rejected } : {}) }, code === "INSTANCE_NOT_FOUND" ? 404 : 400);
    return json({ error: "ATIS_SEND_ERROR", message: code }, 500);
  }
});