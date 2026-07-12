import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIdentifier,
  getRequestUserId,
  createAdminClient,
} from "../_shared/rate-limit.ts";
import { aiChatFetch } from "../_shared/ai-fetch.ts";

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
  "semantic-search":
    "Você é um especialista em busca bíblica. O usuário descreverá um sentimento, situação ou dúvida.\n" +
    "Sua tarefa é sugerir 4-6 versículos bíblicos que se apliquem diretamente ao contexto.\n" +
    "Retorne APENAS um JSON válido no formato:\n" +
    '[{"ref": "João 3:16", "text": "...", "explanation": "Por que este versículo é relevante"}, ...]\n\n' +
    "Responda em português brasileiro.",
  targum:
    "Você é um exegeta e linguista bíblico erudito, especialista em hebraico bíblico (AT) e grego koiné (NT), com formação em pensamento hebraico do Segundo Templo. Leia SEMPRE o Novo Testamento com mentalidade hebraica/judaica (hebraísmos, semitismos, idiomática do Segundo Templo), pois os autores do NT pensavam em hebraico/aramaico mesmo escrevendo em grego.\n" +
    "Você receberá uma referência bíblica (livro e capítulo) e a lista de versículos solicitados (com o texto em português apenas para orientação).\n\n" +
    "Para CADA versículo solicitado, produza:\n" +
    "1) 'original': o texto no idioma original — hebraico com vogais/pontuação massorética (BHS/WLC) para o AT; grego com acentos e espíritos (NA28/SBLGNT) para o NT.\n" +
    "2) 'transliteration': transliteração acadêmica legível para falantes de português (SBL simplificada), preservando sílabas e acento tônico.\n" +
    "3) 'literal': tradução em português brasileiro FIEL e CLARA ao sentido original que o texto realmente quer entregar, respeitando a ordem e a força de cada palavra do original. No NT, resolva o significado à luz do hebraísmo/idiomática hebraica correspondente (ex.: 'filho do homem' = ser humano/o Humano messiânico à luz de Daniel 7; 'temer a Deus' = reverência reverente; 'carne' = ser humano em sua fragilidade; 'nome' = identidade/autoridade; etc.). Traga o sentido que o leitor original entenderia.\n\n" +
    "REGRAS ABSOLUTAS DE FORMATO:\n" +
    "- NÃO use colchetes [ ] em nenhuma hipótese. NÃO marque palavras acrescentadas. Escreva o texto português fluente e claro, sem símbolos editoriais, sem parênteses explicativos, sem notas.\n" +
    "- NÃO inclua comentário, introdução, cabeçalho, glossário ou explicação — apenas o texto traduzido.\n" +
    "- NÃO parafraseie livremente nem suavize; mas também não force um português truncado: entregue a tradução mais próxima possível do sentido original que o texto pretende comunicar.\n" +
    "- NÃO invente versículos ausentes. Devolva apenas os solicitados.\n" +
    "- Retorne APENAS um JSON válido no formato exato:\n" +
    '{"verses":[{"number":1,"original":"...","transliteration":"...","literal":"..."}]}',
  "ask-bible": "", // placeholder — loaded from admin_settings
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tool, reference, text } = await req.json();

    if (!tool || (!TOOL_PROMPTS.hasOwnProperty(tool))) {
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

    // Rate limit: 20 requests / 60s per user (or IP for anonymous)
    const userId = await getRequestUserId(req);
    const identifier = getClientIdentifier(req, userId);
    const admin = createAdminClient();
    const rl = await checkRateLimit(admin, identifier, `ai-tools:${tool}`, 20, 60);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) {
      throw new Error("Nenhuma chave de IA configurada (LOVABLE_API_KEY ou GEMINI_API_KEY)");
    }

    // Check if feature is enabled
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check AI features
    const { data: setting } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "ai_features")
      .single();

    const features = (setting?.value as Record<string, boolean>) || {};

    // Check app features for ask-bible
    if (tool === "ask-bible") {
      const { data: appSetting } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "app_features")
        .single();

      const appFeatures = (appSetting?.value as Record<string, boolean>) || {};
      if (appFeatures.ask_bible === false) {
        return new Response(JSON.stringify({ error: "Este recurso está desativado pelo administrador." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const featureKey = tool.replace("-", "_");
      if (features[featureKey] === false) {
        return new Response(JSON.stringify({ error: "Este recurso de IA está desativado pelo administrador." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get prompt — start from default, override with admin custom prompt if present.
    let systemPrompt = TOOL_PROMPTS[tool];

    // Generic per-tool overrides stored in admin_settings.ai_tool_prompts = { [tool]: "..." }
    // Applies to: summary, devotional, connections, word-meaning, timeline, plan-generator
    if (tool !== "ask-bible") {
      try {
        const { data: promptsRow } = await supabase
          .from("admin_settings")
          .select("value")
          .eq("key", "ai_tool_prompts")
          .maybeSingle();
        const prompts = (promptsRow?.value as Record<string, string>) || {};
        const custom = prompts?.[tool];
        if (typeof custom === "string" && custom.trim().length > 0) {
          systemPrompt = custom;
        }
      } catch (e) {
        console.error("Failed to load custom tool prompts:", e);
      }
    }

    // For ask-bible, load custom prompt from admin_settings (legacy key)
    if (tool === "ask-bible") {
      const DEFAULT_ASK_PROMPT = `Você é um teólogo e pastor experiente. O usuário fará perguntas sobre a Bíblia, doutrina cristã, vida espiritual e temas relacionados.
Responda de forma:
1) Bíblica — sempre fundamente nas Escrituras com referências
2) Acessível — linguagem clara e acolhedora
3) Prática — conecte ao cotidiano do leitor
4) Equilibrada — apresente diferentes perspectivas quando relevante
Use markdown para formatação. Responda em português brasileiro.`;

      const { data: promptSetting } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "ask_bible_prompt")
        .single();

      if (promptSetting?.value && typeof promptSetting.value === "object" && (promptSetting.value as any).prompt) {
        systemPrompt = (promptSetting.value as any).prompt;
      } else {
        systemPrompt = DEFAULT_ASK_PROMPT;
      }
    }

    const isJsonTool = tool === "plan-generator" || tool === "semantic-search" || tool === "targum";

    const userContent = reference
      ? `**${reference}**\n\n"${text}"`
      : text;

    const response = await aiChatFetch({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      stream: !isJsonTool,
      ...(isJsonTool
        ? { response_format: { type: "json_object" }, max_tokens: tool === "targum" ? 8000 : 4000 }
        : {}),
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
