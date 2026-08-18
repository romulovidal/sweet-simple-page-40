import { assistantFailureReply } from "./failure-fallback.ts";
import { runtimeFailureReason } from "./conversation-runtime.ts";

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

Deno.test("AI provider outage receives a safe user-facing fallback", () => {
  const reason = runtimeFailureReason("AI_PROVIDER_UNAVAILABLE");
  assertEquals(reason, "ai_provider_unavailable", "provider reason");
  const reply = assistantFailureReply(reason);
  if (!reply?.includes("não inventar conteúdo")) throw new Error("AI fallback must state the grounding safety behavior");
});

Deno.test("app source outage receives a grounded fallback", () => {
  const reason = runtimeFailureReason("APP_BIBLE_INVALID");
  assertEquals(reason, "source_unavailable", "source reason");
  const reply = assistantFailureReply(reason);
  if (!reply?.includes("fonte do app")) throw new Error("source fallback must name the unavailable app source");
});

Deno.test("Evolution delivery errors never trigger a second fallback send", () => {
  const reason = runtimeFailureReason("EVOLUTION_HTTP_500: Evolution API returned HTTP 500");
  assertEquals(reason, "delivery_unavailable", "delivery reason");
  assertEquals(assistantFailureReply(reason), null, "delivery fallback");
});

Deno.test("unknown runtime errors stay silent to avoid duplicate sends", () => {
  assertEquals(assistantFailureReply(runtimeFailureReason("unexpected failure")), null, "runtime fallback");
});
