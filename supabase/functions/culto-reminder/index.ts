import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateInviteMessage(params: {
  cultoName: string;
  timeStr: string;
  minutesBefore: number;
  reminderLabel: string;
}): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  const { cultoName, timeStr, minutesBefore, reminderLabel } = params;

  const timing =
    minutesBefore >= 12 * 60
      ? `é amanhã às ${timeStr}`
      : minutesBefore >= 60
      ? `começa em ${reminderLabel}, às ${timeStr}`
      : `começa em ${reminderLabel}!`;

  const system =
    "Você escreve convites curtos e acolhedores em português do Brasil para lembrar membros de uma igreja evangélica sobre o culto. Tom pastoral, caloroso, sem clichês repetidos. Sem hashtags. Use no máximo 1 emoji. Máximo 180 caracteres. Retorne APENAS o texto da notificação, sem aspas ou títulos.";
  const user = `Escreva uma mensagem única e original convidando a participar do culto "${cultoName}", que ${timing}. Varie a inspiração bíblica a cada geração. Não repita o nome do culto no início.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return text.replace(/^["'`]+|["'`]+$/g, "").slice(0, 240);
  } catch (e) {
    console.error("AI generation failed", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ===== MANUAL TRIGGER (admin button) =====
    // POST body: { schedule_id, reminder_id?, custom_message? }
    let body: { schedule_id?: string; reminder_id?: string; custom_message?: string } = {};
    try {
      if (req.method === "POST") body = await req.json();
    } catch {
      body = {};
    }

    if (body.schedule_id) {
      // Verify caller is admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await userClient.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: schedule, error: schedErr } = await supabase
        .from("culto_schedules")
        .select("*")
        .eq("id", body.schedule_id)
        .single();
      if (schedErr || !schedule) {
        return new Response(JSON.stringify({ error: "Schedule not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [h, m] = schedule.time.split(":").map(Number);
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      let pushBody = body.custom_message?.trim() || "";
      if (!pushBody) {
        const ai = await generateInviteMessage({
          cultoName: schedule.name,
          timeStr,
          minutesBefore: 60,
          reminderLabel: "instantes",
        });
        pushBody =
          ai || `Lembrete: o culto "${schedule.name}" será às ${timeStr}. Prepare seu coração! 🙏`;
      }

      const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          title: `⛪ ${schedule.name}`,
          body: pushBody,
          url: "/?tab=comunidade",
          type: "culto-reminder-manual",
          urgency: "high",
        }),
      });

      const pushResult = await pushResponse.json();
      console.log("Manual culto reminder sent:", pushResult);

      return new Response(
        JSON.stringify({ ok: true, manual: true, push: pushResult }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SCHEDULED CRON CHECK =====
    // Get current time in Brasilia timezone (UTC-3)
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const brasiliaTime = new Date(now.getTime() + (brasiliaOffset + now.getTimezoneOffset()) * 60000);
    const currentDay = brasiliaTime.getDay();
    const currentHour = brasiliaTime.getHours();
    const currentMinute = brasiliaTime.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const today = brasiliaTime.toISOString().split("T")[0];

    const { data: schedules, error } = await supabase
      .from("culto_schedules")
      .select("*")
      .eq("day_of_week", currentDay)
      .eq("is_active", true);

    if (error) throw error;
    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: "No cultos today", day: currentDay }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scheduleIds = schedules.map(s => s.id);
    const { data: allReminders, error: remError } = await supabase
      .from("culto_reminders")
      .select("*")
      .in("schedule_id", scheduleIds)
      .order("minutes_before", { ascending: false });

    if (remError) throw remError;

    let sent = 0;

    for (const schedule of schedules) {
      const [h, m] = schedule.time.split(":").map(Number);
      const cultoTotalMinutes = h * 60 + m;
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      const scheduleReminders = (allReminders || []).filter(r => r.schedule_id === schedule.id);

      const remindersToCheck = scheduleReminders.length > 0
        ? scheduleReminders
        : [{
            id: `legacy_${schedule.id}`,
            schedule_id: schedule.id,
            minutes_before: schedule.reminder_minutes_before || 180,
            message: "",
            last_sent: schedule.last_reminder_sent,
            sort_order: 0,
          }];

      for (const reminder of remindersToCheck) {
        const reminderTime = cultoTotalMinutes - reminder.minutes_before;

        // Widened window to 20 minutes to avoid missing due to cron jitter (cron runs every 15min)
        if (currentTotalMinutes >= reminderTime && currentTotalMinutes < reminderTime + 20) {
          if (reminder.last_sent) {
            const lastSent = reminder.last_sent.split("T")[0];
            if (lastSent === today) continue;
          }

          const reminderLabel = reminder.minutes_before >= 60
            ? `${Math.round(reminder.minutes_before / 60)}h`
            : `${reminder.minutes_before}min`;

          let pushBody = reminder.message && reminder.message.trim() ? reminder.message.trim() : "";
          if (!pushBody) {
            const ai = await generateInviteMessage({
              cultoName: schedule.name,
              timeStr,
              minutesBefore: reminder.minutes_before,
              reminderLabel,
            });
            pushBody =
              ai ||
              `Faltam ${reminderLabel} para o culto de hoje às ${timeStr}. Prepare seu coração! 🙏`;
          }

          const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              title: `⛪ ${schedule.name}`,
              body: pushBody,
              url: "/?tab=comunidade",
              type: "culto-reminder",
              ttl: reminder.minutes_before * 60,
              urgency: "high",
            }),
          });

          const pushResult = await pushResponse.json();

          if (reminder.id.startsWith("legacy_")) {
            await supabase
              .from("culto_schedules")
              .update({ last_reminder_sent: new Date().toISOString() })
              .eq("id", schedule.id);
          } else {
            await supabase
              .from("culto_reminders")
              .update({ last_sent: new Date().toISOString() })
              .eq("id", reminder.id);
          }

          sent++;
          console.log(`Sent reminder "${reminder.id}" for "${schedule.name}" (${reminderLabel} before):`, pushResult);
        }
      }
    }

    return new Response(
      JSON.stringify({ day: currentDay, checked: schedules.length, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Culto reminder error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
