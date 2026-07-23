import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatFetch } from "../_shared/ai-fetch.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!Deno.env.get("XAI_API_KEY") && !Deno.env.get("GEMINI_API_KEY") && !Deno.env.get("LOVABLE_API_KEY")) {
      return json({ error: "Nenhuma chave de IA configurada (XAI_API_KEY, GEMINI_API_KEY ou LOVABLE_API_KEY)" }, 500);
    }

    // Auth: only admins
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { topic } = await req.json().catch(() => ({}));
    const theme = typeof topic === "string" && topic.trim()
      ? topic.trim()
      : "Nova Harpa Cristã Atalaia com corinhos disponível no app; usuários podem ler as letras e também ouvir cada hino.";

    const seed = Math.random().toString(36).slice(2, 8);
    const system = `Você redige notificações push curtas, calorosas e evangélicas em português (Brasil) para o app "Bíblia Atalaia". Regras:
- Título: até 60 caracteres, com 1 emoji no início.
- Mensagem: até 140 caracteres, tom acolhedor e convidativo, sem exclamações em excesso.
- NUNCA repita frases genéricas; varie vocabulário e ângulo (louvor, adoração, oração, comunhão, edificação).
- Responda APENAS com JSON válido no formato: {"title":"...","body":"..."}`;

    const user = `Gere uma notificação nova e criativa (variação #${seed}) anunciando: ${theme}. Convide o irmão a abrir a Harpa e destacar que pode LER e OUVIR os hinos.`;

    const resp = await aiChatFetch({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429) return json({ error: "Muitas requisições, tente em instantes." }, 429);
      if (resp.status === 402) return json({ error: "Créditos da IA esgotados." }, 402);
      return json({ error: "Falha ao gerar mensagem" }, 502);
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { title?: string; body?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      // try extract JSON substring
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    if (!parsed.title || !parsed.body) return json({ error: "Resposta inválida da IA" }, 502);

    return json({
      title: String(parsed.title).slice(0, 100),
      body: String(parsed.body).slice(0, 500),
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}