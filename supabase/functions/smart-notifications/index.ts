import { corsHeaders } from "../_shared/cors.ts";
import { validateAdminAuth } from "../_shared/auth-utils.ts";

/**
 * Smart Notifications — native PWA notifications only.
 * This function is intentionally independent from any retired WhatsApp automation stack.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = await validateAdminAuth(req, supabaseUrl, serviceKey);
    if (!auth.authorized) {
      console.error("[smart-notifications] Unauthorized access:", auth.error);
      return new Response(JSON.stringify({ error: "Unauthorized", details: auth.error }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[smart-notifications] Native processing authorized by:", auth.userId);

    // Native smart-notification rules can be implemented here without WhatsApp dependencies.
    return new Response(
      JSON.stringify({ ok: true, message: "Native Smart Notifications active", userId: auth.userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[smart-notifications] Error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
