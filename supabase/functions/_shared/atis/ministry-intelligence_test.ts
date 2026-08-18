import {
  isMinistryRelationIntent,
  ministryRelationContextFromHistory,
} from "./ministry-intelligence.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("detects selected song relation to culto text-base", () => {
  assert(isMinistryRelationIntent("Esse cântico combina com o texto-base do culto?"), "selected song relation should be detected");
});

Deno.test("detects comparison across current worship list", () => {
  assert(isMinistryRelationIntent("Qual desses hinos combina mais com o tema da mensagem?"), "list comparison should be detected");
});

Deno.test("does not hijack ordinary lyrics request", () => {
  assert(!isMinistryRelationIntent("Manda a letra do segundo"), "lyrics request must remain deterministic song lookup");
});

Deno.test("does not hijack ordinary culto detail", () => {
  assert(!isMinistryRelationIntent("Quem vai pregar nesse culto?"), "culto detail must remain culto lookup");
});

Deno.test("extracts date list and selected item from structured ministry history", () => {
  const marker = ministryRelationContextFromHistory([
    { role: "user", content: "Contexto ministerial atual: [ATIS_SONG_LIST=2026-08-19|h15,c3,h124|s=c3]" },
  ]);
  assert(marker?.date === "2026-08-19", "date should be preserved");
  assert(marker?.items.length === 3, "ordered song list should be preserved");
  assert(marker?.selected?.kind === "cantico" && marker.selected.number === 3, "selected Cantico should be preserved");
});

Deno.test("rejects selected marker that is not part of list", () => {
  const marker = ministryRelationContextFromHistory([
    { role: "user", content: "Contexto ministerial atual: [ATIS_SONG_LIST=2026-08-19|h15,c3|s=h999]" },
  ]);
  assert(marker?.selected === null, "stale selected item must not be trusted");
});
