import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiGenerateText, hasAnyAiKey } from "../_shared/ai-fetch.ts";
import { decodeJwtPayload, getProjectRef, validateAdminAuth } from "../_shared/auth-utils.ts";

import { corsHeaders } from "../_shared/cors.ts";

function limitNotificationBody(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 480 ? `${normalized.slice(0, 477).trimEnd()}...` : normalized;
}

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

function getBrazilTimeKey(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getBrazilPeriod(date = new Date()): { period: "manhã" | "tarde" | "noite" | "madrugada"; hour: number } {
  const hourStr = new Intl.DateTimeFormat("pt-BR", { timeZone: BRAZIL_TZ, hour: "2-digit", hour12: false }).format(date);
  const hour = parseInt(hourStr, 10);
  let period: "manhã" | "tarde" | "noite" | "madrugada";
  if (hour >= 5 && hour < 12) period = "manhã";
  else if (hour >= 12 && hour < 18) period = "tarde";
  else if (hour >= 18 && hour < 24) period = "noite";
  else period = "madrugada";
  return { period, hour };
}

// Re-import removed due to duplicate in previous line range

async function isAuthorizedTrigger(
  req: Request,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ ok: boolean; manual: boolean }> {
  const auth = await validateAdminAuth(req, supabaseUrl, serviceKey);
  
  if (auth.authorized) {
    const isManual = auth.userId !== "service-role";
    console.log(`Authorized as ${auth.userId} (manual: ${isManual})`);
    return { ok: true, manual: isManual };
  }
  
  return { ok: false, manual: false };
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: settings } = await supabase.from("admin_settings").select("key, value");
    const getSetting = (k: string) => settings?.find(s => s.key === k)?.value;
    
     const getVal = (k: string) => {
       const val = getSetting(k);
       if (val === undefined || val === null) return "";
       return typeof val === "string" ? val.replace(/"/g, "") : JSON.stringify(val).replace(/"/g, "");
     };
 
     const verseTime = getVal("daily_verse_push_time") || "08:00";
     const motivationalEnabled = getVal("motivational_push_enabled") === "true";
     const motivationalTime = getVal("motivational_push_time") || "10:00";
     const lastVerseDate = getVal("last_daily_verse_push_date") || "";
     const lastMotivationalDate = getVal("last_motivational_push_date") || "";
 
     // Manual triggers must come from an admin user or the internal service role.
     // Otherwise, the endpoint only runs on its scheduled time window.
     const auth = await isAuthorizedTrigger(req, supabaseUrl, serviceKey);
     const authHeader = req.headers.get("Authorization");
     const hasAuthHeader = !!authHeader && authHeader.length > 0;
     
     if (hasAuthHeader && !auth.ok) {
       console.error("[daily-verse-push] Unauthorized manual trigger attempt:", auth);
       return new Response(JSON.stringify({ error: "Unauthorized", details: "User is not authorized or not an admin" }), {
         status: 401,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
     const isManual = auth.manual;
 
      // Optional filter to send only one of the two pushes (manual triggers).
      // Accepts { only: 'verse' | 'motivational' } in body or ?only= query param.
      let onlyType: "verse" | "motivational" | null = null;
      try {
        const url = new URL(req.url);
        const q = url.searchParams.get("only");
        if (q === "verse" || q === "motivational") onlyType = q;
        if (!onlyType && req.method === "POST") {
          const body = await req.clone().json().catch(() => null) as any;
          const b = body?.only;
          if (b === "verse" || b === "motivational") onlyType = b;
        }
      } catch { /* ignore */ }

      const brTimeStr = getBrazilTimeKey();
      const todayBR = getBrazilDateKey();
 
     const results: any = { brTime: brTimeStr, date: todayBR };

     // ATIS groups logic removed. Native push only.
     const dueGroupTypes = new Set<string>();

 
      // 1. Check Daily Verse Push
      const runVerse = onlyType ? onlyType === "verse" : (isManual || (brTimeStr === verseTime && lastVerseDate !== todayBR) || dueGroupTypes.has("verse"));
      
      console.log("[daily-verse-push] Verse check:", { 
        runVerse, brTimeStr, verseTime, lastVerseDate, todayBR, isManual 
      });

      if (runVerse) {
        let baseVerse: { text: string; ref: string } | null = null;
        const { data: queueVerse, error: qErr } = await supabase
          .from("daily_verse_queue")
          .select("verse_text, verse_ref")
          .eq("scheduled_date", todayBR)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (qErr) console.error("[daily-verse-push] Queue error:", qErr);

        if (queueVerse) {
          console.log("[daily-verse-push] Found verse in queue:", queueVerse.verse_ref);
          baseVerse = { text: queueVerse.verse_text, ref: queueVerse.verse_ref };
        } else {
          console.log("[daily-verse-push] No verse found for date:", todayBR);
          results.verse = { skipped: true, reason: "Nenhum versículo manual agendado" };
          if (!isManual) {
            await supabase.from("admin_settings").upsert({ key: "last_daily_verse_push_date", value: JSON.stringify(todayBR) });
          }
          baseVerse = null;
        }

        if (baseVerse) {
          console.log("[daily-verse-push] Triggering send-push for verse...");
          const finalVerse = { ref: baseVerse.ref, text: baseVerse.text };

          const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
              title: `📖 ${finalVerse.ref}`,
              // PWA keeps its compact preview; ATIS receives the complete passage.
              body: limitNotificationBody(finalVerse.text),
              atis_body: finalVerse.text,
              url: "/",
              type: "daily-verse",
              ttl: 86400,
              groupsOnly: !isManual && brTimeStr !== verseTime,
            }),
          });
          
          const pushResp = await response.json();
          console.log("[daily-verse-push] send-push response:", pushResp);
          results.verse = pushResp;
          
          if (!isManual) {
            await supabase.from("admin_settings").upsert({ key: "last_daily_verse_push_date", value: JSON.stringify(todayBR) });
          }
        }
      }
 
     // 2. Check Motivational Push (AI Generated)
      const runMotivational = onlyType
        ? onlyType === "motivational"
         : (motivationalEnabled && (isManual || (brTimeStr === motivationalTime && lastMotivationalDate !== todayBR) || dueGroupTypes.has("motivational")));
      if (runMotivational) {
       let aiMessage = "";
        const { period, hour } = getBrazilPeriod();
        const dayName = new Intl.DateTimeFormat("pt-BR", { timeZone: BRAZIL_TZ, weekday: "long" }).format(new Date());
        const titleByPeriod: Record<string, string> = {
          "manhã": "☀️ Bom dia! Não deixe de ler hoje",
          "tarde": "🌤️ Boa tarde! Uma pausa na Palavra",
          "noite": "🌙 Boa noite! Encerre o dia com Deus",
          "madrugada": "✨ Um momento com Deus agora",
        };
        const pushTitle = titleByPeriod[period];
 
        if (hasAnyAiKey()) {
         try {
            const systemPrompt =
              "Você é um mentor espiritual cristão, acolhedor e criativo. Gere UMA frase curta (máx. 130 caracteres), original e inspiradora, para lembrar a pessoa de ler a Bíblia agora. Nunca repita fórmulas prontas. Use linguagem natural e adapte o tom ao período do dia. Sem hashtags, sem aspas, sem emojis no início. Retorne APENAS a frase.";
            const userPrompt =
              `Contexto: hoje é ${dayName}, período do dia = ${period} (hora local ${hour}h em Fortaleza-CE). ` +
              (period === "manhã"
                ? "Convide a pessoa a começar o dia na Palavra."
                : period === "tarde"
                ? "Convide a pessoa a fazer uma pausa e voltar à Palavra."
                : period === "noite"
                ? "Convide a pessoa a encerrar o dia meditando na Palavra antes de dormir."
                : "Convide a pessoa a se aquietar com Deus neste momento silencioso.") +
              " Gere agora a frase (diferente das anteriores).";
            aiMessage = await aiGenerateText({
              system: systemPrompt,
              user: userPrompt,
              temperature: 1.0,
              maxTokens: 2048,
            });
         } catch (e) {
            console.error("AI generation failed:", e);
         }
       }
 
       // Fallback to static list if AI fails or key is missing
       if (!aiMessage) {
         const motivationalMsgs = getSetting("motivational_messages");
         if (Array.isArray(motivationalMsgs) && motivationalMsgs.length > 0) {
           aiMessage = motivationalMsgs[Math.floor(Math.random() * motivationalMsgs.length)];
         } else {
           aiMessage = "Deus tem um propósito especial para o seu dia. Confie nEle! 🙏";
         }
       }
 
       const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
         method: "POST",
         headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
         body: JSON.stringify({
            title: pushTitle,
           body: aiMessage,
           url: "/",
           type: "motivational",
            ttl: 43200,
            groupsOnly: !isManual && brTimeStr !== motivationalTime,
         }),
       });
       results.motivational = await response.json();
 
       if (!isManual) {
         await supabase.from("admin_settings").upsert({ key: "last_motivational_push_date", value: JSON.stringify(todayBR) });
       }
     }
 
     if (!results.verse && !results.motivational) {
       return new Response(JSON.stringify({ skipped: true, ...results }), { headers: corsHeaders });
     }
 
     return new Response(JSON.stringify({ success: true, ...results }), { 
       headers: { ...corsHeaders, "Content-Type": "application/json" } 
     });
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : "Internal error";
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
