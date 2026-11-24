import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIdentifier,
  getRequestUserId,
  createAdminClient,
} from "../_shared/rate-limit.ts";
import { aiChatFetchWithProviders } from "../_shared/ai-fetch.ts";

// Gemini é a IA principal (modelo mais novo, com fallback para Groq/xAI quando
// o limite diário do Gemini acabar, para nunca ficar sem resposta).
const GEMINI_FIRST: ("groq" | "xai" | "gemini")[] = ["gemini", "groq", "xai"];

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

    // Rate limit: 15 requests / 60s per user (or IP)
    const userId = await getRequestUserId(req);
    const identifier = getClientIdentifier(req, userId);
    const admin = createAdminClient();
    const rl = await checkRateLimit(admin, identifier, `exegetai:${mode ?? "exegesis"}`, 15, 60);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!XAI_API_KEY && !GROQ_API_KEY && !GEMINI_API_KEY) {
      throw new Error("Nenhuma chave de IA configurada");
    }

    const MODEL = "google/gemini-3.6-flash";

    if (mode === "image_prompt") {
      const response = await aiChatFetchWithProviders(
        {
          model: MODEL,
          messages: [
            {
              role: "system",
              content: "You are a creative assistant. Create ONE English keyword that best represents the spiritual setting of the given verse. Return ONLY the word, no other text.",
            },
            { role: "user", content: `Verse: ${reference} - "${text}"` },
          ],
        },
        GEMINI_FIRST
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      const keyword = data.choices[0].message.content.trim().toLowerCase().replace(/[^a-z]/g, "");
      
      // Use a fixed high-quality Unsplash image as fallback but with keyword-based search
      // To ensure it works, we'll use the most reliable Unsplash URL pattern
      const imageUrl = `https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80&sig=${Math.random()}`;
      
      // Actually, let's use a list of high-quality verified spiritual image IDs from Unsplash
      const spiritualImages = [
        "https://images.unsplash.com/photo-1438232992991-995b7058bbb3", // Light/Prayer
        "https://images.unsplash.com/photo-1490730141103-6cac27aaab94", // Sunset/Nature
        "https://images.unsplash.com/photo-1501183638710-841dd1904471", // Nature
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05", // Landscape
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e", // Forest/Light
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e", // Mountains
        "https://images.unsplash.com/photo-1501854140801-50d01698950b"  // Nature
      ];
      
      const randomImage = spiritualImages[Math.floor(Math.random() * spiritualImages.length)];
      const finalUrl = `${randomImage}?auto=format&fit=crop&w=1200&q=80&sig=${Math.random()}`;

      return new Response(JSON.stringify({ prompt: keyword, imageUrl: finalUrl }), {
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
      "Regras de exatidão (siga sempre):\n" +
      "- Afirme autoria, data e contexto histórico somente quando o próprio texto (ex.: o cabeçalho do salmo, como \"dos filhos de Corá\") ou o consenso acadêmico os sustentarem; quando houver dúvida, diga que não é certo em vez de afirmar.\n" +
      "- Não atribua um salmo a Davi por tradição: confira o cabeçalho do salmo no texto recebido antes de falar de autoria.\n" +
      "- Cite referências cruzadas somente de passagens realmente relacionadas ao texto; nunca invente referências.\n\n" +
      "Seja profundo mas acessível. Use markdown para formatar, preferindo listas a tabelas, com títulos (##) por seção, negrito nos termos-chave e parágrafos curtos; separe as seções com ---; feche com um parágrafo curto de aplicação intitulado 'Para levar com você'. Você pode usar HTML inline para destacar trechos: <span style="color:#fbbf24">termo-chave</span> em dourado para os pontos mais importantes e <mark>para o versículo ou frase central</mark>. Use com moderação, só nos destaques. Responda sempre em português brasileiro.";

    const { data: setting } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "exegetai_prompt")
      .single();

    if (setting?.value && typeof setting.value === "object" && "prompt" in setting.value) {
      const customPrompt = (setting.value as { prompt: string }).prompt;
      if (customPrompt.trim()) systemPrompt = customPrompt;
    }

    const response = await aiChatFetchWithProviders(
      {
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Faça a exegese do seguinte texto bíblico:\n\n**${reference}**\n\n"${text}"`,
          },
        ],
        stream: true,
      },
      GEMINI_FIRST
    );

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
