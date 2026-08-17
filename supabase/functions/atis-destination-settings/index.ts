import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

type DestinationType = "contact" | "individual" | "group";
type FeatureKind = "ai" | "push";
type ScheduleMode = "system" | "custom_time";
type Json = Record<string, any>;

type CatalogItem = {
  kind: FeatureKind;
  key: string;
  label: string;
  description: string;
};

const AI_CATALOG: CatalogItem[] = [
  { kind: "ai", key: "ask_bible", label: "Pergunte à Bíblia", description: "Dúvidas bíblicas gerais, pastorais, éticas e doutrinárias." },
  { kind: "ai", key: "exegetai", label: "ExegettAI", description: "Exegese e estudos bíblicos aprofundados." },
  { kind: "ai", key: "chapter_summary", label: "Resumo de capítulo", description: "Síntese e pontos-chave de capítulos bíblicos." },
  { kind: "ai", key: "word_meaning", label: "Significado original", description: "Hebraico, grego, aramaico e análise lexical." },
  { kind: "ai", key: "connections", label: "Conexões bíblicas", description: "Referências cruzadas, temas e profecia/cumprimento." },
  { kind: "ai", key: "timeline", label: "Linha do tempo / contexto histórico", description: "Cronologia, costumes, impérios e contexto histórico." },
  { kind: "ai", key: "devotional", label: "Devocional", description: "Reflexões devocionais fundamentadas no conteúdo do app." },
];

const PUSH_CATALOG: CatalogItem[] = [
  { kind: "push", key: "general", label: "Push geral / manual", description: "Replica no WhatsApp os pushes gerais executados pelo painel do app." },
  { kind: "push", key: "daily-verse", label: "Versículo do dia", description: "Replica no WhatsApp o push nativo de versículo do dia." },
  { kind: "push", key: "motivational", label: "Mensagem motivacional", description: "Replica no WhatsApp os pushes nativos do tipo motivacional." },
  { kind: "push", key: "culto-reminder", label: "Lembrete de culto", description: "Replica no WhatsApp os lembretes nativos de culto." },
];

const CATALOG = [...AI_CATALOG, ...PUSH_CATALOG];

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

function validDestinationType(value: unknown): DestinationType | null {
  return value === "contact" || value === "individual" || value === "group" ? value : null;
}

function targetColumn(type: DestinationType) {
  return type === "contact" ? "contact_id" : type === "individual" ? "individual_id" : "group_id";
}

function targetTable(type: DestinationType) {
  return type === "contact" ? "atis_contacts" : type === "individual" ? "atis_individuals" : "atis_groups";
}

function defaultEnabled(type: DestinationType, kind: FeatureKind) {
  // Preserve the current direct-chat behavior for known direct destinations.
  // Push mirroring remains opt-in everywhere, and group AI remains off by default.
  if (kind === "push") return false;
  return type !== "group";
}

function normalizeTime(value: unknown) {
  const raw = firstString(value);
  if (!raw) return null;
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  return match ? `${match[1]}:${match[2]}:00` : null;
}

async function ensureDestination(supabase: any, type: DestinationType, id: string) {
  const { data, error } = await supabase.from(targetTable(type)).select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("DESTINATION_NOT_FOUND");
}

async function loadSettings(supabase: any, type: DestinationType, id: string) {
  const column = targetColumn(type);
  const { data, error } = await supabase
    .from("atis_destination_feature_settings")
    .select("id,feature_kind,feature_key,enabled,schedule_mode,custom_time,timezone,updated_at")
    .eq("destination_type", type)
    .eq(column, id);
  if (error) throw error;
  const byKey = new Map((data ?? []).map((row: any) => [`${row.feature_kind}:${row.feature_key}`, row]));
  return CATALOG.map((item) => {
    const stored = byKey.get(`${item.kind}:${item.key}`) as any;
    return {
      ...item,
      enabled: stored?.enabled ?? defaultEnabled(type, item.kind),
      schedule_mode: item.kind === "push" ? (stored?.schedule_mode ?? "system") : "system",
      custom_time: item.kind === "push" ? (stored?.custom_time?.slice?.(0, 5) ?? null) : null,
      timezone: stored?.timezone ?? "America/Fortaleza",
      configured: Boolean(stored),
    };
  });
}

async function saveOne(supabase: any, type: DestinationType, id: string, raw: Json) {
  const kind = raw.kind === "ai" || raw.kind === "push" ? raw.kind as FeatureKind : null;
  const key = firstString(raw.key);
  const catalog = CATALOG.find((item) => item.kind === kind && item.key === key);
  if (!catalog || !kind || !key) throw new Error("INVALID_FEATURE");

  const enabled = raw.enabled === true;
  let scheduleMode: ScheduleMode = "system";
  let customTime: string | null = null;
  if (kind === "push") {
    scheduleMode = raw.schedule_mode === "custom_time" ? "custom_time" : "system";
    if (scheduleMode === "custom_time") {
      customTime = normalizeTime(raw.custom_time);
      if (!customTime) throw new Error("CUSTOM_TIME_REQUIRED");
    }
  }

  const column = targetColumn(type);
  const { data: existing, error: findError } = await supabase
    .from("atis_destination_feature_settings")
    .select("id")
    .eq("destination_type", type)
    .eq(column, id)
    .eq("feature_kind", kind)
    .eq("feature_key", key)
    .maybeSingle();
  if (findError) throw findError;

  const payload: Json = {
    destination_type: type,
    feature_kind: kind,
    feature_key: key,
    enabled,
    schedule_mode: scheduleMode,
    custom_time: customTime,
    timezone: "America/Fortaleza",
    metadata: {},
    contact_id: type === "contact" ? id : null,
    individual_id: type === "individual" ? id : null,
    group_id: type === "group" ? id : null,
  };

  if (existing?.id) {
    const { error } = await supabase.from("atis_destination_feature_settings").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("atis_destination_feature_settings").insert(payload);
    if (error) throw error;
  }
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
  const action = firstString(input.action) ?? "get";
  const data = input.data && typeof input.data === "object" ? input.data : input;
  const type = validDestinationType(data.destination_type);
  const id = firstString(data.id, data.destination_id);
  if (!type || !id) return json({ error: "DESTINATION_REQUIRED" }, 400);

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    await ensureDestination(supabase, type, id);

    if (action === "get") {
      return json({
        destination_type: type,
        destination_id: id,
        timezone: "America/Fortaleza",
        settings: await loadSettings(supabase, type, id),
      });
    }

    if (action === "save") {
      if (!Array.isArray(data.settings)) return json({ error: "SETTINGS_REQUIRED" }, 400);
      for (const item of data.settings.slice(0, CATALOG.length)) await saveOne(supabase, type, id, item ?? {});
      return json({
        ok: true,
        destination_type: type,
        destination_id: id,
        timezone: "America/Fortaleza",
        settings: await loadSettings(supabase, type, id),
      });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const code = error instanceof Error ? error.message : "ATIS_DESTINATION_SETTINGS_ERROR";
    console.error("[atis-destination-settings]", code);
    const status = code === "DESTINATION_NOT_FOUND" ? 404 : ["INVALID_FEATURE", "CUSTOM_TIME_REQUIRED"].includes(code) ? 400 : 500;
    return json({ error: code, message: code }, status);
  }
});