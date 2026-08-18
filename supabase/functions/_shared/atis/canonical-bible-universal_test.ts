import { assert, assertEquals } from "jsr:@std/assert";
import {
  type CanonicalEvidence,
  renderCanonicalConnections,
  retrieveCanonicalEvidence,
  validateCanonicalConnectionsPayload,
} from "./canonical-bible.ts";

Deno.test("canonical retrieval is generic: Melquisedeque is found again in Hebreus", () => {
  const bible = [
    {
      abbrev: "gn",
      name: "Gênesis",
      chapters: [[
        "E Melquisedeque, rei de Salém, trouxe pão e vinho; e este era sacerdote do Deus Altíssimo.",
        "E abençoou Abrão e disse: Bendito seja Abrão do Deus Altíssimo.",
      ]],
    },
    {
      abbrev: "hb",
      name: "Hebreus",
      chapters: Array.from({ length: 7 }, (_, i) => i === 6 ? [
        "Porque este Melquisedeque, que era rei de Salém e sacerdote do Deus Altíssimo, e que saiu ao encontro de Abraão.",
        "Sem pai, sem mãe, sem genealogia, não tendo princípio de dias nem fim de vida, mas sendo feito semelhante ao Filho de Deus.",
      ] : []),
    },
  ];
  const source = bible[0].chapters[0].map((text, index) => `${index + 1}. ${text}`).join("\n");
  const evidence = retrieveCanonicalEvidence("Gênesis 1:1-2", source, "Quais conexões aparecem depois?", bible, 8);
  assert(evidence.some((item) => item.reference.startsWith("Hebreus 7:")));
});

Deno.test("validator accepts verified semantic candidates without treating them as invented references", () => {
  const semantic: CanonicalEvidence[] = [
    {
      reference: "João 3:14-16",
      text: "E, como Moisés levantou a serpente no deserto, assim importa que o Filho do Homem seja levantado.",
      score: 18.5,
      testament: "NT",
      matchedEntities: [],
      matchedTerms: ["semantic"],
    },
    {
      reference: "Hebreus 9:11-14",
      text: "Mas, vindo Cristo, o sumo sacerdote dos bens futuros...",
      score: 15.2,
      testament: "NT",
      matchedEntities: [],
      matchedTerms: ["semantic"],
    },
  ];

  const validated = validateCanonicalConnectionsPayload({
    new_testament: [{ reference: "João 3:14-16", explanation: "O próprio Jesus relaciona o levantamento da serpente no deserto ao levantamento do Filho do Homem." }],
    parallels: [],
    recurring_themes: [],
    prophecy_fulfillment: { status: "typology", explanation: "É uma relação tipológica explicitamente retomada no Novo Testamento, não uma fórmula profética inventada.", references: ["João 3:14-16"] },
  }, semantic, "Números 21:4-9");

  const rendered = renderCanonicalConnections(validated);
  assert(rendered.includes("João 3:14-16"));
  assert(rendered.includes("tipológica"));
  assertEquals(rendered.includes("Hebreus 11:4"), false);
});

Deno.test("validator rejects a reference that was not retrieved by either lexical or semantic search", () => {
  const evidence: CanonicalEvidence[] = [{
    reference: "Salmos 110:4",
    text: "Tu és um sacerdote eterno, segundo a ordem de Melquisedeque.",
    score: 20,
    testament: "OT",
    matchedEntities: ["melquisedeque"],
    matchedTerms: [],
  }];

  const validated = validateCanonicalConnectionsPayload({
    new_testament: [{ reference: "Hebreus 7:1", explanation: "Esta referência não foi recuperada e deve ser descartada." }],
    prophecy_fulfillment: { status: "none", explanation: "Sem evidência recuperada suficiente para afirmar outra relação.", references: [] },
  }, evidence, "Salmos 110:4");

  assertEquals(validated.new_testament.length, 0);
  assertEquals(renderCanonicalConnections(validated).includes("Hebreus 7:1"), false);
});
