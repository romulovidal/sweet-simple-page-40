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
