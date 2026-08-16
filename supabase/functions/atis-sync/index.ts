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
function normalizePhone(value: unknown, countryCode = "55") {
  if (typeof value !== "string" && typeof value !== "number") return null;
  let raw = String(value).trim().replace(/^00/, "+");
  let digits = raw.replace(/\D/g, "");
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
      const body = text ? JSON.parse(text) : null;
      if (!response.ok) throw new Error(`EVOLUTION_HTTP_${response.status}`);
      return body;
    } finally { clearTimeout(timer); }
  }
  async state(name: string) {
    const body = await this.request(`/instance/connectionState/${encodeURIComponent(name)}`);
    const raw = firstString(body?.instance?.state, body?.instance?.status, body?.state, body?.status)?.toLowerCase() ?? "unknown";
    const connected = ["open", "connected", "online", "ready"].includes(raw);
    return { connected, raw };
  }
  async groups(name: string, participants = false) {
    const body = await this.request(`/group/fetchAllGroups/${encodeURIComponent(name)}${participants ? "?getParticipants=true" : ""}`);
    return Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  }
}

async function defaultCountryCode(supabase: any) {
  const { data } = await supabase.from("atis_settings").select("value").eq("key", "defaults").maybeSingle();
  const value = data?.value?.default_country_code;
  return typeof value === "string" && /^\d{1,4}$/.test(value) ? value : "55";
}

async function syncAppContacts(supabase: any, countryCode: string) {
  const { data: profiles, error } = await supabase.from("profiles").select("user_id,display_name,whatsapp,whatsapp_opt_in").not("whatsapp", "is", null);
  if (error) throw error;
  const now = new Date().toISOString();
  const validUsers = new Set<string>();
  let created = 0, updated = 0, skipped = 0;

  for (const profile of profiles ?? []) {
    const phone = normalizePhone(profile.whatsapp, countryCode);
    if (!phone || !profile.user_id) { skipped++; continue; }
    validUsers.add(profile.user_id);
    const { data: current, error: currentError } = await supabase.from("atis_contacts").select("*").eq("user_id", profile.user_id).maybeSingle();
    if (currentError) throw currentError;
    const payload = {
      user_id: profile.user_id,
      name: firstString(profile.display_name) ?? phone,
      phone_e164: phone,
      source: "app",
      whatsapp_opt_in: profile.whatsapp_opt_in === true,
      opt_in_source: profile.whatsapp_opt_in === true ? "app_profile" : current?.opt_in_source ?? null,
      opt_in_at: profile.whatsapp_opt_in === true ? current?.opt_in_at ?? now : current?.opt_in_at ?? null,
      opt_out_at: profile.whatsapp_opt_in === true ? null : current?.whatsapp_opt_in ? now : current?.opt_out_at ?? null,
      is_active: true,
      metadata: { ...(current?.metadata ?? {}), app_profile_synced_at: now },
    };
    if (current) {
      const { error: updateError } = await supabase.from("atis_contacts").update(payload).eq("id", current.id);
      if (updateError) { skipped++; continue; }
      updated++;
    } else {
      const { error: insertError } = await supabase.from("atis_contacts").insert(payload);
      if (insertError) { skipped++; continue; }
      created++;
    }
  }

  const { data: existing, error: existingError } = await supabase.from("atis_contacts").select("id,user_id").eq("source", "app").eq("is_active", true);
  if (existingError) throw existingError;
  const staleIds = (existing ?? []).filter((c: any) => !c.user_id || !validUsers.has(c.user_id)).map((c: any) => c.id);
  if (staleIds.length) {
    const { error: staleError } = await supabase.from("atis_contacts").update({ is_active: false, whatsapp_opt_in: false, opt_out_at: now }).in("id", staleIds);
    if (staleError) throw staleError;
  }
  return { found: validUsers.size, created, updated, skipped, deactivated: staleIds.length };
}

function providerGroupId(group: any) { return firstString(group?.id, group?.jid, group?.remoteJid, group?.groupJid); }
function participantId(p: any) { return firstString(p?.id, p?.jid, p?.remoteJid, p?.phoneNumber, p?.phone); }
function memberPhone(p: any, countryCode: string) {
  const id = participantId(p);
  if (!id || id.endsWith("@lid")) return normalizePhone(p?.phoneNumber ?? p?.phone, countryCode);
  return normalizePhone(id.replace(/@s\.whatsapp\.net$/i, ""), countryCode);
}
async function loadInstance(supabase: any, input: Json) {
  let q = supabase.from("atis_instances").select("*").limit(1);
  q = typeof input.instance_id === "string" && input.instance_id ? q.eq("id", input.instance_id) : q.eq("name", "atis-main");
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("INSTANCE_NOT_FOUND");
  return data;
}

