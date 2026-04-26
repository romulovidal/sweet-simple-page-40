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

// LISTA OFICIAL E DETERMINÍSTICA (IDÊNTICA AO APP)
const officialVerses = [
  { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", ref: "João 3:16" },
  { text: "O Senhor é o meu pastor; nada me faltará.", ref: "Salmos 23:1" },
  { text: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
  { text: "Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.", ref: "Provérbios 3:5" },
  { text: "Porque eu bem sei os pensamentos que penso de vós, diz o Senhor; pensamentos de paz e não de mal, para vos dar o fim que esperais.", ref: "Jeremias 29:11" },
  { text: "Mas os que esperam no Senhor renovarão as suas forças; subirão com asas como águias.", ref: "Isaías 40:31" },
  { text: "Lâmpada para os meus pés é a tua palavra e luz para o meu caminho.", ref: "Salmos 119:105" },
  { text: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.", ref: "Isaías 41:10" },
  { text: "E conhecereis a verdade, e a verdade vos libertará.", ref: "João 8:32" },
  { text: "Busquei o Senhor, e ele me respondeu; livrou-me de todos os meus temores.", ref: "Salmos 34:4" },
  { text: "E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus.", ref: "Romanos 8:28" },
  { text: "Esforçai-vos e animai-vos; não temais, nem vos espanteis, porque o Senhor, vosso Deus, é convosco.", ref: "Josué 1:9" },
  { text: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", ref: "Mateus 11:28" },
  { text: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", ref: "Salmos 46:1" },
  { text: "E não vos conformeis com este mundo, mas transformai-vos pela renovação do vosso entendimento.", ref: "Romanos 12:2" },
  { text: "Ora, a fé é o firme fundamento das coisas que se esperam e a prova das coisas que se não veem.", ref: "Hebreus 11:1" },
  { text: "O Senhor é a minha luz e a minha salvação; a quem temerei?", ref: "Salmos 27:1" },
  { text: "O nome do Senhor é uma torre forte; o justo corre para ela e está em segurança.", ref: "Provérbios 18:10" },
  { text: "Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.", ref: "1 Pedro 5:7" },
  { text: "Porque pela graça sois salvos, por meio da fé; e isto não vem de vós; é dom de Deus.", ref: "Efésios 2:8" },
  { text: "Mas o fruto do Espírito é: amor, gozo, paz, longanimidade, benignidade, bondade, fé, mansidão, temperança.", ref: "Gálatas 5:22" },
  { text: "Tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor e não aos homens.", ref: "Colossenses 3:23" },
  { text: "Se algum de vós tem falta de sabedoria, peça-a a Deus, que a todos dá liberalmente.", ref: "Tiago 1:5" },
  { text: "Assim que, se alguém está em Cristo, nova criatura é: as coisas velhas já passaram; eis que tudo se fez novo.", ref: "2 Coríntios 5:17" },
  { text: "Deleita-te também no Senhor, e ele te concederá os desejos do teu coração.", ref: "Salmos 37:4" },
  { text: "Aquele que habita no esconderijo do Altíssimo, à sombra do Onipotente descansará.", ref: "Salmos 91:1" },
  { text: "Mas buscai primeiro o Reino de Deus, e a sua justiça, e todas essas coisas vos serão acrescentadas.", ref: "Mateus 6:33" },
  { text: "Disse-lhe Jesus: Eu sou o caminho, e a verdade, e a vida. Ninguém vem ao Pai senão por mim.", ref: "João 14:6" },
  { text: "O amor é paciente, o amor é bondoso. Não inveja, não se vangloria, não se orgulha.", ref: "1 Coríntios 13:4" },
  { text: "Levantarei os meus olhos para os montes; de onde me vem o socorro? O meu socorro vem do Senhor, que fez o céu e a terra.", ref: "Salmos 121:1-2" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function parseRef(ref: string) {
  const m = ref.trim().match(/^(.+?)\s+(\d+):(\d+)/);
  if (!m) return null;
  return { bookName: m[1].trim(), chapter: parseInt(m[2], 10), verse: parseInt(m[3], 10) };
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
    const text = book.chapters[parsed.chapter - 1]?.[parsed.verse - 1];
    return text ? String(text).trim() : null;
  } catch { return null; }
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
       const { data: queueVerse } = await supabase.from("daily_verse_queue").select("verse_text, verse_ref").eq("scheduled_date", todayBR).maybeSingle();
       
       if (queueVerse) {
         baseVerse = { text: queueVerse.verse_text, ref: queueVerse.verse_ref };
       } else {
         const startOfYear = new Date(nowBR.getFullYear(), 0, 0);
         const diff = nowBR.getTime() - startOfYear.getTime();
         const dayOfYear = Math.floor(diff / 86400000);
         baseVerse = officialVerses[dayOfYear % officialVerses.length];
       }
 
       const versionedText = await getVerseTextInVersion(baseVerse.ref, versionId);
       const finalVerse = { ref: baseVerse.ref, text: versionedText || baseVerse.text };
 
       const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
         method: "POST",
         headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
         body: JSON.stringify({
           title: `📖 ${finalVerse.ref}`,
           body: finalVerse.text.substring(0, 120),
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
 
     // 2. Check Motivational Push
     if (motivationalEnabled && (isManual || (brTimeStr === motivationalTime && lastMotivationalDate !== todayBR))) {
       const motivationalMsgs = getSetting("motivational_messages");
       if (Array.isArray(motivationalMsgs) && motivationalMsgs.length > 0) {
         const randomMsg = motivationalMsgs[Math.floor(Math.random() * motivationalMsgs.length)];
         
         const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
           method: "POST",
           headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
           body: JSON.stringify({
             title: "Atalaia: Mensagem de ânimo",
             body: randomMsg,
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
