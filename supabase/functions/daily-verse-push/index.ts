import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_BASE_URL = "https://biblia.atalaias.online";
const VERSION_FILES: Record<string, string> = {
  ara: "ARA", arc: "ARC", acf: "ACF", nvi: "NVI", ntlh: "NTLH", kja: "KJA",
};
const DEFAULT_VERSION = "arc";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function parseVerseNumbers(versePart: string) {
  const numbers: number[] = [];

  for (const segment of versePart.split(",")) {
    const [startRaw, endRaw] = segment.split("-").map((value) => parseInt(value.trim(), 10));
    if (Number.isNaN(startRaw)) continue;

    if (Number.isNaN(endRaw)) {
      numbers.push(startRaw);
      continue;
    }

    const start = Math.min(startRaw, endRaw);
    const end = Math.max(startRaw, endRaw);
    for (let number = start; number <= end; number++) {
      numbers.push(number);
    }
  }

  return [...new Set(numbers)].sort((a, b) => a - b);
}

function parseRef(ref: string) {
  const m = ref.trim().match(/^(.+?)\s+(\d+):([\d,\-\s]+)/);
  if (!m) return null;
  return { bookName: m[1].trim(), chapter: parseInt(m[2], 10), verses: parseVerseNumbers(m[3]) };
}

async function getVerseTextInVersion(ref: string, versionId: string) {
  const parsed = parseRef(ref);
  if (!parsed) return null;
  try {
    const fileName = VERSION_FILES[versionId] || "ARC";
    const res = await fetch(`${APP_BASE_URL}/biblias/${fileName}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    const target = norm(parsed.bookName);
    const book = data.find((b: any) => norm(b.name) === target);
    if (!book) return null;
    const chapter = book.chapters[parsed.chapter - 1];
    if (!chapter || parsed.verses.length === 0) return null;

    const texts = parsed.verses
      .map((verseNumber) => {
        const text = chapter[verseNumber - 1];
        if (!text) return "";
        return parsed.verses.length === 1 ? String(text).trim() : `${verseNumber} ${String(text).trim()}`;
      })
      .filter(Boolean);

    return texts.length > 0 ? texts.join(" ") : null;
  } catch { return null; }
}

function limitNotificationBody(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 480 ? `${normalized.slice(0, 477).trimEnd()}...` : normalized;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: settings } = await supabase.from("admin_settings").select("key, value");
    const getSetting = (k: string) => settings?.find(s => s.key === k)?.value;
    
     const getVal = (k: string) => {
       const val = getSetting(k);
       if (val === undefined || val === null) return "";
       return typeof val === "string" ? val.replace(/"/g, "") : JSON.stringify(val).replace(/"/g, "");
     };
 
     const verseTime = getVal("daily_verse_push_time") || "08:00";
     const versionId = getVal("daily_verse_version") || DEFAULT_VERSION;
     const motivationalEnabled = getVal("motivational_push_enabled") === "true";
     const motivationalTime = getVal("motivational_push_time") || "10:00";
     const lastVerseDate = getVal("last_daily_verse_push_date") || "";
     const lastMotivationalDate = getVal("last_motivational_push_date") || "";
 
     const authHeader = req.headers.get("Authorization");
     const isManual = authHeader && (authHeader.includes(serviceKey) || authHeader.startsWith("Bearer "));
 
     const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
     const brTimeStr = new Intl.DateTimeFormat("pt-BR", {
       hour: "2-digit", minute: "2-digit", hour12: false,
     }).format(nowBR);
     const todayBR = nowBR.toISOString().split("T")[0];
 
     const results: any = { brTime: brTimeStr, date: todayBR };
 
     // 1. Check Daily Verse Push
     if (isManual || (brTimeStr === verseTime && lastVerseDate !== todayBR)) {
       let baseVerse: { text: string; ref: string } | null = null;
        const { data: queueVerse } = await supabase
          .from("daily_verse_queue")
          .select("verse_text, verse_ref")
          .lte("scheduled_date", todayBR)
          .order("scheduled_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
       
       if (queueVerse) {
         baseVerse = { text: queueVerse.verse_text, ref: queueVerse.verse_ref };
       } else {
          results.verse = { skipped: true, reason: "Nenhum versículo manual agendado" };
          if (!isManual) {
            await supabase.from("admin_settings").upsert({ key: "last_daily_verse_push_date", value: JSON.stringify(todayBR) });
          }
          baseVerse = null;
       }

        if (baseVerse) {
          const versionedText = await getVerseTextInVersion(baseVerse.ref, versionId);
          const finalVerse = { ref: baseVerse.ref, text: versionedText || baseVerse.text };

          const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
              title: `📖 ${finalVerse.ref}`,
              body: limitNotificationBody(finalVerse.text),
              url: "/",
              type: "daily-verse",
              ttl: 86400,
            }),
          });
          results.verse = await response.json();
          
          if (!isManual) {
            await supabase.from("admin_settings").upsert({ key: "last_daily_verse_push_date", value: JSON.stringify(todayBR) });
          }
        }
     }
 
     // 2. Check Motivational Push (AI Generated)
     if (motivationalEnabled && (isManual || (brTimeStr === motivationalTime && lastMotivationalDate !== todayBR))) {
       const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
       let aiMessage = "";
 
       if (LOVABLE_API_KEY) {
         try {
           const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
             method: "POST",
             headers: {
               Authorization: `Bearer ${LOVABLE_API_KEY}`,
               "Content-Type": "application/json",
             },
             body: JSON.stringify({
               model: "google/gemini-2.0-flash",
               messages: [
                 { 
                   role: "system", 
                   content: "Você é um mentor espiritual cristão encorajador. Gere uma frase curta e profunda (máximo 120 caracteres) para edificar o dia de uma pessoa. Use uma linguagem atual, acolhedora e inspiradora. Não use hashtags. Foque em esperança, fé, amor de Deus ou perseverança. Retorne APENAS a frase." 
                 }
               ],
               temperature: 0.8,
             }),
           });
 
           if (aiResponse.ok) {
             const aiData = await aiResponse.json();
             aiMessage = aiData.choices[0].message.content.trim().replace(/^"|"$/g, "");
           }
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
           title: "Não deixe de ler Hoje!",
           body: aiMessage,
           url: "/",
           type: "motivational",
           ttl: 43200,
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
