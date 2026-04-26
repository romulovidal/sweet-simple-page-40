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
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split("T")[0];

    // 1. Inactivity reminder
    const { data: inactiveUsers } = await supabase
      .from("user_streaks")
      .select("user_id")
      .eq("last_read_date", threeDaysAgoStr);

    if (inactiveUsers?.length) {
      for (const u of inactiveUsers) {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            user_id: u.user_id,
            title: "🙏 Sentimos sua falta",
            body: "Que tal ler o versículo do dia hoje e renovar suas forças?",
            url: "/",
          }),
        });
      }
    }

    // 2. Goal progress reminder
    const { data: goalUsers } = await supabase
      .from("reading_goals")
      .select("user_id, completed_chapters, target_chapters")
      .filter("updated_at", "lt", today);

    if (goalUsers?.length) {
      for (const g of goalUsers) {
        const completed = Array.isArray(g.completed_chapters) ? g.completed_chapters.length : 0;
        if (completed > 0 && completed < (g.target_chapters || 1189)) {
          await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
              user_id: g.user_id,
              title: "📖 Meta de leitura",
              body: `Você já leu ${completed} capítulos. Continue firme em seu propósito!`,
              url: "/perfil",
            }),
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});