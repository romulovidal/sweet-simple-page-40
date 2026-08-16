import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import {
  EvolutionProvider,
  EvolutionProviderError,
  getEvolutionConfigFromEnv,
  type AtisInstanceStatus,
} from "../_shared/atis/evolution-provider.ts";

type Json = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeError(error: unknown) {
  if (error instanceof EvolutionProviderError) {
    return {
      status: error.status >= 400 && error.status < 600 ? error.status : 500,
      body: {
        error: error.code,
        message: error.message,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "ATIS_INSTANCE_ERROR",
      message: error instanceof Error ? error.message : "Unexpected ATIS instance error",
    },
  };
}

function cleanName(value: unknown) {
  const name = String(value ?? "").trim();
  if (!/^[A-Za-z0-9._-]{2,64}$/.test(name)) {
    throw new EvolutionProviderError(
      "Instance name must contain only letters, numbers, dot, underscore or hyphen",
      400,
      "INVALID_INSTANCE_NAME",
    );
  }
  return name;
}

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray((value as any)?.data)) return (value as any).data;
  if ((value as any)?.instance && typeof (value as any).instance === "object") return [(value as any).instance];
  if (value && typeof value === "object") return [value];
  return [];
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function providerInstanceFields(item: any, fallbackName: string) {
  return {
    external_instance_id: firstString(item?.id, item?.instanceId, item?.instance?.instanceId),
    external_instance_name:
      firstString(item?.name, item?.instanceName, item?.instance?.instanceName) ?? fallbackName,
    connected_number: firstString(
      item?.ownerJid?.split?.("@")?.[0],
      item?.number,
      item?.instance?.number,
    ),
    connected_name: firstString(item?.profileName, item?.pushName, item?.instance?.profileName),
  };
}

function stateFromProviderItem(item: any): AtisInstanceStatus {
  const state = String(
    item?.connectionStatus?.state ?? item?.state ?? item?.status ?? item?.instance?.state ?? item?.instance?.status ?? "",
  ).toLowerCase();
  if (["open", "connected", "online", "ready"].includes(state)) return "connected";
  if (["connecting", "opening"].includes(state)) return "connecting";
  if (["qrcode", "qr", "qr_required", "pairing"].includes(state)) return "qr_required";
  if (["close", "closed", "disconnected", "offline"].includes(state)) return "disconnected";
  if (["error", "failed"].includes(state)) return "error";
  return "unknown";
}

