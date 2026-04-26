import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { reference, text, mode } = body;
    
    if (!reference || !text) {
      return new Response(JSON.stringify({ error: "reference and text are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const UNSPLASH_ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY");

    const MODEL = "google/gemini-2.5-flash";

    if (mode === "image_prompt") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { 
              role: "system", 
              content: "You are a creative assistant. Create 2-3 English keywords for a high-quality Unsplash image search that matches the spiritual essence of the given Bible verse. Return ONLY the keywords separated by commas, no other text." 
            },
            {
              role: "user",
              content: `Verse: ${reference} - "${text}"`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      const prompt = data.choices[0].message.content.trim();
      
      let imageUrl = "";
      
      // Se houver uma chave do Unsplash, usamos a API oficial que é 100% garantida
      if (UNSPLASH_ACCESS_KEY) {
        const unsplashResp = await fetch(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(prompt + ",spiritual")}&orientation=squarish&client_id=${UNSPLASH_ACCESS_KEY}`);
        if (unsplashResp.ok) {
          const unsplashData = await unsplashResp.json();
          imageUrl = unsplashData.urls.regular;
        }
      }
      
      // Fallback para URL direta se não houver chave ou se a API falhar
      if (!imageUrl) {
        imageUrl = `https://images.unsplash.com/featured/1080x1080/?${encodeURIComponent(prompt + ",spiritual")}&sig=${Math.random()}`;
      }

      return new Response(JSON.stringify({ prompt, imageUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: Exegesis mode
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let systemPrompt =
      "Você é um exegeta bíblico acadêmico. Ao receber um texto bíblico, faça uma exegese completa incluindo:\n" +
      "1) **Contexto histórico e cultural** da época em que o texto foi escrito\n" +
      "2) **Análise das palavras-chave** no idioma original (hebraico/grego), com transliteração\n" +
      "3) **Gênero literário** e estrutura do texto\n" +
      "4) **Significado teológico** e aplicação prática\n" +
      "5) **Referências cruzadas** relevantes\n\n" +
      "Seja profundo mas acessível. Use markdown para formatar. Responda sempre em português brasileiro.";

    const { data: setting } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "exegetai_prompt")
      .single();

    if (setting?.value && typeof setting.value === "object" && "prompt" in setting.value) {
      const customPrompt = (setting.value as { prompt: string }).prompt;
      if (customPrompt.trim()) systemPrompt = customPrompt;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Faça a exegese do seguinte texto bíblico:\n\n**${reference}**\n\n"${text}"`,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      return new Response(JSON.stringify({ error: "Erro ao gerar exegese" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("exegetai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
