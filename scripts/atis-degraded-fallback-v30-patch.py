from pathlib import Path
import re

# Classify Evolution delivery failures separately from app/source failures.
p = Path("supabase/functions/_shared/atis/conversation-runtime.ts")
text = p.read_text()
old = '''export function runtimeFailureReason(message: string) {
  const value = String(message ?? "").trim().toUpperCase();
  if (value.includes("AI_PROVIDER_UNAVAILABLE")) return "ai_provider_unavailable";
  if (value.includes("AI_EMPTY_RESPONSE")) return "ai_empty_response";
  if (value.includes("APP_") || value.includes("SOURCE_") || value.includes("HTTP_")) return "source_unavailable";
  return "runtime_error";
}'''
new = '''export function runtimeFailureReason(message: string) {
  const value = String(message ?? "").trim().toUpperCase();
  if (value.includes("AI_PROVIDER_UNAVAILABLE")) return "ai_provider_unavailable";
  if (value.includes("AI_EMPTY_RESPONSE")) return "ai_empty_response";
  if (value.includes("EVOLUTION_") || value.includes("EVOLUTION API")) return "delivery_unavailable";
  if (value.includes("APP_") || value.includes("SOURCE_")) return "source_unavailable";
  return "runtime_error";
}'''
if old not in text:
    raise SystemExit("runtimeFailureReason anchor missing")
p.write_text(text.replace(old, new, 1))

# Webhook: send a safe degraded reply only for AI/source outages, never for delivery errors.
p = Path("supabase/functions/atis-webhook/index.ts")
text = p.read_text()
import_anchor = 'import { EvolutionProvider, getEvolutionConfigFromEnv } from "../_shared/atis/evolution-provider.ts";\n'
fallback_import = 'import { assistantFailureReply } from "../_shared/atis/failure-fallback.ts";\n'
if fallback_import not in text:
    if import_anchor not in text:
        raise SystemExit("webhook Evolution import anchor missing")
    text = text.replace(import_anchor, import_anchor + fallback_import, 1)

# Operational review logging must never turn a successfully delivered answer into a failed interaction.
old_gap = '''      const gapReason = unansweredReason(answerText, answer.route);
      if (gapReason) {
        await recordUnanswered(supabase, { inboundId: inbound.id, destinationType, destinationId, question: limitedText, route: answer.route, answer: answerText, reason: gapReason });
      }'''
new_gap = '''      const gapReason = unansweredReason(answerText, answer.route);
      if (gapReason) {
        try {
          await recordUnanswered(supabase, { inboundId: inbound.id, destinationType, destinationId, question: limitedText, route: answer.route, answer: answerText, reason: gapReason });
        } catch (recordError) {
          console.error("[atis-webhook] could not record answered gap", recordError instanceof Error ? recordError.message : recordError);
        }
      }'''
if old_gap not in text:
    raise SystemExit("normal gap recorder anchor missing")
text = text.replace(old_gap, new_gap, 1)

pattern = re.compile(r'''    \} catch \(error\) \{\n      const message = error instanceof Error \? error\.message : "ATIS_ASSISTANT_INBOUND_ERROR";\n      console\.error\("\[atis-webhook\] inbound assistant failed", message\);\n      await supabase\.from\("atis_inbound_messages"\)\.update\(\{ status: "failed", error: message\.slice\(0, 500\), processed_at: new Date\(\)\.toISOString\(\) \}\)\.eq\("id", inbound\.id\);\n      if \(policyForFailure\?\.destinationType && policyForFailure\?\.destinationId\) \{\n        try \{\n          await recordUnanswered\(supabase, \{ inboundId: inbound\.id, destinationType: policyForFailure\.destinationType, destinationId: policyForFailure\.destinationId, question: limitedText, reason: runtimeFailureReason\(message\) \}\);\n        \} catch \(recordError\) \{\n          console\.error\("\[atis-webhook\] could not record unanswered", recordError instanceof Error \? recordError\.message : recordError\);\n        \}\n      \}\n      counts\.failed\+\+;''')
match = pattern.search(text)
if not match:
    raise SystemExit("webhook catch block anchor missing")