async function loadInstance(supabase: any, input: Json) {
  let query = supabase.from("atis_instances").select("*").limit(1);

  if (typeof input.instance_id === "string" && input.instance_id) {
    query = query.eq("id", input.instance_id);
  } else if (typeof input.name === "string" && input.name) {
    query = query.eq("name", input.name);
  } else {
    throw new EvolutionProviderError("instance_id or name is required", 400, "INSTANCE_REQUIRED");
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new EvolutionProviderError("ATIS instance not found", 404, "INSTANCE_NOT_FOUND");
  return data;
}

async function persistProviderState(
  supabase: any,
  instance: any,
  status: AtisInstanceStatus,
  providerState: string | null,
  extra: Record<string, unknown> = {},
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    last_status_check_at: now,
    metadata: {
      ...(instance.metadata ?? {}),
      provider_state: providerState,
      last_provider_sync_at: now,
    },
    ...extra,
  };

  if (status === "connected" && instance.status !== "connected") patch.last_connected_at = now;
  if (status === "disconnected" && instance.status === "connected") patch.last_disconnected_at = now;

  const { data, error } = await supabase
    .from("atis_instances")
    .update(patch)
    .eq("id", instance.id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
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
  try {
    input = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const action = String(input.action ?? "status").trim();
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const evolutionConfig = getEvolutionConfigFromEnv();

  try {
    if (action === "diagnose") {
      const result: Record<string, unknown> = {
        configured: evolutionConfig.urlConfigured && evolutionConfig.keyConfigured,
        url_configured: evolutionConfig.urlConfigured,
        key_configured: evolutionConfig.keyConfigured,
        url_source: evolutionConfig.urlSource,
        key_source: evolutionConfig.keySource,
        provider: "evolution",
      };

      if (evolutionConfig.urlConfigured && evolutionConfig.keyConfigured) {
        try {
          const provider = new EvolutionProvider(evolutionConfig);
          result.health = await provider.health();
        } catch (error) {
          const safe = safeError(error);
          result.health = { ok: false, ...safe.body, http_status: safe.status };
        }
      }

      return json(result);
    }

    const provider = new EvolutionProvider(evolutionConfig);

    if (action === "list") {
      const { data, error } = await supabase.from("atis_instances").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return json({ instances: data ?? [] });
    }

    if (action === "create") {
      const name = cleanName(input.name ?? "atis-main");

      const { data: localExisting, error: localError } = await supabase
        .from("atis_instances")
        .select("*")
        .eq("name", name)
        .maybeSingle();
      if (localError) throw localError;

      if (localExisting) {
        return json({ created: false, attached: true, instance: localExisting });
      }

      let providerExisting: any = null;
      try {
        const fetched = await provider.fetchInstances(name);
        providerExisting = asArray(fetched).find((item) => {
          const providerName = firstString(item?.name, item?.instanceName, item?.instance?.instanceName);
          return providerName === name;
        }) ?? null;
      } catch (error) {
        if (!(error instanceof EvolutionProviderError) || ![400, 404].includes(error.status)) throw error;
      }

      if (providerExisting) {
        const fields = providerInstanceFields(providerExisting, name);
        const status = stateFromProviderItem(providerExisting);
        const { data, error } = await supabase
          .from("atis_instances")
          .insert({
            name,
            provider: "evolution",
            ...fields,
            status,
            last_status_check_at: new Date().toISOString(),
            metadata: { provider_state: providerExisting?.connectionStatus?.state ?? providerExisting?.state ?? null },
            created_by: auth.userId === "service-role" ? null : auth.userId,
          })
          .select("*")
          .single();
        if (error) throw error;
        return json({ created: false, attached: true, instance: data });
      }

      const created = await provider.createInstance(name);
      const { data, error } = await supabase
        .from("atis_instances")
        .insert({
          name,
          provider: "evolution",
          external_instance_id: created.instanceId,
          external_instance_name: created.instanceName,
          status: created.qr ? "qr_required" : created.status,
          last_status_check_at: new Date().toISOString(),
          metadata: {
            provider_state: created.providerState,
            integration: "WHATSAPP-BAILEYS",
          },
          created_by: auth.userId === "service-role" ? null : auth.userId,
        })
        .select("*")
        .single();
      if (error) throw error;

      return json({
        created: true,
        attached: false,
        instance: data,
        connection: {
          qr: created.qr,
          pairing_code: created.pairingCode,
          qr_count: created.qrCount,
        },
      }, 201);
    }

    const instance = await loadInstance(supabase, input);
    const providerName = instance.external_instance_name || instance.name;

    if (action === "status") {
      const state = await provider.connectionState(providerName);
      const updated = await persistProviderState(supabase, instance, state.status, state.providerState);
      return json({ instance: updated, provider_state: state.providerState });
    }

    if (action === "connect") {
      const connection = await provider.connect(providerName);
      const status: AtisInstanceStatus = connection.qr || connection.pairingCode ? "qr_required" : "connecting";
      const updated = await persistProviderState(supabase, instance, status, status);
      return json({
        instance: updated,
        connection: {
          qr: connection.qr,
          pairing_code: connection.pairingCode,
          qr_count: connection.qrCount,
        },
      });
    }

    if (action === "restart") {
      await provider.restart(providerName);
      let state: any = null;
      try {
        state = await provider.connectionState(providerName);
      } catch {
        // A restart can briefly make status unavailable; keep it as connecting.
      }
      const status: AtisInstanceStatus = state?.status ?? "connecting";
      const updated = await persistProviderState(supabase, instance, status, state?.providerState ?? "restarting");
      return json({ instance: updated });
    }

    if (action === "logout") {
      if (input.confirm !== true) {
        return json({ error: "CONFIRMATION_REQUIRED", message: "Set confirm=true to logout the WhatsApp session" }, 409);
      }
      await provider.logout(providerName);
      const updated = await persistProviderState(supabase, instance, "disconnected", "logout");
      return json({ instance: updated, logged_out: true });
    }

    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (error) {
    console.error("[atis-instance] failed", error instanceof Error ? error.message : error);
    const safe = safeError(error);
    return json(safe.body, safe.status);
  }
});
