import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL_PROMPTS: Record<string, string> = {
  summary:
    "Você é um teólogo acadêmico. Receba o texto bíblico e gere um RESUMO CONCISO (3-4 frases) do capítulo, destacando:\n" +
    "1) Tema principal\n2) Contexto narrativo/teológico\n3) Mensagem central\n" +
    "Seja direto e acessível. Use markdown. Responda em português brasileiro.",
  devotional:
    "Você é um pastor e escritor devocional. A partir do versículo bíblico fornecido, escreva uma REFLEXÃO DEVOCIONAL curta (2 parágrafos) que:\n" +
    "1) Conecte o texto ao cotidiano do leitor\n2) Traga uma aplicação prática e encorajadora\n" +
    "Seja caloroso e inspirador. Use markdown. Responda em português brasileiro.",
  connections:
    "Você é um estudioso bíblico especialista em intertextualidade. A partir do texto bíblico fornecido:\n" +
    "1) Liste 4-6 referências cruzadas relevantes com a citação exata\n" +
    "2) Para cada uma, explique em 1-2 frases a conexão temática\n" +
    "3) Agrupe por tipo: paralelo direto, profecia/cumprimento, tema recorrente\n" +
    "Use markdown com headers. Responda em português brasileiro.",
  "word-meaning":
    "Você é um linguista bíblico especialista em hebraico e grego. A partir do texto bíblico fornecido:\n" +
    "1) Identifique 3-5 palavras-chave teologicamente significativas\n" +
    "2) Para cada uma: dê a palavra original (hebraico/grego), transliteração, significado literal e uso no contexto\n" +
    "3) Explique nuances que se perdem na tradução\n" +
    "Formate como mini-dicionário com markdown. Responda em português brasileiro.",
  timeline:
    "Você é um historiador bíblico. A partir do texto bíblico fornecido:\n" +
    "1) Situe o texto no período histórico (data aproximada, império dominante, contexto social)\n" +
    "2) Liste 4-6 eventos históricos relevantes em ordem cronológica\n" +
    "3) Para cada evento: data, o que aconteceu, e como se relaciona ao texto\n" +
    "Formate como linha do tempo visual com markdown (use emojis de época). Responda em português brasileiro.",
  "plan-generator":
    "Você é um teólogo pastoral especialista em planos de leitura bíblica. O administrador vai descrever um tema ou assunto.\n" +
    "Gere um plano de leitura bíblica completo com:\n" +
    "1) Título atrativo\n2) Descrição do plano (2-3 frases)\n3) Lista de leituras diárias (7-21 dias)\n" +
    "Para cada dia: título do dia, livro (abreviação), capítulo, versículo início e fim.\n\n" +
    "IMPORTANTE: Retorne APENAS um JSON válido no formato:\n" +
    '{"title":"...","description":"...","category":"Temático","emoji":"📖","readings":[{"day":1,"title":"...","book_abbrev":"gn","chapter":1,"verse_start":1,"verse_end":31}]}\n\n' +
    "Abreviações válidas: gn,ex,lv,nm,dt,js,jz,rt,1sm,2sm,1rs,2rs,1cr,2cr,ed,ne,et,jó,sl,pv,ec,ct,is,jr,lm,ez,dn,os,jl,am,ob,jn,mq,na,hc,sf,ag,zc,ml,mt,mc,lc,jo,at,rm,1co,2co,gl,ef,fp,cl,1ts,2ts,1tm,2tm,tt,fm,hb,tg,1pe,2pe,1jo,2jo,3jo,jd,ap",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tool, reference, text } = await req.json();

    if (!tool || !TOOL_PROMPTS[tool]) {
      return new Response(JSON.stringify({ error: "Invalid tool" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Check if feature is enabled
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: setting } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "ai_features")
      .single();

    const features = (setting?.value as Record<string, boolean>) || {};
    const featureKey = tool.replace("-", "_");
    if (features[featureKey] === false) {
      return new Response(JSON.stringify({ error: "Este recurso de IA está desativado pelo administrador." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = TOOL_PROMPTS[tool];
    const isJsonTool = tool === "plan-generator";

    const userContent = reference
      ? `**${reference}**\n\n"${text}"`
      : text;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: !isJsonTool,
        ...(isJsonTool ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isJsonTool) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      return new Response(JSON.stringify({ result: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
