import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deterministicIntent, stripGeneratedUrls } from "./assistant.ts";

const harpaHistory = [
  { role: "assistant" as const, content: "🎵 Harpa Cristã 198 — JESUS, O BOM AMIGO" },
];

Deno.test("explicit Bible reference overrides stale Harpa context", () => {
  assertEquals(deterministicIntent("Explique Lucas 21:20", harpaHistory), "ask_bible");
  assertEquals(deterministicIntent("Mostre Mateus 26:1-6", harpaHistory), "bible_lookup");
  assertEquals(deterministicIntent("Explique esse hino", harpaHistory), "harpa_study");
});

Deno.test("AI generated URLs are stripped before trusted Bible enrichment", () => {
  assertEquals(
    stripGeneratedUrls("Texto\nhttps://biblia.atalaias.online/v/3Rrudc\nhttps://example.com/x"),
    "Texto",
  );
});
