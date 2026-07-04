import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  retryAfter: number;
}

/**
 * Atomically check + increment a rate limit counter.
 * Backed by public.check_and_increment_rate_limit (SECURITY DEFINER, service_role only).
 *
 * On any failure (DB down, etc), returns allowed=true (fail-open) to avoid
 * blocking legitimate users when Postgres is unhealthy — errors are logged.
 */
export async function checkRateLimit(
  supabaseAdmin: SupabaseClient,
  identifier: string,
  endpoint: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabaseAdmin.rpc("check_and_increment_rate_limit", {
      _identifier: identifier,
      _endpoint: endpoint,
      _max: max,
      _window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] rpc error:", JSON.stringify(error), "for", endpoint, identifier);
      return { allowed: true, current: 0, limit: max, retryAfter: 0 };
    }
    console.log("[rate-limit] ok:", endpoint, identifier, JSON.stringify(data));
    const d = data as { allowed: boolean; current: number; limit: number; retry_after: number };
    return {
      allowed: d.allowed,
      current: d.current,
      limit: d.limit,
      retryAfter: d.retry_after,
    };
  } catch (e) {
    console.error("[rate-limit] exception:", e);
    return { allowed: true, current: 0, limit: max, retryAfter: 0 };
  }
}

export function rateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "Muitas requisições. Tente novamente em alguns instantes.",
      retry_after: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

/** Best-effort client identifier: user id if available, else IP address. */
export function getClientIdentifier(req: Request, userId: string | null): string {
  if (userId) return `user:${userId}`;
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  return `ip:${ip}`;
}

export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function getRequestUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data } = await client.auth.getClaims(token);
    return (data?.claims?.sub as string) ?? null;
  } catch {
    return null;
  }
}