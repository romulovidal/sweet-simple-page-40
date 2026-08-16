import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Compatibility helper for older imports. It only derives the project ref from
 * the configured URL and is not used as proof of authentication.
 */
export function getProjectRef(supabaseUrl: string) {
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

/**
 * Deprecated compatibility export. Authorization must never trust decoded JWT
 * claims. Returning null guarantees callers cannot use this as authentication.
 */
export function decodeJwtPayload(_token: string) {
  return null;
}

async function isVerifiedInternalServiceToken(
  token: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/is_internal_service_request`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    if (!response.ok) return false;
    return (await response.json().catch(() => false)) === true;
  } catch (error) {
    console.error("[auth-utils] Internal service token verification failed:", error);
    return false;
  }
}

/**
 * Secure server-side authorization helper for administrative Edge Functions.
 *
 * - Current service-to-service calls are accepted by exact secret match.
 * - Rotated/legacy service_role JWTs used by pg_net cron are verified by
 *   PostgREST before auth.jwt() is inspected by a server-only RPC.
 * - User Bearer tokens are validated by Supabase Auth with auth.getUser(token).
 * - Administrative access is resolved from public.user_roles with service_role.
 * - No hard-coded user bypasses and no authorization based on unverified JWT decoding.
 */
export async function validateAdminAuth(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return { authorized: false, error: "Missing token" };
  }

  if (!serviceKey) {
    console.error("[auth-utils] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return { authorized: false, error: "Server authentication is not configured" };
  }

  if (token === serviceKey) {
    return { authorized: true, userId: "service-role", isAdmin: true, role: "service_role" };
  }

  // pg_net may hold a still-valid service_role JWT in Vault that differs from
  // the current runtime secret. Let PostgREST verify that JWT cryptographically.
  if (await isVerifiedInternalServiceToken(token, supabaseUrl, serviceKey)) {
    return { authorized: true, userId: "service-role", isAdmin: true, role: "service_role" };
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
  const user = userData?.user;

  if (userError || !user) {
    console.error("[auth-utils] User token validation failed:", userError?.message ?? "no-user");
    return { authorized: false, error: "Invalid or expired token" };
  }

  const { data: roles, error: roleError } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "super_admin"]);

  if (roleError) {
    console.error("[auth-utils] Role validation failed:", roleError);
    return { authorized: false, error: "Role validation failed", userId: user.id };
  }

  const role = roles?.some((row: { role: string }) => row.role === "super_admin")
    ? "super_admin"
    : roles?.some((row: { role: string }) => row.role === "admin")
    ? "admin"
    : null;

  if (!role) {
    return { authorized: false, error: "Administrative access required", userId: user.id };
  }

  return { authorized: true, userId: user.id, isAdmin: true, role };
}
