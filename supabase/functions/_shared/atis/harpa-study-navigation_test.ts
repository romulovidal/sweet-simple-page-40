import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assistantButtons, continueInAppLink } from "./conversation-runtime.ts";

Deno.test("Harpa study continues in Harpa area", () => {
  assertEquals(continueInAppLink("harpa_study", "Harpa 15"), "https://biblia.atalaias.online/harpa");
});

Deno.test("Harpa study uses Harpa quick actions", () => {
  const ids = assistantButtons("harpa_study").map((button) => button.id);
  assertEquals(ids, ["atis:app", "atis:mode:study"]);
});
