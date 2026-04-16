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

    // Get current time in Brasilia timezone (UTC-3)
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const brasiliaTime = new Date(now.getTime() + (brasiliaOffset + now.getTimezoneOffset()) * 60000);
    const currentDay = brasiliaTime.getDay(); // 0=Sunday
    const currentHour = brasiliaTime.getHours();
    const currentMinute = brasiliaTime.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    // Get all active schedules for today
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

    let sent = 0;
    const today = brasiliaTime.toISOString().split("T")[0];

    for (const schedule of schedules) {
      // Parse schedule time (HH:MM:SS)
      const [h, m] = schedule.time.split(":").map(Number);
      const cultoTotalMinutes = h * 60 + m;
      const reminderTime = cultoTotalMinutes - schedule.reminder_minutes_before;

      // Check if it's time to send the reminder (within a 15-minute window)
      if (currentTotalMinutes >= reminderTime && currentTotalMinutes < reminderTime + 15) {
        // Check if already sent today
        if (schedule.last_reminder_sent) {
          const lastSent = schedule.last_reminder_sent.split("T")[0];
          if (lastSent === today) continue;
        }

        // Format time for display
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const reminderLabel = schedule.reminder_minutes_before >= 60
          ? `${Math.round(schedule.reminder_minutes_before / 60)}h`
          : `${schedule.reminder_minutes_before}min`;

        // Send push notification
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            title: `⛪ ${schedule.name}`,
            body: `Faltam ${reminderLabel} para o culto de hoje às ${timeStr}. Prepare seu coração! 🙏`,
            url: "/",
            type: "culto-reminder",
            ttl: schedule.reminder_minutes_before * 60,
            urgency: "high",
          }),
        });

        const pushResult = await pushResponse.json();

        // Mark as sent
        await supabase
          .from("culto_schedules")
          .update({ last_reminder_sent: new Date().toISOString() })
          .eq("id", schedule.id);

        sent++;
        console.log(`Sent reminder for "${schedule.name}":`, pushResult);
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
