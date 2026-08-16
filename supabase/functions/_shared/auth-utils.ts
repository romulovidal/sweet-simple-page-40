import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decodeJwtPayload, getProjectRef } from "./auth-utils.ts";

/**
 * Enhanced admin validation that uses a service role client to bypass RLS.
 * Essential for serverless environments where session context is not available.
 */
export async function validateAdminAuth(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  console.log(`[auth-utils] Validating auth. Header present: ${!!authHeader}, Token present: ${!!token}`);

  if (!token || token.length < 10) {
    return { authorized: false, error: "Missing or invalid token" };
  }

  // 1. service_role key match
  if (token === serviceKey) {
    console.log("[auth-utils] Service role key match");
    return { authorized: true, userId: "service-role", isAdmin: true };
  }

  // 2. JWT decode and checks
  const payload = decodeJwtPayload(token);
  if (!payload) {
    console.error("[auth-utils] Failed to decode JWT payload");
    return { authorized: false, error: "Invalid JWT format" };
  }

  const projectRef = getProjectRef(supabaseUrl);
  
  // Check if it's a service_role token via claims
  if (payload.role === "service_role" && payload.ref === projectRef) {
    console.log("[auth-utils] JWT service_role claim match");
    return { authorized: true, userId: "service-role", isAdmin: true };
  }

  const userId = payload.sub;
  if (!userId) {
    console.error("[auth-utils] JWT payload missing 'sub' claim");
    return { authorized: false, error: "Invalid token sub" };
  }

  // Bypass for owner
  if (userId === '5850679f-697b-4ec2-a47c-47b88a96bffa') {
    console.log("[auth-utils] Owner bypass active for:", userId);
    return { authorized: true, userId, isAdmin: true };
  }

  // Query database for roles using service client (bypassing RLS)
  try {
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    console.log("[auth-utils] Checking role in DB for:", userId);
    const { data: hasAdmin, error: roleError } = await serviceClient.rpc("check_user_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (roleError) {
      console.error(`[auth-utils] RPC check_user_role failed:`, roleError);
      return { authorized: false, error: "Database verification failed" };
    }

    console.log(`[auth-utils] Role check result for ${userId}: ${!!hasAdmin}`);
    return { authorized: !!hasAdmin, userId, isAdmin: !!hasAdmin };
  } catch (err) {
    console.error("[auth-utils] Unexpected error during role check:", err);
    return { authorized: false, error: "Internal auth error" };
  }
}
