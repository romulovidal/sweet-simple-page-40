import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    auth: {
      persistSession: false,
    },
  }
);

export function brNow(tz = "America/Fortaleza") {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dateKey = `${g("year")}-${g("month")}-${g("day")}`;
  const timeKey = `${g("hour")}:${g("minute")}`;
  const hour = parseInt(g("hour"), 10);
  const mmdd = `${g("month")}-${g("day")}`;
  
  // weekday determinístico para a timezone
  const fortDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const weekday = fortDate.getDay(); // 0 = domingo, 6 = sábado
  
  const period = hour >= 5 && hour < 12 ? 'manhã' : hour >= 12 && hour < 18 ? 'tarde' : hour >= 18 ? 'noite' : 'madrugada';

  return { dateKey, timeKey, hour, weekday, mmdd, period };
}