replacement = '''    } catch (error) {
      const message = error instanceof Error ? error.message : "ATIS_ASSISTANT_INBOUND_ERROR";
      const errorCode = firstString((error as any)?.code);
      const failureReason = runtimeFailureReason(`${errorCode ?? ""}:${message}`);
      console.error("[atis-webhook] inbound assistant failed", failureReason, message);

      let fallbackDelivered = false;
      const fallbackText = assistantFailureReply(failureReason);
      if (fallbackText && policyForFailure?.destinationType && policyForFailure?.destinationId) {
        try {
          if (!evolution) {
            const config = getEvolutionConfigFromEnv();
            evolution = new EvolutionProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey });
          }
          const sent = await evolution.sendText(providerInstanceName, directProviderTarget(remoteJid), fallbackText);
          const processedAt = new Date().toISOString();
          await supabase.from("atis_inbound_messages").update({
            status: "replied",
            response_text: fallbackText,
            error: message.slice(0, 500),
            processed_at: processedAt,
            metadata: {
              ...(inbound.metadata ?? {}),
              destination_type: policyForFailure.destinationType,
              destination_id: policyForFailure.destinationId,
              degraded: true,
              degraded_reason: failureReason,
              provider_response_message_id: sent.providerMessageId ?? null,
            },
          }).eq("id", inbound.id);
          fallbackDelivered = true;
          counts.replied++;
        } catch (fallbackError) {
          console.error("[atis-webhook] degraded fallback delivery failed", fallbackError instanceof Error ? fallbackError.message : fallbackError);
        }
      }

      if (!fallbackDelivered) {
        await supabase.from("atis_inbound_messages").update({
          status: "failed",
          error: message.slice(0, 500),
          processed_at: new Date().toISOString(),
          metadata: {
            ...(inbound.metadata ?? {}),
            degraded_reason: failureReason,
          },
        }).eq("id", inbound.id);
        counts.failed++;
      }

      if (policyForFailure?.destinationType && policyForFailure?.destinationId) {
        try {
          await recordUnanswered(supabase, {
            inboundId: inbound.id,
            destinationType: policyForFailure.destinationType,
            destinationId: policyForFailure.destinationId,
            question: limitedText,
            answer: fallbackDelivered ? fallbackText : null,
            reason: failureReason,
          });
        } catch (recordError) {
          console.error("[atis-webhook] could not record unanswered", recordError instanceof Error ? recordError.message : recordError);
        }
      }'''
text = text[:match.start()] + replacement + text[match.end():]
p.write_text(text)

# Console metrics: surface degraded replies separately from hard failures.
p = Path("supabase/functions/atis-console/index.ts")
text = p.read_text()
old_select = '.select("id,remote_jid,status,assistant_route,is_group,error,received_at")'
new_select = '.select("id,remote_jid,status,assistant_route,is_group,error,metadata,received_at")'
if old_select not in text:
    raise SystemExit("console inbound dashboard select anchor missing")
text = text.replace(old_select, new_select, 1)
old_attempted = '''  const attempted = replied.length + failed.length;
  const conversations = new Set(seven.map((row: any) => row.remote_jid)).size;'''
new_attempted = '''  const degraded = replied.filter((row: any) => row.metadata?.degraded === true);
  const attempted = replied.length + failed.length;
  const conversations = new Set(seven.map((row: any) => row.remote_jid)).size;'''
if old_attempted not in text:
    raise SystemExit("console attempted metric anchor missing")
text = text.replace(old_attempted, new_attempted, 1)
old_return = '''    failed_7d: failed.length,
    ignored_7d: ignored.length,'''
new_return = '''    failed_7d: failed.length,
    degraded_7d: degraded.length,
    ignored_7d: ignored.length,'''
if old_return not in text:
    raise SystemExit("console metric return anchor missing")
text = text.replace(old_return, new_return, 1)
p.write_text(text)

# Admin metrics type/card: make degraded replies visible without calling them hard failures.
p = Path("src/components/admin/atis/AtisHistory.tsx")
text = p.read_text()
old_type = '  failed_7d: number;\n  ignored_7d: number;'
new_type = '  failed_7d: number;\n  degraded_7d: number;\n  ignored_7d: number;'
if old_type not in text:
    raise SystemExit("history dashboard degraded type anchor missing")
text = text.replace(old_type, new_type, 1)
old_card = '["Falhas", dashboard.failed_7d, "7 dias"],\n          ["Ignoradas", dashboard.ignored_7d, "sem acionamento"],'
new_card = '["Falhas", dashboard.failed_7d, "7 dias"],\n          ["Degradadas", dashboard.degraded_7d, "fallback seguro"],\n          ["Ignoradas", dashboard.ignored_7d, "sem acionamento"],'
if old_card not in text:
    raise SystemExit("history degraded metric card anchor missing")
text = text.replace(old_card, new_card, 1)
p.write_text(text)
