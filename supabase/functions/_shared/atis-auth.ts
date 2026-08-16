
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
};

/**
 * Validação de Admin/Super Admin seguindo o padrão send-push
 */
export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!authHeader.startsWith("Bearer ")) {
    return { 
      error: new Response(
        JSON.stringify({ error: "Unauthorized", details: "Missing token" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ) 
    };
  }

  const token = authHeader.replace(/^Bearer\s+/, "");
  
  // Se for a própria service role chamando internamente
  if (token === serviceKey) {
    return { userId: "service-role", role: "service_role" };
  }

  // Autenticação real do token via Supabase Auth
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
  
  const userId = user?.id;

  if (authError || !userId) {
    console.error(`[ATIS-Auth] JWT verification failed:`, authError);
    return { 
      error: new Response(
        JSON.stringify({ error: "Unauthorized", details: "Invalid token" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ) 
    };
  }

  console.log(`[ATIS-Auth] Validating role for user ${userId}...`);
  
  // Chamada à RPC que respeita a hierarquia
  const { data: role, error: roleError } = await serviceClient.rpc("check_user_role", {
    _user_id: userId,
    _role: "admin", // O check_user_role geralmente retorna true se for admin OU super_admin
  });

  if (roleError) {
    console.error(`[ATIS-Auth] DB Role check error for ${userId}:`, roleError);
    // Bypass para o proprietário em caso de falha crítica no banco
    if (userId === '5850679f-697b-4ec2-a47c-47b88a96bffa') {
      console.log("[ATIS-Auth] Emergency bypass for super_admin owner");
      return { userId, role: "super_admin" };
    }
    return { 
      error: new Response(
        JSON.stringify({ error: "Internal Server Error", details: "Erro ao validar permissões." }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ) 
    };
  }

  if (!role) {
    return { 
      error: new Response(
        JSON.stringify({ error: "Forbidden", details: "Acesso negado. Requer nível administrativo." }), 
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ) 
    };
  }

  return { userId, role: "admin" };
}
