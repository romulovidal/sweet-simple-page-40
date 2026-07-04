import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRAZIL_TZ = "America/Fortaleza";

function getBrazilDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRAZIL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days, 12))
    .toISOString()
    .slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Require admin or internal service-role invocation.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    let authorized = token && token === serviceKey;
    if (!authorized && token) {
      try {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData } = await userClient.auth.getUser();
        if (userData?.user) {
          const { data: isAdmin } = await userClient.rpc("has_role", {
            _user_id: userData.user.id,
            _role: "admin",
          });
          authorized = isAdmin === true;
        }
      } catch {
        authorized = false;
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const today = getBrazilDateKey();
    const threeDaysAgoStr = addDaysToDateKey(today, -3);

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
   } catch (e: any) {
     const err = e as Error;
     return new Response(JSON.stringify({ error: err.message }), { status: 500 });
   }
});