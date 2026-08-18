import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { appendContinueInApp, assistantButtons, sanitizeAtisLinks } from "./conversation-runtime.ts";

Deno.test("ATIS removes ordinary app URLs", () => {
  assertEquals(
    appendContinueInApp("Resposta\n\n📱 *Continue no app:*\nhttps://biblia.atalaias.online/harpa", "harpa_lookup", true, "Harpa 15"),
    "Resposta",
  );
});

Deno.test("ATIS preserves only short verse share URLs", () => {
  const short = "https://biblia.atalaias.online/v/KXaUGU";
  assertEquals(sanitizeAtisLinks(`📖 Leia aqui: ${short}`), `📖 Leia aqui: ${short}`);
  assertEquals(sanitizeAtisLinks(`Link solto ${short}`), "Link solto");
  assertEquals(sanitizeAtisLinks("Veja https://example.com e https://biblia.atalaias.online/biblia"), "Veja  e");
});

Deno.test("quick actions no longer offer generic app links", () => {
  assertEquals(assistantButtons("bible_lookup").map((button) => button.id), ["atis:mode:study", "atis:devotional"]);
  assertEquals(assistantButtons("harpa_study").map((button) => button.id), ["atis:mode:study"]);
});
