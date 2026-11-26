import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "https://esm.sh/web-push@3.6.7";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAdminAuth } from "../_shared/auth-utils.ts";

/**
 * Notificações do módulo de Batismo.
 *
 * mode "lembretes": chamado pelo cron diário (service token). Para cada
 *   aluno cursando cuja próxima lição libera HOJE (fuso America/Fortaleza),
 *   envia push direcionado: "Sua Lição X já está liberada!".
 *
 * mode "admin_event": chamado pelo cliente do aluno (JWT do aluno) ao
 *   acontecer um evento (nova inscrição, aprovação, recuperação pendente).
 *   Envia push SOMENTE para usuários com papel admin/super_admin —
 *   NUNCA para auxiliar nem para outros alunos.
 */

const TIME_ZONE = "America/Fortaleza";

function dataKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function sendToSubscription(
  supabase: any,
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: string,
  options: any,
) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      options,
    );
    return { sent: 1, failed: 0 };
  } catch (e: any) {
    const statusCode = e.statusCode || 500;
    if (statusCode === 410 || statusCode === 404) {
      await supabase.from("push_subscriptions").delete().eq("id", sub.id);
    }
    return { sent: 0, failed: 1 };
  }
}

async function enviarParaUsuarios(
  supabase: any,
  userIds: string[],
  title: string,
  body: string,
  url: string,
  sentBy: string,
) {
  if (userIds.length === 0) return { sent: 0, failed: 0, total: 0 };

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (error) throw error;

  const payload = JSON.stringify({ title, body, url, type: "batismo" });
  const options = { TTL: 60 * 60 * 24, urgency: "high" };
  const results = await Promise.all(
    (subs ?? []).map((sub: any) => sendToSubscription(supabase, sub, payload, options)),
  );
  const sent = results.reduce((acc, r) => acc + r.sent, 0);
  const failed = results.reduce((acc, r) => acc + r.failed, 0);

  const { error: logError } = await supabase.from("push_log").insert({
    title,
    body,
    total_sent: sent,
    total_failed: failed,
    sent_by: sentBy,
  });
  if (logError) console.error("[batismo-notify] push_log insert failed", logError);

  return { sent, failed, total: (subs ?? []).length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

  if (!serviceKey || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const payload = await req.json().catch(() => ({}));
    const mode = String(payload?.mode || "");

    webpush.setVapidDetails(
      "mailto:admin@biblia-atalaia.lovable.app",
      vapidPublicKey,
      vapidPrivateKey,
    );

    // ----------------------------------------------------------------
    // Lembretes diários (cron / service token)
    // ----------------------------------------------------------------
    if (mode === "lembretes") {
      const auth = await validateAdminAuth(req, supabaseUrl, serviceKey);
      if (!auth.authorized) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: config } = await supabase
        .from("batismo_configuracoes")
        .select("intervalo_liberacao_horas")
        .eq("id", 1)
        .single();
      const intervaloHoras = Number(config?.intervalo_liberacao_horas ?? 24);

      const { data: licoes } = await supabase
        .from("batismo_licoes")
        .select("id, ordem, titulo")
        .order("ordem", { ascending: true });

      const { data: inscricoes } = await supabase
        .from("batismo_inscricoes")
        .select("id, user_id, nome, iniciado_em")
        .in("status", ["inscrito", "em_andamento"]);

      const hoje = dataKey(new Date());
      let totalEnviados = 0;

      for (const inscricao of inscricoes ?? []) {
        const { data: tentativas } = await supabase
          .from("batismo_tentativas")
          .select("licao_id, status")
          .eq("inscricao_id", inscricao.id)
          .eq("tipo", "exercicio")
          .eq("status", "enviada");
        const concluidas = new Set((tentativas ?? []).map((t: any) => t.licao_id));

        const iniciado = new Date(inscricao.iniciado_em);
        for (const licao of licoes ?? []) {
          if (concluidas.has(licao.id)) continue;
          // Próxima lição pendente: só lembra se a anterior foi concluída
          // (ou é a primeira) e a data de liberação é hoje.
          const liberacao = new Date(
            iniciado.getTime() + (licao.ordem - 1) * intervaloHoras * 3600_000,
          );
          if (dataKey(liberacao) === hoje) {
            const primeiroNome = String(inscricao.nome || "").split(" ")[0];
            const resultado = await enviarParaUsuarios(
              supabase,
              [inscricao.user_id],
              "Sua próxima lição já está liberada!",
              `${primeiroNome}, a Lição ${licao.ordem} — ${licao.titulo} do Curso de Preparação para o Batismo já está disponível.`,
              "/batismo/curso",
              "batismo-notify",
            );
            totalEnviados += resultado.sent;
          }
          break; // só a próxima lição pendente interessa
        }
      }

      return new Response(JSON.stringify({ ok: true, lembretes_enviados: totalEnviados }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----------------------------------------------------------------
    // Eventos para a administração (JWT do aluno)
    // ----------------------------------------------------------------
    if (mode === "admin_event") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      const user = userData?.user;
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const event = String(payload?.event || "");
      const inscricaoId = String(payload?.inscricao_id || "");

      const { data: inscricao } = await supabase
        .from("batismo_inscricoes")
        .select("id, nome, user_id")
        .eq("id", inscricaoId)
        .single();

      // O evento só pode ser disparado pelo dono da inscrição
      if (!inscricao || inscricao.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Média calculada das tentativas enviadas (exercícios + prova válida)
      let mediaTexto = "";
      if (event === "aprovado") {
        const { data: tentativas } = await supabase
          .from("batismo_tentativas")
          .select("tipo, nota, enviada_em")
          .eq("inscricao_id", inscricao.id)
          .eq("status", "enviada")
          .not("nota", "is", null);
        const notasExercicios = (tentativas ?? [])
          .filter((t: any) => t.tipo === "exercicio")
          .map((t: any) => Number(t.nota));
        const provaValida =
          (tentativas ?? [])
            .filter((t: any) => t.tipo === "recuperacao")
            .sort((a: any, b: any) => String(b.enviada_em).localeCompare(String(a.enviada_em)))[0] ||
          (tentativas ?? [])
            .filter((t: any) => t.tipo === "prova_final")
            .sort((a: any, b: any) => String(b.enviada_em).localeCompare(String(a.enviada_em)))[0];
        if (provaValida && notasExercicios.length > 0) {
          const todas = [...notasExercicios, Number(provaValida.nota)];
          const media = todas.reduce((acc, n) => acc + n, 0) / todas.length;
          mediaTexto = ` com média ${media.toFixed(1).replace(".", ",")}`;
        }
      }

      const textos: Record<string, { title: string; body: string }> = {
        nova_inscricao: {
          title: "Nova inscrição para o Batismo",
          body: `${inscricao.nome} se inscreveu no Curso de Preparação para o Batismo.`,
        },
        aprovado: {
          title: "Aluno aprovado no curso de Batismo",
          body: `${inscricao.nome} foi aprovado(a)${mediaTexto}. Aguardando conversa.`,
        },
        recuperacao_pendente: {
          title: "Recuperação pendente no curso de Batismo",
          body: `${inscricao.nome} ficou abaixo da média e aguarda a liberação da recuperação.`,
        },
      };
      const texto = textos[event];
      if (!texto) {
        return new Response(JSON.stringify({ error: "Unknown event" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // SOMENTE admin/super_admin — nunca auxiliar, nunca alunos
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "super_admin"]);
      const adminIds: string[] = [
        ...new Set<string>((roles ?? []).map((r: any) => String(r.user_id))),
      ];

      const resultado = await enviarParaUsuarios(
        supabase,
        adminIds,
        texto.title,
        texto.body,
        "/admin",
        user.id,
      );

      return new Response(JSON.stringify({ ok: true, ...resultado }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[batismo-notify] Request failed", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
