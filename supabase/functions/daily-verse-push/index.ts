import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback verses (used only if no manual queue + API fails)
const fallbackVerses = [
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
];

async function resolveTodayVerse(
  supabase: ReturnType<typeof createClient>
): Promise<{ text: string; ref: string; source: string }> {
  const today = new Date().toISOString().split("T")[0];

  // 1) Try manual queue (admin scheduled)
  try {
    const { data: queueVerse } = await supabase
      .from("daily_verse_queue")
      .select("verse_text, verse_ref")
      .eq("scheduled_date", today)
      .maybeSingle();
    if (queueVerse) {
      return { text: queueVerse.verse_text, ref: queueVerse.verse_ref, source: "manual" };
    }
  } catch (e) {
    console.error("Queue lookup failed:", e);
  }

  // 2) Match the app's deterministic fallback (same getDailyVerse logic: day-of-year mod length)
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const v = fallbackVerses[dayOfYear % fallbackVerses.length];
  return { ...v, source: "auto" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Manual trigger from admin requires admin role
    let isManualTrigger = false;
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && !authHeader.includes(serviceKey)) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Admin only" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        isManualTrigger = true;
      }
    }

    const verse = await resolveTodayVerse(supabase);

    const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        title: `📖 ${verse.ref}`,
        body: verse.text.substring(0, 120) + (verse.text.length > 120 ? "..." : ""),
        url: "/",
        type: "daily-verse",
        ttl: 60 * 60 * 24,
        urgency: "high",
      }),
    });

    const result = await response.json();

    // Log when manually triggered
    if (isManualTrigger) {
      await supabase.from("push_log").insert({
        title: `📖 ${verse.ref} (Versículo do dia)`,
        body: verse.text,
        total_sent: result?.sent || 0,
        total_failed: result?.failed || 0,
      });
    }

    return new Response(
      JSON.stringify({ verse: verse.ref, source: verse.source, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
