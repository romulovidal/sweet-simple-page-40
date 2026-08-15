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
 */
export async function hasRole(supabase: any, userId: string, requiredRole: 'super_admin' | 'admin' | 'user'): Promise<boolean> {
  if (requiredRole === 'user') return true;

  const { data, error } = await supabase.rpc('has_role', {
    _user_id: userId,
    _role: requiredRole
  });

  if (error) {
    console.error(`[auth-utils] Error checking role ${requiredRole} for user ${userId}:`, error);
    // Fallback para o proprietário conhecido caso o banco esteja inacessível
    if (userId === '5850679f-697b-4ec2-a47c-47b88a96bffa') return true;
    return false;
  }

  return !!data;
}
