import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import {
  EvolutionProvider,
  EvolutionProviderError,
  getEvolutionConfigFromEnv,
  type AtisInstanceStatus,
} from "../_shared/atis/evolution-provider.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeProviderTarget(target: any) {
  if (target.target_type === "group") return target.provider_target_id;
  if (typeof target.phone_e164 === "string") return target.phone_e164.replace(/\D/g, "");
  return null;
}

function normalizeState(raw: unknown): AtisInstanceStatus {
  const state = String(raw ?? "").trim().toLowerCase();
  if (["open", "connected", "online", "ready"].includes(state)) return "connected";
  if (["connecting", "opening"].includes(state)) return "connecting";
  if (["qrcode", "qr", "qr_required", "pairing"].includes(state)) return "qr_required";
  if (["close", "closed", "disconnected", "offline"].includes(state)) return "disconnected";
  if (["error", "failed"].includes(state)) return "error";
  return "unknown";
}

async function readDeliverySettings(supabase: any) {
  const { data, error } = await supabase.from("atis_settings").select("value").eq("key", "delivery").maybeSingle();
  if (error) throw error;
  const value = data?.value ?? {};
  const maxPerMinute = Math.max(1, Math.min(20, Number(value.max_messages_per_minute ?? 8) || 8));
  const minDelayMs = Math.max(0, Math.min(15000, Number(value.min_delay_ms ?? 3000) || 3000));
  const configuredDelays = Array.isArray(value.retry_delays_seconds)
    ? value.retry_delays_seconds.map((item: unknown) => Number(item)).filter((item: number) => Number.isFinite(item) && item >= 0)
    : [];
  const retryDelays = configuredDelays.length ? configuredDelays : [60, 300, 900];
  return { maxPerMinute, minDelayMs, retryDelays };
}

async function refreshInstanceStates(supabase: any, provider: EvolutionProvider) {
  const { data: instances, error } = await supabase.from("atis_instances").select("*").order("created_at", { ascending: true });
  if (error) throw error;

  const results: Array<{ id: string; name: string; status: string; provider_state?: string | null; error?: string }> = [];
  for (const instance of instances ?? []) {
    try {
      const state = await provider.connectionState(instance.external_instance_name || instance.name);
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        status: state.status,
        last_status_check_at: now,
        metadata: {
          ...(instance.metadata ?? {}),
          provider_state: state.providerState,
          last_provider_sync_at: now,
        },
      };
      if (state.status === "connected" && instance.status !== "connected") patch.last_connected_at = now;
      if (state.status === "disconnected" && instance.status === "connected") patch.last_disconnected_at = now;
      const { error: updateError } = await supabase.from("atis_instances").update(patch).eq("id", instance.id);
      if (updateError) throw updateError;
      results.push({ id: instance.id, name: instance.name, status: state.status, provider_state: state.providerState });
    } catch (error) {
      results.push({
        id: instance.id,
        name: instance.name,
        status: instance.status,
        error: error instanceof EvolutionProviderError ? error.code : "STATUS_REFRESH_FAILED",
      });
    }
  }
  return results;
}

function retryableError(error: unknown) {
  if (!(error instanceof EvolutionProviderError)) return true;
  return [408, 425, 429, 500, 502, 503, 504].includes(error.status) ||
    ["EVOLUTION_TIMEOUT", "EVOLUTION_NETWORK_ERROR"].includes(error.code);
}

function retryDelaySeconds(retryDelays: number[], attemptNo: number) {
  const index = Math.min(Math.max(attemptNo - 1, 0), retryDelays.length - 1);
  return Math.max(0, Math.min(86400, retryDelays[index] ?? 60));
}

