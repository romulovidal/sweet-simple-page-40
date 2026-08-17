import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Json = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}
function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v).trim()).filter(Boolean))].slice(0, 50);
}
function validDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("INVALID_BIRTH_DATE");
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw new Error("INVALID_BIRTH_DATE");
  return text;
}
function normalizePhone(value: unknown, countryCode = "55") {
  if (typeof value !== "string" && typeof value !== "number") return null;
  let digits = String(value).trim().replace(/^00/, "+").replace(/\D/g, "");
  if ((digits.length === 10 || digits.length === 11) && countryCode) digits = `${countryCode}${digits}`;
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}
async function authorize(req: Request, url: string, serviceKey: string) {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Missing token" };
  if (token === serviceKey) return { ok: true, role: "service_role", userId: null as string | null };
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: "Invalid or expired token" };
  const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", data.user.id).in("role", ["admin", "super_admin"]);
  if (roleError) return { ok: false, status: 500, error: "Role validation failed" };
  const role = roles?.some((r: any) => r.role === "super_admin") ? "super_admin" : roles?.some((r: any) => r.role === "admin") ? "admin" : null;
  if (!role) return { ok: false, status: 403, error: "Administrative access required" };
  return { ok: true, role, userId: data.user.id };
}

class Evolution {
  baseUrl: string;
  key: string;
  constructor() {
    this.baseUrl = (Deno.env.get("EVOLUTION_API_URL") || Deno.env.get("EVOLUTION_URL") || "").trim().replace(/\/+$/, "");
    this.key = (Deno.env.get("EVOLUTION_API_KEY") || Deno.env.get("EVOLUTION_KEY") || Deno.env.get("EVOLUTION_GLOBAL_API_KEY") || "").trim();
    if (!this.baseUrl || !this.key) throw new Error("EVOLUTION_CONFIG_MISSING");
    if (!/^https?:\/\//i.test(this.baseUrl)) this.baseUrl = `https://${this.baseUrl}`;
  }
  async request(path: string, timeoutMs = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { headers: { apikey: this.key }, signal: controller.signal });
      const text = await response.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }
      if (!response.ok) throw new Error(`EVOLUTION_HTTP_${response.status}`);
      return body;
    } finally { clearTimeout(timer); }
  }
  async state(name: string) {
    const body = await this.request(`/instance/connectionState/${encodeURIComponent(name)}`);
    const raw = firstString(body?.instance?.state, body?.instance?.status, body?.state, body?.status)?.toLowerCase() ?? "unknown";
    return { connected: ["open", "connected", "online", "ready"].includes(raw), raw };
  }
  async groups(name: string, participants = false) {
    const body = await this.request(`/group/fetchAllGroups/${encodeURIComponent(name)}?getParticipants=${participants ? "true" : "false"}`);
    return Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  }
}
function providerGroupId(group: any) { return firstString(group?.id, group?.jid, group?.remoteJid, group?.groupJid); }
function participantId(p: any) { return firstString(p?.id, p?.jid, p?.remoteJid, p?.phoneNumber, p?.phone); }
function participantPhone(p: any) {
  const direct = firstString(p?.phoneNumber, p?.phone);
  if (direct) return normalizePhone(direct);
  const id = participantId(p);
  if (!id || id.endsWith("@lid")) return null;
  return normalizePhone(id.replace(/@s\.whatsapp\.net$/i, ""));
}
async function loadInstance(supabase: any, input: Json) {
  let q = supabase.from("atis_instances").select("*").limit(1);
  q = typeof input.instance_id === "string" && input.instance_id ? q.eq("id", input.instance_id) : q.eq("name", "atis-main");
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("INSTANCE_NOT_FOUND");
  return data;
}
async function providerGroups(supabase: any, input: Json, participants = false) {
  const instance = await loadInstance(supabase, input);
  const evolution = new Evolution();
  const state = await evolution.state(instance.external_instance_name || instance.name);
  if (!state.connected) throw new Error("INSTANCE_NOT_CONNECTED");
  const groups = await evolution.groups(instance.external_instance_name || instance.name, participants);
  return { instance, groups };
}
async function refreshOneGroup(supabase: any, input: Json, groupRow: any) {
  const { groups } = await providerGroups(supabase, { ...input, instance_id: groupRow.instance_id }, true);
  const found = groups.find((g: any) => providerGroupId(g) === groupRow.provider_group_id);
  const now = new Date().toISOString();
  if (!found) {
    await supabase.from("atis_groups").update({ provider_exists: false, last_seen_at: now, synced_at: now }).eq("id", groupRow.id);
    return { found: false, members: 0 };
  }
  const participants = Array.isArray(found?.participants) ? found.participants : Array.isArray(found?.participantsData) ? found.participantsData : [];
  const { data: updated, error } = await supabase.from("atis_groups").update({
    name: firstString(found?.subject, found?.name) ?? groupRow.name,
    description: firstString(found?.desc, found?.description),
    participant_count: Number.isInteger(found?.size) ? found.size : participants.length,
    provider_exists: true,
    last_seen_at: now,
    synced_at: now,
    metadata: { ...(groupRow.metadata ?? {}), owner: firstString(found?.owner), announce: typeof found?.announce === "boolean" ? found.announce : null, restrict: typeof found?.restrict === "boolean" ? found.restrict : null, picture_url: firstString(found?.pictureUrl, found?.profilePicUrl) },
  }).eq("id", groupRow.id).select("*").single();
  if (error) throw error;
  await supabase.from("atis_group_members").update({ is_active: false, synced_at: now }).eq("group_id", groupRow.id);
  const rows = participants.map((p: any) => {
    const pid = participantId(p); if (!pid) return null;
    const admin = firstString(p?.admin)?.toLowerCase();
    return { group_id: groupRow.id, provider_member_id: pid, phone_e164: participantPhone(p), display_name: firstString(p?.name, p?.pushName, p?.notify), is_admin: admin === "admin" || admin === "superadmin" || p?.isAdmin === true, is_super_admin: admin === "superadmin" || p?.isSuperAdmin === true, is_active: true, synced_at: now, metadata: {} };
  }).filter(Boolean);
  for (let i = 0; i < rows.length; i += 200) {
    const { error: memberError } = await supabase.from("atis_group_members").upsert(rows.slice(i, i + 200), { onConflict: "group_id,provider_member_id" });
    if (memberError) throw memberError;
  }
  return { found: true, group: updated, members: rows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);
  const auth = await authorize(req, url, serviceKey);
  if (!auth.ok) return json({ error: auth.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED", message: auth.error }, auth.status);
  let input: Json = {};
  try { input = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const action = String(input.action ?? "");
  const data = input.data && typeof input.data === "object" ? input.data : input;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    if (action === "summary") {
      const [c, i, g] = await Promise.all([
        supabase.from("atis_contacts").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("atis_individuals").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("atis_groups").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      return json({ contacts: c.count ?? 0, individuals: i.count ?? 0, groups: g.count ?? 0 });
    }
    if (action === "contacts_list") {
      let q = supabase.from("atis_contacts").select("id,user_id,name,phone_e164,tags,notes,birth_date,whatsapp_opt_in,is_active,blocked,blocked_reason,updated_at").eq("source", "app").order("name");
      if (data.active_only !== false) q = q.eq("is_active", true);
      if (data.opted_in === true) q = q.eq("whatsapp_opt_in", true);
      if (data.opted_in === false) q = q.eq("whatsapp_opt_in", false);
      const { data: rows, error } = await q.limit(500); if (error) throw error;
      const search = firstString(data.search)?.toLowerCase();
      const filtered = search ? (rows ?? []).filter((r: any) => `${r.name} ${r.phone_e164}`.toLowerCase().includes(search)) : rows ?? [];
      return json({ contacts: filtered });
    }
    if (action === "contact_update_meta") {
      const id = firstString(data.id); if (!id) return json({ error: "CONTACT_ID_REQUIRED" }, 400);
      const patch: Json = {};
      if (data.tags !== undefined) patch.tags = cleanTags(data.tags);
      if (data.notes !== undefined) patch.notes = firstString(data.notes);
      if (data.birth_date !== undefined) patch.birth_date = validDate(data.birth_date);
      if (data.blocked !== undefined) patch.blocked = data.blocked === true;
      if (data.blocked_reason !== undefined) patch.blocked_reason = firstString(data.blocked_reason);
      const { data: row, error } = await supabase.from("atis_contacts").update(patch).eq("id", id).eq("source", "app").select("*").single();
      if (error) throw error; return json({ contact: row });
    }
    if (action === "individuals_list") {
      let q = supabase.from("atis_individuals").select("*").order("name");
      if (data.active_only !== false) q = q.eq("is_active", true);
      const { data: rows, error } = await q.limit(500); if (error) throw error;
      const search = firstString(data.search)?.toLowerCase();
      return json({ individuals: search ? (rows ?? []).filter((r: any) => `${r.name} ${r.phone_e164}`.toLowerCase().includes(search)) : rows ?? [] });
    }
    if (action === "individual_create") {
      const name = firstString(data.name); const phone = normalizePhone(data.phone ?? data.phone_e164);
      if (!name || !phone) return json({ error: "NAME_AND_VALID_PHONE_REQUIRED" }, 400);
      const { data: row, error } = await supabase.from("atis_individuals").insert({ name, phone_e164: phone, tags: cleanTags(data.tags), notes: firstString(data.notes), birth_date: validDate(data.birth_date), allow_messages: data.allow_messages !== false, is_active: true, blocked: false, metadata: {}, created_by: auth.userId }).select("*").single();
      if (error) { if ((error as any).code === "23505") return json({ error: "INDIVIDUAL_PHONE_ALREADY_EXISTS" }, 409); throw error; }
      return json({ individual: row }, 201);
    }
    if (action === "individual_update") {
      const id = firstString(data.id); if (!id) return json({ error: "INDIVIDUAL_ID_REQUIRED" }, 400);
      const patch: Json = {};
      if (data.name !== undefined) { const name = firstString(data.name); if (!name) return json({ error: "NAME_REQUIRED" }, 400); patch.name = name; }
      if (data.phone !== undefined || data.phone_e164 !== undefined) { const phone = normalizePhone(data.phone ?? data.phone_e164); if (!phone) return json({ error: "INVALID_PHONE" }, 400); patch.phone_e164 = phone; }
      if (data.tags !== undefined) patch.tags = cleanTags(data.tags);
      if (data.notes !== undefined) patch.notes = firstString(data.notes);
      if (data.birth_date !== undefined) patch.birth_date = validDate(data.birth_date);
      if (data.allow_messages !== undefined) patch.allow_messages = data.allow_messages === true;
      if (data.blocked !== undefined) patch.blocked = data.blocked === true;
      if (data.blocked_reason !== undefined) patch.blocked_reason = firstString(data.blocked_reason);
      if (data.is_active !== undefined) patch.is_active = data.is_active === true;
      const { data: row, error } = await supabase.from("atis_individuals").update(patch).eq("id", id).select("*").single();
      if (error) throw error; return json({ individual: row });
    }
    if (action === "individual_archive") {
      const id = firstString(data.id); if (!id) return json({ error: "INDIVIDUAL_ID_REQUIRED" }, 400);
      const { data: row, error } = await supabase.from("atis_individuals").update({ is_active: false, allow_messages: false }).eq("id", id).select("*").single();
      if (error) throw error; return json({ individual: row });
    }
    if (action === "groups_list") {
      const { data: rows, error } = await supabase.from("atis_groups").select("*").order("name"); if (error) throw error;
      return json({ groups: data.active_only === false ? rows ?? [] : (rows ?? []).filter((g: any) => g.is_active) });
    }
    if (action === "groups_available") {
      const { instance, groups } = await providerGroups(supabase, input, false);
      const { data: registered, error } = await supabase.from("atis_groups").select("provider_group_id,is_active").eq("instance_id", instance.id); if (error) throw error;
      const active = new Set((registered ?? []).filter((r: any) => r.is_active).map((r: any) => r.provider_group_id));
      const available = groups.map((g: any) => { const id = providerGroupId(g); if (!id?.endsWith("@g.us")) return null; return { provider_group_id: id, name: firstString(g?.subject, g?.name) ?? id, participant_count: Number.isInteger(g?.size) ? g.size : null, already_registered: active.has(id) }; }).filter(Boolean);
      return json({ groups: available, persisted_unregistered_groups: 0 });
    }
    if (action === "group_register") {
      const requested = firstString(data.provider_group_id); if (!requested?.endsWith("@g.us")) return json({ error: "VALID_PROVIDER_GROUP_ID_REQUIRED" }, 400);
      const { instance, groups } = await providerGroups(supabase, input, false);
      const found = groups.find((g: any) => providerGroupId(g) === requested); if (!found) return json({ error: "GROUP_NOT_AVAILABLE" }, 404);
      const now = new Date().toISOString();
      const { data: existing } = await supabase.from("atis_groups").select("*").eq("instance_id", instance.id).eq("provider_group_id", requested).maybeSingle();
      const payload = { instance_id: instance.id, provider_group_id: requested, name: firstString(found?.subject, found?.name) ?? requested, description: firstString(found?.desc, found?.description), participant_count: Number.isInteger(found?.size) ? found.size : 0, allow_manual_send: true, allow_automations: false, is_active: true, provider_exists: true, registered_by: auth.userId, registered_at: existing?.registered_at ?? now, last_seen_at: now, synced_at: now, metadata: { ...(existing?.metadata ?? {}), picture_url: firstString(found?.pictureUrl, found?.profilePicUrl) } };
      const query = existing ? supabase.from("atis_groups").update(payload).eq("id", existing.id) : supabase.from("atis_groups").insert(payload);
      const { data: saved, error } = await query.select("*").single(); if (error) throw error;
      const refreshed = await refreshOneGroup(supabase, input, saved);
      return json({ group: refreshed.group ?? saved, members: refreshed.members }, existing ? 200 : 201);
    }
    if (action === "group_update") {
      const id = firstString(data.id); if (!id) return json({ error: "GROUP_ID_REQUIRED" }, 400);
      const patch: Json = {};
      if (data.allow_manual_send !== undefined) patch.allow_manual_send = data.allow_manual_send === true;
      if (data.allow_automations !== undefined) patch.allow_automations = data.allow_automations === true;
      const { data: row, error } = await supabase.from("atis_groups").update(patch).eq("id", id).select("*").single(); if (error) throw error;
      return json({ group: row });
    }
    if (action === "group_refresh") {
      const id = firstString(data.id); if (!id) return json({ error: "GROUP_ID_REQUIRED" }, 400);
      const { data: row, error } = await supabase.from("atis_groups").select("*").eq("id", id).eq("is_active", true).maybeSingle(); if (error) throw error; if (!row) return json({ error: "GROUP_NOT_REGISTERED" }, 404);
      return json(await refreshOneGroup(supabase, input, row));
    }
    if (action === "group_members") {
      const id = firstString(data.id); if (!id) return json({ error: "GROUP_ID_REQUIRED" }, 400);
      const { data: rows, error } = await supabase.from("atis_group_members").select("provider_member_id,phone_e164,display_name,is_admin,is_super_admin,is_active,synced_at").eq("group_id", id).eq("is_active", true).order("display_name"); if (error) throw error;
      return json({ members: rows ?? [] });
    }
    if (action === "group_unregister") {
      const id = firstString(data.id); if (!id) return json({ error: "GROUP_ID_REQUIRED" }, 400);
      const { data: row, error } = await supabase.from("atis_groups").update({ is_active: false, allow_manual_send: false, allow_automations: false }).eq("id", id).select("*").single(); if (error) throw error;
      return json({ group: row });
    }
    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "ATIS_RECIPIENTS_ERROR";
    const message = rawMessage.startsWith("EVOLUTION_HTTP_") ? rawMessage.split(":")[0] : rawMessage;
    const status = message === "INSTANCE_NOT_CONNECTED" ? 409 : message === "INSTANCE_NOT_FOUND" ? 404 : message.startsWith("INVALID_") ? 400 : message.startsWith("EVOLUTION_HTTP_") ? 502 : 500;
    const friendly = message === "EVOLUTION_HTTP_400"
      ? "A Evolution recusou a consulta de grupos. Atualize a conexão e tente novamente."
      : message;
    console.error("[atis-recipients]", message);
    return json({ error: message, message: friendly }, status);
  }
});