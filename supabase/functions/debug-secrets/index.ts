import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const results = {
      VAPID_PUBLIC_KEY: !!Deno.env.get("VAPID_PUBLIC_KEY"),
      VAPID_PRIVATE_KEY: !!Deno.env.get("VAPID_PRIVATE_KEY"),
      VAPID_SUBJECT: !!Deno.env.get("VAPID_SUBJECT"),
      EVOLUTION_API_URL: !!Deno.env.get("EVOLUTION_API_URL"),
      EVOLUTION_API_KEY: !!Deno.env.get("EVOLUTION_API_KEY"),
      XAI_API_KEY: !!Deno.env.get("XAI_API_KEY"),
      GEMINI_API_KEY: !!Deno.env.get("GEMINI_API_KEY"),
      GROQ_API_KEY: !!Deno.env.get("GROQ_API_KEY"),
    };

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