async function insertAttempt(
  supabase: any,
  target: any,
  fields: {
    success: boolean;
    httpStatus?: number | null;
    providerMessageId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    durationMs: number;
  },
) {
  const { error } = await supabase.from("atis_message_attempts").insert({
    target_id: target.id,
    attempt_no: target.attempt_count,
    provider: "evolution",
    http_status: fields.httpStatus ?? null,
    provider_message_id: fields.providerMessageId ?? null,
    success: fields.success,
    error_code: fields.errorCode ?? null,
    error_message: fields.errorMessage?.slice(0, 1000) ?? null,
    duration_ms: fields.durationMs,
    response_meta: {},
  });
  if (error && error.code !== "23505") throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const auth = await validateAdminAuth(req, supabaseUrl, serviceKey);
  if (!auth.authorized) return json({ error: "UNAUTHORIZED", message: auth.error }, 401);
  if (auth.role !== "service_role") {
    return json({ error: "SERVICE_ROLE_REQUIRED", message: "The queue worker is server-to-server only" }, 403);
  }

  let input: Record<string, unknown> = {};
  try {
    input = await req.json();
  } catch {
    // Empty cron body is valid.
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const provider = new EvolutionProvider(getEvolutionConfigFromEnv());
    const settings = await readDeliverySettings(supabase);
    const instanceStates = await refreshInstanceStates(supabase, provider);

    if (input.dry_run === true) {
      const { count, error: countError } = await supabase
        .from("atis_message_targets")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing"]);
      if (countError) throw countError;
      return json({
        dry_run: true,
        instances: instanceStates,
        nonterminal_targets: count ?? 0,
        delivery: { max_messages_per_run: settings.maxPerMinute, min_delay_ms: settings.minDelayMs },
      });
    }

    const requestedLimit = Number(input.limit ?? settings.maxPerMinute);
    const limit = Math.max(1, Math.min(settings.maxPerMinute, Number.isInteger(requestedLimit) ? requestedLimit : settings.maxPerMinute));
    const leaseSeconds = Math.max(60, Math.min(600, Math.ceil((limit * settings.minDelayMs) / 1000) + 60));
    const workerId = `atis-runner:${crypto.randomUUID()}`;

    const { data: claimed, error: claimError } = await supabase.rpc("atis_claim_message_targets", {
      _worker_id: workerId,
      _limit: limit,
      _lease_seconds: leaseSeconds,
    });
    if (claimError) throw claimError;

    if (!claimed?.length) {
      return json({ ok: true, idle: true, claimed: 0, sent: 0, retried: 0, failed: 0, instances: instanceStates });
    }

    let sent = 0;
    let retried = 0;
    let failed = 0;
    const outcomes: Array<{ target_id: string; status: string; attempt: number; error_code?: string }> = [];

    for (let index = 0; index < claimed.length; index++) {
      const target = claimed[index];
      const started = Date.now();

      const { data: message, error: messageError } = await supabase
        .from("atis_messages")
        .select("*")
        .eq("id", target.message_id)
        .maybeSingle();

      if (messageError || !message) {
        await insertAttempt(supabase, target, {
          success: false,
          errorCode: "MESSAGE_NOT_FOUND",
          errorMessage: messageError?.message ?? "Queue message does not exist",
          durationMs: Date.now() - started,
        });
        await supabase.from("atis_message_targets").update({
          status: "failed",
          failed_at: new Date().toISOString(),
          locked_at: null,
          locked_until: null,
          worker_id: null,
          last_error_code: "MESSAGE_NOT_FOUND",
          last_error_message: "Queue message does not exist",
        }).eq("id", target.id).eq("worker_id", workerId);
        failed++;
        outcomes.push({ target_id: target.id, status: "failed", attempt: target.attempt_count, error_code: "MESSAGE_NOT_FOUND" });
        continue;
      }

      const { data: instance, error: instanceError } = await supabase
        .from("atis_instances")
        .select("*")
        .eq("id", message.instance_id)
        .maybeSingle();

      if (instanceError || !instance || instance.status !== "connected") {
        const nextAttempt = Math.max(0, target.attempt_count - 1);
        await supabase.from("atis_message_targets").update({
          status: "pending",
          attempt_count: nextAttempt,
          available_at: new Date(Date.now() + 60_000).toISOString(),
          locked_at: null,
          locked_until: null,
          worker_id: null,
          last_error_code: "INSTANCE_NOT_CONNECTED",
          last_error_message: "WhatsApp instance is not connected",
        }).eq("id", target.id).eq("worker_id", workerId);
        retried++;
        outcomes.push({ target_id: target.id, status: "deferred", attempt: nextAttempt, error_code: "INSTANCE_NOT_CONNECTED" });
        continue;
      }

      const providerTarget = normalizeProviderTarget(target);
      if (!providerTarget || message.message_type !== "text") {
        const code = !providerTarget ? "INVALID_PROVIDER_TARGET" : "MESSAGE_TYPE_NOT_SUPPORTED";
        await insertAttempt(supabase, target, {
          success: false,
          errorCode: code,
          errorMessage: code,
          durationMs: Date.now() - started,
        });
        await supabase.from("atis_message_targets").update({
          status: "failed",
          failed_at: new Date().toISOString(),
          locked_at: null,
          locked_until: null,
          worker_id: null,
          last_error_code: code,
          last_error_message: code,
        }).eq("id", target.id).eq("worker_id", workerId);
        failed++;
        outcomes.push({ target_id: target.id, status: "failed", attempt: target.attempt_count, error_code: code });
        continue;
      }

      try {
        const providerResult = await provider.sendText(
          instance.external_instance_name || instance.name,
          providerTarget,
          message.content,
          0,
        );
        const durationMs = Date.now() - started;
        await insertAttempt(supabase, target, {
          success: true,
          httpStatus: 200,
          providerMessageId: providerResult.providerMessageId,
          durationMs,
        });
        const { error: targetUpdateError } = await supabase.from("atis_message_targets").update({
          status: "sent",
          provider_message_id: providerResult.providerMessageId,
          sent_at: new Date().toISOString(),
          failed_at: null,
          locked_at: null,
          locked_until: null,
          worker_id: null,
          last_error_code: null,
          last_error_message: null,
        }).eq("id", target.id).eq("worker_id", workerId);
        if (targetUpdateError) throw targetUpdateError;
        sent++;
        outcomes.push({ target_id: target.id, status: "sent", attempt: target.attempt_count });
      } catch (error) {
        const durationMs = Date.now() - started;
        const code = error instanceof EvolutionProviderError ? error.code : "SEND_ERROR";
        const messageText = error instanceof Error ? error.message : "Provider send failed";
        const statusCode = error instanceof EvolutionProviderError ? error.status : null;
        const canRetry = retryableError(error) && target.attempt_count < target.max_attempts;

        await insertAttempt(supabase, target, {
          success: false,
          httpStatus: statusCode,
          errorCode: code,
          errorMessage: messageText,
          durationMs,
        });

        if (canRetry) {
          const delaySeconds = retryDelaySeconds(settings.retryDelays, target.attempt_count);
          await supabase.from("atis_message_targets").update({
            status: "pending",
            available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
            locked_at: null,
            locked_until: null,
            worker_id: null,
            last_error_code: code,
            last_error_message: messageText.slice(0, 1000),
          }).eq("id", target.id).eq("worker_id", workerId);
          retried++;
          outcomes.push({ target_id: target.id, status: "retry", attempt: target.attempt_count, error_code: code });
        } else {
          await supabase.from("atis_message_targets").update({
            status: "failed",
            failed_at: new Date().toISOString(),
            locked_at: null,
            locked_until: null,
            worker_id: null,
            last_error_code: code,
            last_error_message: messageText.slice(0, 1000),
          }).eq("id", target.id).eq("worker_id", workerId);
          failed++;
          outcomes.push({ target_id: target.id, status: "failed", attempt: target.attempt_count, error_code: code });
        }
      }

      if (index < claimed.length - 1 && settings.minDelayMs > 0) await sleep(settings.minDelayMs);
    }

    return json({
      ok: true,
      idle: false,
      worker_id: workerId,
      claimed: claimed.length,
      sent,
      retried,
      failed,
      outcomes,
      instances: instanceStates,
    });
  } catch (error) {
    console.error("[atis-runner] fatal", error instanceof Error ? error.message : error);
    return json({ error: "ATIS_RUNNER_ERROR", message: error instanceof Error ? error.message : "Runner failed" }, 500);
  }
});
