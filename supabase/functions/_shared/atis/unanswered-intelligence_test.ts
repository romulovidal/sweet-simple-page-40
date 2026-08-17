import { runtimeFailureReason, unansweredReason } from "./conversation-runtime.ts";

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

Deno.test("classifies assistant uncertainty", () => {
  assertEquals(unansweredReason("Não tenho certeza dessa informação.", "ask_bible"), "assistant_uncertain", "uncertain");
});

Deno.test("classifies grounded lookup misses", () => {
  assertEquals(unansweredReason("🎵 Não encontrei esse hino na Harpa Cristã cadastrada no app.", "harpa_lookup"), "lookup_not_found", "lookup");
});

Deno.test("classifies incomplete Bible reference separately", () => {
  assertEquals(unansweredReason("📖 Não consegui identificar uma referência bíblica completa.", "bible_lookup"), "input_incomplete", "input");
});

Deno.test("classifies missing ministry grounding", () => {
  assertEquals(unansweredReason("Preciso de um culto lembrado com uma seleção ativa.", "ministry_relation"), "grounding_missing", "grounding");
});

Deno.test("does not flag a normal sourced answer", () => {
  assertEquals(unansweredReason("📖 João 3:16 — ARC", "bible_lookup"), null, "normal");
});

Deno.test("classifies provider and source runtime failures", () => {
  assertEquals(runtimeFailureReason("AI_PROVIDER_UNAVAILABLE"), "ai_provider_unavailable", "provider");
  assertEquals(runtimeFailureReason("AI_EMPTY_RESPONSE"), "ai_empty_response", "empty");
  assertEquals(runtimeFailureReason("APP_BIBLE_INVALID"), "source_unavailable", "source");
  assertEquals(runtimeFailureReason("unexpected failure"), "runtime_error", "runtime");
});
