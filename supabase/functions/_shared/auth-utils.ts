import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Secure server-side authorization helper for administrative Edge Functions.
 *
 * - Internal service-to-service calls are accepted only when the Bearer token
 *   exactly matches SUPABASE_SERVICE_ROLE_KEY.
 * - User Bearer tokens are validated by Supabase Auth with auth.getUser(token).
 * - Administrative access is resolved from public.user_roles with service_role.
 * - No manual JWT decoding, hard-coded user bypasses, or unverified claims.
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

  // Trusted internal call. Never expose this key to client-side code.
  if (token === serviceKey) {
    return { authorized: true, userId: "service-role", isAdmin: true, role: "service_role" };
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validate the user token with Supabase Auth instead of trusting decoded claims.
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
