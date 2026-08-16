export function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

export function getProjectRef(supabaseUrl: string): string {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0];
  } catch (e) {
    return "";
  }
}

/**
 * Verifica se um usuário possui um determinado role, respeitando a hierarquia:
 * super_admin > admin > user
 * Inclui bypass para o proprietário conhecido.
 */
export async function hasRole(supabase: any, userId: string, requiredRole: 'super_admin' | 'admin' | 'user'): Promise<boolean> {
  if (requiredRole === 'user') return true;

  // Proprietário sempre tem acesso administrativo
  if (userId === '5850679f-697b-4ec2-a47c-47b88a96bffa') return true;

  const { data, error } = await supabase.rpc('check_user_role', {
    _user_id: userId,
    _role: requiredRole
  });

  if (error) {
    console.error(`[auth-utils] Error checking role ${requiredRole} for user ${userId}:`, error);
    return false;
  }

  return !!data;
}

/**
 * Helper para validar autorização de admin/service_role em Edge Functions
 */
export async function validateAdminAuth(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) return { authorized: false, error: "Missing token" };

  // 1. service_role key match
  if (token === serviceKey) {
    return { authorized: true, userId: "service-role", isAdmin: true };
  }

  // 2. JWT service_role claim check
  const payload = decodeJwtPayload(token);
  const projectRef = getProjectRef(supabaseUrl);
  if (payload?.role === "service_role" && payload?.ref === projectRef) {
    return { authorized: true, userId: "service-role", isAdmin: true };
  }

  // 3. Authenticated user check
  const userId = payload?.sub;
  if (!userId) return { authorized: false, error: "Invalid token payload" };

  // Bypass para proprietário
  if (userId === '5850679f-697b-4ec2-a47c-47b88a96bffa') {
    return { authorized: true, userId, isAdmin: true };
  }

  // Query DB para outros usuários
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: isAdmin, error: roleError } = await serviceClient.rpc("check_user_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (roleError) {
    console.error(`[auth-utils] Role check error for ${userId}:`, roleError);
    return { authorized: false, error: "Database role check failed" };
  }

  return { authorized: !!isAdmin, userId, isAdmin: !!isAdmin };
}
