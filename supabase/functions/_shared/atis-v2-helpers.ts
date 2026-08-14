import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export function brNow(tz = "America/Fortaleza") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dateKey = `${g("year")}-${g("month")}-${g("day")}`;
  const timeKey = `${g("hour")}:${g("minute")}`;
  const hour = parseInt(g("hour"), 10);
  const weekday = new Date().getDay(); // 0 = domingo, 6 = sábado
  
  return { dateKey, timeKey, hour, weekday };
}
