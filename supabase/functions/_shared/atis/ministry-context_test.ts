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
  assert(followup.carryReference === "ctx:culto:2026-08-19", "culto context should survive a worship lookup without a selection");
});

Deno.test("remembered culto answers preacher, theme, time, place and scripture from exact date", () => {
  const questions = [
    ["Quem vai pregar?", "culto_info"],
    ["Qual o tema?", "culto_info"],
    ["Que horas começa?", "culto_info"],
    ["Onde vai ser?", "culto_info"],
    ["Qual o texto-base?", "culto_info"],
  ] as const;

  for (const [question, expectedRoute] of questions) {
    const marker = ministryContextMessage("ctx:culto:2026-08-19", question);
    assert(marker !== null, `${question} should consume remembered culto context`);
    const followup = resolveMinistryFollowup(question, [{ role: "user", content: marker.content }]);
    assert(followup?.route === expectedRoute, `${question} should route to culto_info`);
    assert(followup.message.includes("__ATIS_CULTO_DATE=2026-08-19__"), `${question} should use exact remembered date`);
    assert(followup.carryReference === "ctx:culto:2026-08-19", `${question} should preserve culto memory`);
  }
});

Deno.test("second worship item resolves to exact Cantico lyrics and becomes selected", () => {
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
  assert(followup.carryReference === "ctx:songs:2026-08-19:h15,c3,h124;s=c3", "selected Cantico should be remembered without losing list order");
});

Deno.test("selected Cantico supports natural continuity", () => {
  const reference = "ctx:songs:2026-08-19:h15,c3,h124;s=c3";
  const marker = ministryContextMessage(reference, "Qual foi o último cântico que você mandou?");
  assert(marker !== null, "selected Cantico should produce a marker for natural follow-up");
  assert(marker.content.includes("|s=c3]"), "selected Cantico should be encoded in the marker");
  const followup = resolveMinistryFollowup("Qual foi o último cântico que você mandou?", [{ role: "user", content: marker.content }]);
  assert(followup?.route === "canticos_info", "selected Cantico should route back to canticos_info");
  assert(followup.message === "Cântico 3 letra", "natural last-Cantico request should resolve the selected item");
  assert(followup.carryReference === reference, "selected Cantico memory should survive the answer");
});

Deno.test("first worship item resolves to exact Harpa chorus and becomes selected", () => {
  const reference = "ctx:songs:2026-08-19:h15,c3,h124";
  const marker = ministryContextMessage(reference, "Refrão do primeiro");
  assert(marker !== null, "ordinal Harpa follow-up should produce a context marker");
  const followup = resolveMinistryFollowup("Refrão do primeiro", [{ role: "user", content: marker.content }]);
  assert(followup?.route === "harpa_lookup", "first item should route to Harpa");
  assert(followup.message === "Harpa 15 refrão", "first item should become an explicit Harpa chorus lookup");
  assert(followup.carryReference === "ctx:songs:2026-08-19:h15,c3,h124;s=h15", "selected Harpa should be remembered without losing list order");
});

Deno.test("selected Harpa supports number and repeat follow-ups", () => {
  const reference = "ctx:songs:2026-08-19:h15,c3,h124;s=h15";
  const numberMarker = ministryContextMessage(reference, "Qual o número desse hino?");
  assert(numberMarker !== null, "selected Harpa should support number follow-up");
  const numberFollowup = resolveMinistryFollowup("Qual o número desse hino?", [{ role: "user", content: numberMarker.content }]);
  assert(numberFollowup?.route === "harpa_lookup", "Harpa number request should route to Harpa");
  assert(numberFollowup.message === "Harpa 15 qual o número desse hino", "Harpa number request should resolve selected hymn");

  const repeatMarker = ministryContextMessage(reference, "Manda de novo");
  assert(repeatMarker !== null, "selected Harpa should support repeat follow-up");
  const repeatFollowup = resolveMinistryFollowup("Manda de novo", [{ role: "user", content: repeatMarker.content }]);
  assert(repeatFollowup?.route === "harpa_lookup", "Harpa repeat should route to Harpa");
  assert(repeatFollowup.message === "Harpa 15", "Harpa repeat should resolve the selected hymn without guessing");
});

Deno.test("unrelated message does not consume ministry memory", () => {
  const marker = ministryContextMessage("ctx:culto:2026-08-19", "Explique Romanos 8");
  assert(marker === null, "unrelated Bible question must not inherit culto context");
  const followup = resolveMinistryFollowup("Manda a letra do segundo", []);
  assert(followup === null, "ordinal without a remembered list must not guess an item");
  const selected = ministryContextMessage("ctx:songs:2026-08-19:h15,c3;s=h15", "Explique João 3:16");
  assert(selected === null, "unrelated Bible question must not inherit selected song context");
});
