import { ministryContextMessage, resolveMinistryFollowup } from "./ministry-context.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("remembered culto routes worship-theme comparison to ministry relation", () => {
  const question = "Qual desses hinos combina mais com o tema da mensagem?";
  const marker = ministryContextMessage("ctx:culto:2026-08-19", question);
  assert(marker !== null, "relation question should consume remembered culto");
  const followup = resolveMinistryFollowup(question, [{ role: "user", content: marker.content }]);
  assert(followup?.route === "ministry_relation", "culto relation should route to ministry_relation");
  assert(followup.carryReference === "ctx:culto:2026-08-19", "culto relation should preserve remembered date");
});

Deno.test("selected song routes text-base compatibility question to ministry relation", () => {
  const reference = "ctx:songs:2026-08-19:h15,c3,h124;s=c3";
  const question = "Esse cântico combina com o texto-base do culto?";
  const marker = ministryContextMessage(reference, question);
  assert(marker !== null, "selected song relation should consume list memory");
  const followup = resolveMinistryFollowup(question, [{ role: "user", content: marker.content }]);
  assert(followup?.route === "ministry_relation", "selected song relation should use ministry_relation");
  assert(followup.carryReference === reference, "selected song relation should preserve selected item");
});
