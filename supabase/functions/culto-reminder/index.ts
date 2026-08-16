import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiChatFetch } from "../_shared/ai-fetch.ts";
import { decodeJwtPayload, getProjectRef, validateAdminAuth } from "../_shared/auth-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEEKDAY_NAMES = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

function describeWhen(daysUntil: number, minutesUntil: number, timeStr: string, cultoDay: number) {
  if (daysUntil === 0) {
    if (minutesUntil <= 0) return `está começando agora, às ${timeStr}`;
    if (minutesUntil < 60) return `começa em ${minutesUntil} minutos, às ${timeStr}`;
    const h = Math.round(minutesUntil / 60);
    return `é hoje às ${timeStr} (em cerca de ${h}h)`;
  }
  if (daysUntil === 1) return `é amanhã às ${timeStr}`;
  if (daysUntil === 2) return `é depois de amanhã às ${timeStr}`;
  return `é ${WEEKDAY_NAMES[cultoDay]} às ${timeStr} (em ${daysUntil} dias)`;
}

async function generateInviteMessage(params: {
  cultoName: string;
  timeStr: string;
  daysUntil: number;
  minutesUntil: number;
  cultoDay: number;
}): Promise<string | null> {
  if (!Deno.env.get("XAI_API_KEY") && !Deno.env.get("GEMINI_API_KEY") && !Deno.env.get("GROQ_API_KEY")) return null;
  const { cultoName, timeStr, daysUntil, minutesUntil, cultoDay } = params;

  const timing = describeWhen(daysUntil, minutesUntil, timeStr, cultoDay);

  const system =
    "Você escreve convites curtos e acolhedores em português do Brasil para lembrar membros de uma igreja evangélica sobre o culto. Tom pastoral, caloroso, sem clichês repetidos. Sem hashtags. Use no máximo 1 emoji. Máximo 180 caracteres. Retorne APENAS o texto da notificação, sem aspas ou títulos. Sempre respeite exatamente o momento indicado (hoje / amanhã / depois de amanhã / dia da semana).";
  const user = `Escreva uma mensagem única e original convidando a participar do culto "${cultoName}", que ${timing}. Varie a inspiração bíblica a cada geração. Não repita o nome do culto no início. Deixe claro quando é (hoje, amanhã, depois de amanhã, ou o dia da semana).`;

  try {
    const res = await aiChatFetch({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
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

    if (body.schedule_id || req.headers.get("Authorization")) {
      // Verify caller is admin or service_role
      const auth = await validateAdminAuth(req, supabaseUrl, serviceKey);

      if (!auth.authorized) {
        console.error("[culto-reminder] Unauthorized manual trigger attempt:", auth.error);
        return new Response(JSON.stringify({ error: "Unauthorized", details: auth.error }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isAdmin = auth.isAdmin;
      const authorized = auth.authorized;


      // If it's a manual trigger without schedule_id in body, we might be here just for auth check before cron logic
      // But based on the code structure, the cron logic follows below.
      // If schedule_id is present, it's a manual trigger.
      if (body.schedule_id) {

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

      // Determine day offset until the next occurrence of this schedule
      const nowB = brasiliaNow();
      const currentDayM = nowB.getDay();
      const currentMinM = nowB.getHours() * 60 + nowB.getMinutes();
      const cultoTotalM = h * 60 + m;
      let daysUntilM = (schedule.day_of_week - currentDayM + 7) % 7;
      if (daysUntilM === 0 && cultoTotalM + 20 < currentMinM) daysUntilM = 7;
      const minutesUntilM = daysUntilM * 1440 + (cultoTotalM - currentMinM);

      let pushBody = body.custom_message?.trim() || "";
      if (!pushBody) {
        const ai = await generateInviteMessage({
          cultoName: schedule.name,
          timeStr,
          daysUntil: daysUntilM,
          minutesUntil: minutesUntilM,
          cultoDay: schedule.day_of_week,
        });
        const whenTxt = describeWhen(daysUntilM, minutesUntilM, timeStr, schedule.day_of_week);
        pushBody =
          ai || `Lembrete: o culto "${schedule.name}" ${whenTxt}. Prepare seu coração! 🙏`;
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
  }

    // ===== SCHEDULED CRON CHECK =====
    // Look at ALL active schedules — cross-day reminders (e.g. "night before") must fire too.
    const brasiliaTime = brasiliaNow();
    const currentDay = brasiliaTime.getDay();
    const currentTotalMinutes = brasiliaTime.getHours() * 60 + brasiliaTime.getMinutes();
    const today = brasiliaDateStr(brasiliaTime);

    const { data: schedules, error } = await supabase
      .from("culto_schedules")
      .select("*")
      .eq("is_active", true);

    if (error) throw error;
    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: "No active schedules", day: currentDay }), {
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

      // Minutes from now until the next occurrence of this culto
      let daysUntilCulto = (schedule.day_of_week - currentDay + 7) % 7;
      if (daysUntilCulto === 0 && cultoTotalMinutes + 20 < currentTotalMinutes) {
        daysUntilCulto = 7;
      }
      const minutesUntilCulto = daysUntilCulto * 1440 + (cultoTotalMinutes - currentTotalMinutes);

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
            scheduled_at: null,
          }];

      for (const reminder of remindersToCheck) {
        // NEW: if reminder has an explicit scheduled_at, fire based on that.
        // Otherwise fall back to the legacy "minutes_before" logic.
        const nowMs = Date.now();
        if (reminder.scheduled_at) {
          const trigger = new Date(reminder.scheduled_at).getTime();
          const delta = nowMs - trigger; // >=0 means we've passed the trigger
          if (delta < 0 || delta >= 20 * 60 * 1000) continue;
          if (reminder.last_sent && new Date(reminder.last_sent).getTime() >= trigger) continue;
        } else {
          if (reminder.minutes_before == null) continue;
          const diff = reminder.minutes_before - minutesUntilCulto;
          if (diff < 0 || diff >= 20) continue;
          if (reminder.last_sent) {
            const lastSent = reminder.last_sent.split("T")[0];
            if (lastSent === today) continue;
          }
        }

        // Actual day/time of THIS reminder occurrence
        const daysUntilThis = daysUntilCulto;
        const whenTxt = describeWhen(daysUntilThis, minutesUntilCulto, timeStr, schedule.day_of_week);
        const reminderLabel = reminder.scheduled_at
          ? "agendado"
          : (reminder.minutes_before ?? 0) >= 60
          ? `${Math.round((reminder.minutes_before ?? 0) / 60)}h`
          : `${reminder.minutes_before ?? 0}min`;

        let pushBody = reminder.message && reminder.message.trim() ? reminder.message.trim() : "";
        if (!pushBody) {
          const ai = await generateInviteMessage({
            cultoName: schedule.name,
            timeStr,
            daysUntil: daysUntilThis,
            minutesUntil: minutesUntilCulto,
            cultoDay: schedule.day_of_week,
          });
          pushBody =
            ai || `Lembrete: o culto "${schedule.name}" ${whenTxt}. Prepare seu coração! 🙏`;
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
              ttl: Math.max(60, (reminder.minutes_before ?? 60) * 60),
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

function brasiliaNow(): Date {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  return new Date(now.getTime() + (brasiliaOffset + now.getTimezoneOffset()) * 60000);
}

function brasiliaDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
