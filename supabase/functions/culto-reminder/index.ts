import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      const { data: isAdmin } = await supabase.rpc("has_role", {
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

      const pushBody = body.custom_message?.trim()
        ? body.custom_message.trim()
        : `Lembrete: o culto "${schedule.name}" será às ${timeStr}. Prepare seu coração! 🙏`;

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

          const pushBody = reminder.message && reminder.message.trim()
            ? reminder.message.trim()
            : `Faltam ${reminderLabel} para o culto de hoje às ${timeStr}. Prepare seu coração! 🙏`;

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
