import {
  encodeCultoReference,
  encodeSongsReference,
  ministryContextMessage,
  parseMinistryReference,
  resolveMinistryFollowup,
} from "./ministry-context.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("encodes and parses remembered culto", () => {
  const encoded = encodeCultoReference("2026-08-19");
  assert(encoded === "ctx:culto:2026-08-19", "culto token should be deterministic");
  const parsed = parseMinistryReference(encoded);
  assert(parsed?.kind === "culto" && parsed.date === "2026-08-19", "culto token should round-trip");
});

Deno.test("remembered culto routes follow-up to exact worship date", () => {
  const marker = ministryContextMessage("ctx:culto:2026-08-19", "E os cânticos?");
  assert(marker !== null, "culto follow-up should produce a context marker");
  assert(marker.content === "Contexto ministerial atual: [ATIS_CULTO_DATE=2026-08-19]", "culto marker should carry exact date");
  const followup = resolveMinistryFollowup("E os cânticos?", [{ role: "user", content: marker.content }]);
  assert(followup?.route === "canticos_info", "culto follow-up should route to canticos_info");
  assert(followup.message.includes("__ATIS_CULTO_DATE=2026-08-19__"), "lookup should receive remembered culto date");
});

Deno.test("second worship item resolves to exact Cantico lyrics", () => {
  const reference = encodeSongsReference("2026-08-19", [
    { kind: "harpa", number: 15 },
    { kind: "cantico", number: 3 },
    { kind: "harpa", number: 124 },
  ]);
  assert(reference === "ctx:songs:2026-08-19:h15,c3,h124", "song token should preserve ordering and source");
  const marker = ministryContextMessage(reference, "Manda a letra do segundo");
  assert(marker !== null, "ordinal Cantico follow-up should produce a context marker");
  assert(marker.content.includes("[ATIS_SONG_LIST=2026-08-19|h15,c3,h124]"), "song list marker should preserve ordered items");
  const followup = resolveMinistryFollowup("Manda a letra do segundo", [{ role: "user", content: marker.content }]);
  assert(followup?.route === "canticos_info", "second item should route to canticos lookup");
  assert(followup.message === "Cântico 3 letra", "second item should become an explicit Cantico lyrics lookup");
  assert(followup.carryReference === reference, "ordered list should survive the item lookup");
});

Deno.test("first worship item resolves to exact Harpa chorus", () => {
  const reference = "ctx:songs:2026-08-19:h15,c3,h124";
  const marker = ministryContextMessage(reference, "Refrão do primeiro");
  assert(marker !== null, "ordinal Harpa follow-up should produce a context marker");
  const followup = resolveMinistryFollowup("Refrão do primeiro", [{ role: "user", content: marker.content }]);
  assert(followup?.route === "harpa_lookup", "first item should route to Harpa");
  assert(followup.message === "Harpa 15 refrão", "first item should become an explicit Harpa chorus lookup");
  assert(followup.carryReference === reference, "ordered list should survive Harpa lookup");
});

Deno.test("unrelated message does not consume ministry memory", () => {
  const marker = ministryContextMessage("ctx:culto:2026-08-19", "Explique Romanos 8");
  assert(marker === null, "unrelated Bible question must not inherit culto context");
  const followup = resolveMinistryFollowup("Manda a letra do segundo", []);
  assert(followup === null, "ordinal without a remembered list must not guess an item");
});
