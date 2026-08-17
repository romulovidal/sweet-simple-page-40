// Administrative endpoint for editable ATIS behavior and prompts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

type Json = Record<string, any>;

const DEFAULT_BIRTHDAY_PROMPT = `Você é o Atis, assistente do Ministério Atalaias de Betel. Sua tarefa é gerar uma mensagem curta, alegre e abençoadora de feliz aniversário para os membros da igreja, incluindo uma referência bíblica (versão ARC).

Diretrizes da Mensagem:
- Estrutura:
  1. Linha 1: Emojis festivos + anúncio da celebração da vida do aniversariante (destaque o nome em *negrito*).
  2. Linha 2: Uma palavra/desejo curto de bênção, paz e fortalecimento no Senhor.
  3. Linha 3: Um versículo bíblico curto e inspirador no formato ARC (ex: "O Senhor te abençoe e te guarde." - Números 6:24 📖).
  4. Linha 4: Encerramento afetuoso assinado pelo "Ministério Atalaias de Betel".
- Tom de voz: Acolhedor, edificante, vibrante e carinhoso.
- Elementos visuais: Use emojis festivos (🎉, 🎂, ✨, 🙏, 📖, ❤️) e formatação limpa.
- Tamanho: Máximo de 4 a 5 linhas.

Exemplo de saída esperada:
🎉🎂 Hoje celebramos a vida de *[NOME]*! Que o Senhor continue abençoando, fortalecendo e conduzindo cada um dos seus passos. 🙏✨

_"O Senhor te abençoe e te guarde."_ - Números 6:24 📖

Com carinho, Ministério Atalaias de Betel. ❤️`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const auth = await validateAdminAuth(req, url, serviceKey);
  if (!auth.authorized) {
    const forbidden = auth.error === "Administrative access required";
    return json({ error: forbidden ? "FORBIDDEN" : "UNAUTHORIZED", message: auth.error }, forbidden ? 403 : 401);
  }

  let input: Json = {};
  try { input = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const action = String(input.action ?? "get");
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: rows, error } = await supabase
      .from("atis_settings")
      .select("key,value,updated_at")
      .in("key", ["assistant", "birthday_message_prompt"]);
    if (error) throw error;

    const assistant = (rows ?? []).find((item: any) => item.key === "assistant") ?? null;
    const birthday = (rows ?? []).find((item: any) => item.key === "birthday_message_prompt") ?? null;
    if (!assistant) return json({ error: "ASSISTANT_SETTINGS_NOT_FOUND" }, 404);

    const birthdayPrompt = typeof birthday?.value?.prompt === "string" && birthday.value.prompt.trim()
      ? birthday.value.prompt.trim()
      : DEFAULT_BIRTHDAY_PROMPT;

    if (action === "get") {
      return json({
        prompt: typeof assistant.value?.system_prompt === "string" ? assistant.value.system_prompt : "",
        birthday_prompt: birthdayPrompt,
        enabled: assistant.value?.enabled !== false,
        auto_reply_direct: assistant.value?.auto_reply_direct !== false,
        auto_reply_groups: assistant.value?.auto_reply_groups !== false,
        group_mention_only: assistant.value?.group_mention_only === true,
        updated_at: assistant.updated_at,
        birthday_prompt_updated_at: birthday?.updated_at ?? null,
        immutable_policy: true,
      });
    }

    if (action === "save_behavior") {
      const next = {
        ...(assistant.value ?? {}),
        auto_reply_direct: input.auto_reply_direct !== false,
        auto_reply_groups: input.auto_reply_groups !== false,
        group_mention_only: input.group_mention_only === true,
      };
      const { data: saved, error: saveError } = await supabase
        .from("atis_settings")
        .update({ value: next })
        .eq("key", "assistant")
        .select("updated_at")
        .single();
      if (saveError) throw saveError;
      return json({
        ok: true,
        auto_reply_direct: next.auto_reply_direct,
        auto_reply_groups: next.auto_reply_groups,
        group_mention_only: next.group_mention_only,
        updated_at: saved.updated_at,
      });
    }

    if (action === "save_birthday_prompt") {
      const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
      if (prompt.length < 120) return json({ error: "BIRTHDAY_PROMPT_TOO_SHORT", message: "O prompt de aniversário precisa ter pelo menos 120 caracteres." }, 400);
      if (prompt.length > 12000) return json({ error: "BIRTHDAY_PROMPT_TOO_LONG", message: "O prompt de aniversário pode ter no máximo 12.000 caracteres." }, 400);

      const { data: saved, error: saveError } = await supabase.from("atis_settings").upsert({
        key: "birthday_message_prompt",
        value: { prompt },
        description: "Prompt editável usado pelo ATIS para gerar mensagens de aniversário em grupos.",
      }, { onConflict: "key" }).select("updated_at").single();
      if (saveError) throw saveError;
      return json({ ok: true, prompt, updated_at: saved.updated_at });
    }

    if (action === "save") {
      const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
      if (prompt.length < 200) return json({ error: "PROMPT_TOO_SHORT", message: "O prompt precisa ter pelo menos 200 caracteres." }, 400);
      if (prompt.length > 20000) return json({ error: "PROMPT_TOO_LONG", message: "O prompt pode ter no máximo 20.000 caracteres." }, 400);
      const next = { ...(assistant.value ?? {}), system_prompt: prompt };
      const { data: saved, error: saveError } = await supabase
        .from("atis_settings")
        .update({ value: next })
        .eq("key", "assistant")
        .select("updated_at")
        .single();
      if (saveError) throw saveError;
      return json({ ok: true, prompt, updated_at: saved.updated_at, immutable_policy: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("[atis-settings]", error instanceof Error ? error.message : error);
    return json({ error: "ATIS_SETTINGS_ERROR" }, 500);
  }
});