async function refreshRegisteredGroups(supabase: any, input: Json, countryCode: string) {
  const instance = await loadInstance(supabase, input);
  const { data: registered, error } = await supabase.from("atis_groups").select("*").eq("instance_id", instance.id).eq("is_active", true);
  if (error) throw error;
  if (!registered?.length) return { registered: 0, refreshed: 0, unavailable: 0, members: 0 };
  const provider = new Evolution();
  const state = await provider.state(instance.external_instance_name || instance.name);
  if (!state.connected) throw new Error("INSTANCE_NOT_CONNECTED");
  const available = await provider.groups(instance.external_instance_name || instance.name, true);
  const map = new Map<string, any>();
  for (const group of available) { const id = providerGroupId(group); if (id?.endsWith("@g.us")) map.set(id, group); }
  const now = new Date().toISOString();
  let refreshed = 0, unavailable = 0, members = 0;
  for (const row of registered) {
    const group = map.get(row.provider_group_id);
    if (!group) {
      await supabase.from("atis_groups").update({ provider_exists: false, last_seen_at: now, synced_at: now }).eq("id", row.id);
      unavailable++;
      continue;
    }
    const participants = Array.isArray(group?.participants) ? group.participants : Array.isArray(group?.participantsData) ? group.participantsData : [];
    await supabase.from("atis_groups").update({
      name: firstString(group?.subject, group?.name) ?? row.name,
      description: firstString(group?.desc, group?.description),
      participant_count: Number.isInteger(group?.size) ? group.size : participants.length,
      provider_exists: true,
      last_seen_at: now,
      synced_at: now,
      metadata: { ...(row.metadata ?? {}), owner: firstString(group?.owner), announce: typeof group?.announce === "boolean" ? group.announce : null, restrict: typeof group?.restrict === "boolean" ? group.restrict : null, picture_url: firstString(group?.pictureUrl, group?.profilePicUrl) },
    }).eq("id", row.id);
    await supabase.from("atis_group_members").update({ is_active: false, synced_at: now }).eq("group_id", row.id);
    const memberRows = participants.map((p: any) => {
      const pid = participantId(p); if (!pid) return null;
      const admin = firstString(p?.admin)?.toLowerCase();
      return { group_id: row.id, provider_member_id: pid, phone_e164: memberPhone(p, countryCode), display_name: firstString(p?.name, p?.pushName, p?.notify), is_admin: admin === "admin" || admin === "superadmin" || p?.isAdmin === true, is_super_admin: admin === "superadmin" || p?.isSuperAdmin === true, is_active: true, synced_at: now, metadata: {} };
    }).filter(Boolean);
    for (let i = 0; i < memberRows.length; i += 200) {
      const batch = memberRows.slice(i, i + 200);
      const { error: memberError } = await supabase.from("atis_group_members").upsert(batch, { onConflict: "group_id,provider_member_id" });
      if (memberError) throw memberError;
      members += batch.length;
    }
    refreshed++;
  }
  return { registered: registered.length, refreshed, unavailable, members };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return json({ error: "SERVER_CONFIG_MISSING" }, 500);
  const auth = await authorize(req, url, key);
  if (!auth.ok) return json({ error: auth.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED", message: auth.error }, auth.status);
  let input: Json = {};
  try { input = await req.json(); } catch {}
  const action = String(input.action ?? "all");
  if (action === "provider_contacts") {
    return json({ error: "CONTACT_BOOK_IMPORT_DISABLED", message: "ATIS never imports contacts from the connected WhatsApp account." }, 410);
  }
  if (!["all", "app_contacts", "registered_groups"].includes(action)) return json({ error: "UNKNOWN_ACTION" }, 400);
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const countryCode = await defaultCountryCode(supabase);
    const result: Json = { action, contact_book_import: "disabled" };
    if (action === "all" || action === "app_contacts") result.app_contacts = await syncAppContacts(supabase, countryCode);
    if (action === "all" || action === "registered_groups") result.registered_groups = await refreshRegisteredGroups(supabase, input, countryCode);
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATIS_SYNC_ERROR";
    const status = message === "INSTANCE_NOT_CONNECTED" ? 409 : message === "INSTANCE_NOT_FOUND" ? 404 : 500;
    console.error("[atis-sync]", message);
    return json({ error: message, message }, status);
  }
});