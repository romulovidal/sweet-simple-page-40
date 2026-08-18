import {
  directPhoneCandidates,
  inboundSessionDestinationId,
  preferredPhoneMatch,
} from "./direct-recipient.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("Brazilian WhatsApp JID without ninth digit matches canonical app E.164", () => {
  const candidates = directPhoneCandidates("558596181278@s.whatsapp.net");
  assert(candidates[0] === "+558596181278", "provider number should remain first candidate");
  assert(candidates.includes("+5585996181278"), "canonical Brazilian mobile variant should be generated");
});

Deno.test("Brazilian canonical JID also keeps provider variant", () => {
  const candidates = directPhoneCandidates("5585996181278@s.whatsapp.net");
  assert(candidates.includes("+5585996181278"), "canonical number should be preserved");
  assert(candidates.includes("+558596181278"), "legacy/provider no-ninth-digit variant should be generated");
});

Deno.test("non-Brazilian direct numbers are not rewritten", () => {
  const candidates = directPhoneCandidates("351912345678@s.whatsapp.net");
  assert(candidates.length === 1 && candidates[0] === "+351912345678", "non-Brazilian number must stay unchanged");
});

Deno.test("group JIDs never become direct phone candidates", () => {
  assert(directPhoneCandidates("120363412078418768@g.us").length === 0, "group JID must not be treated as a phone");
});

Deno.test("preferred match respects candidate priority", () => {
  const candidates = ["+558596181278", "+5585996181278"];
  const row = preferredPhoneMatch([
    { id: "canonical", phone_e164: "+5585996181278" },
    { id: "provider", phone_e164: "+558596181278" },
  ], candidates);
  assert(row?.id === "provider", "exact provider representation should win when both rows exist");
});

Deno.test("unknown direct session id is stable and valid UUID", async () => {
  const a = await inboundSessionDestinationId("558288666567@s.whatsapp.net");
  const b = await inboundSessionDestinationId("558288666567@s.whatsapp.net");
  const c = await inboundSessionDestinationId("558596181278@s.whatsapp.net");
  assert(a === b, "same JID must produce stable session identity");
  assert(a !== c, "different JIDs must produce different session identities");
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a), "session identity must be RFC4122 UUID-shaped");
});
