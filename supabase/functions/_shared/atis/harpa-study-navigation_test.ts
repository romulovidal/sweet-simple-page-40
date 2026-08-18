import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assistantButtons, continueInAppLink } from "./conversation-runtime.ts";

Deno.test("Harpa study keeps its internal Harpa destination mapping", () => {
  assertEquals(continueInAppLink("harpa_study", "Harpa 15"), "https://biblia.atalaias.online/harpa");
});

Deno.test("Harpa study quick actions do not offer generic app links", () => {
  const ids = assistantButtons("harpa_study").map((button) => button.id);
  assertEquals(ids, ["atis:mode:study"]);
});
