import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isHarpaStudyIntent } from "./assistant.ts";

Deno.test("Harpa study detects explicit thematic request", () => {
  assertEquals(isHarpaStudyIntent("Qual o tema do hino 15?"), true);
});

Deno.test("Harpa lookup remains non-AI for plain lookup", () => {
  assertEquals(isHarpaStudyIntent("Harpa 15"), false);
});

Deno.test("Harpa study resolves contextual follow-up from history", () => {
  assertEquals(isHarpaStudyIntent("Explique esse hino", [
    { role: "assistant", content: "🎵 *Harpa Cristã 15 — CONVERSÃO*\n\n1ª estrofe..." },
  ]), true);
});

Deno.test("Harpa study does not hijack unrelated Bible explanation", () => {
  assertEquals(isHarpaStudyIntent("Explique João 3:16"), false);
});
