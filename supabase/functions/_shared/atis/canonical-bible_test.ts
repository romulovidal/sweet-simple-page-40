import { assert, assertEquals } from "jsr:@std/assert";
import { mergeHybridCanonicalEvidence, retrieveCanonicalEvidence, renderCanonicalConnections, validateCanonicalConnectionsPayload } from "./canonical-bible.ts";

const bible = [
  {
    abbrev: "gn",
    name: "Gênesis",
    chapters: [[
      "E conheceu Adão a Eva, sua mulher, e ela concebeu, e teve a Caim.",
      "E teve mais a seu irmão Abel; e Abel foi pastor de ovelhas, e Caim foi lavrador da terra.",
      "E aconteceu, ao cabo de dias, que Caim trouxe do fruto da terra uma oferta ao SENHOR.",
      "E Abel também trouxe dos primogênitos das suas ovelhas e da sua gordura; e atentou o SENHOR para Abel e para a sua oferta.",
      "Mas para Caim e para a sua oferta não atentou.",
      "E o SENHOR disse a Caim: Por que te iraste?",
      "Se bem fizeres, não haverá aceitação para ti? E, se não fizeres bem, o pecado jaz à porta.",
      "Caim se levantou contra o seu irmão Abel e o matou.",
      "E disse o SENHOR a Caim: Onde está Abel, teu irmão?",
      "A voz do sangue do teu irmão clama a mim desde a terra.",
    ]],
  },
  { abbrev: "mt", name: "Mateus", chapters: Array.from({ length: 23 }, (_, i) => i === 22 ? ["Para que sobre vós caia todo o sangue justo, desde o sangue de Abel, o justo."] : []) },
  { abbrev: "lc", name: "Lucas", chapters: Array.from({ length: 11 }, (_, i) => i === 10 ? ["Desde o sangue de Abel até ao sangue de Zacarias."] : []) },
  { abbrev: "hb", name: "Hebreus", chapters: Array.from({ length: 12 }, (_, i) => i === 10 ? ["Pela fé, Abel ofereceu a Deus maior sacrifício do que Caim."] : i === 11 ? ["E ao sangue da aspersão, que fala melhor do que o de Abel."] : []) },
  { abbrev: "1jo", name: "1 João", chapters: Array.from({ length: 3 }, (_, i) => i === 2 ? ["Não como Caim, que era do maligno e matou a seu irmão; e por que causa o matou? Porque as suas obras eram más, e as de seu irmão, justas."] : []) },
  { abbrev: "jd", name: "Judas", chapters: [["Ai deles! Porque entraram pelo caminho de Caim."]] },
];

Deno.test("canonical engine surfaces explicit New Testament references to Caim and Abel", () => {
  const source = bible[0].chapters[0].map((text, index) => `${index + 1}. ${text}`).join("\n");
  const evidence = retrieveCanonicalEvidence("Gênesis 1:1-10", source, "Quais as conexões bíblicas?", bible, 10);
  const refs = evidence.map((item) => item.reference);
  assert(refs.includes("Hebreus 11:1"));
  assert(refs.includes("Hebreus 12:1"));
  assert(refs.includes("1 João 3:1"));
  assert(refs.includes("Judas 1:1"));
});

Deno.test("connections validator never leaves prophecy fulfillment empty", () => {
  const source = bible[0].chapters[0].map((text, index) => `${index + 1}. ${text}`).join("\n");
  const evidence = retrieveCanonicalEvidence("Gênesis 1:1-10", source, "Quais as conexões bíblicas?", bible, 10);
  const validated = validateCanonicalConnectionsPayload({
    new_testament: [
      { reference: "Hebreus 11:1", explanation: "Abel é retomado como exemplo de fé e sua oferta é comparada com a de Caim." },
      { reference: "1 João 3:1", explanation: "Caim é citado diretamente como exemplo de ódio ao irmão e de obras más." },
    ],
    parallels: [],
    recurring_themes: [],
    prophecy_fulfillment: { status: "typology", explanation: "Não há profecia messiânica explícita; o sangue de Abel é contrastado com o sangue de Cristo em Hebreus.", references: ["Hebreus 12:1"] },
  }, evidence, "Gênesis 1:1-10");
  const rendered = renderCanonicalConnections(validated);
  assert(rendered.includes("Conexões no Novo Testamento"));
  assert(rendered.includes("Profecia / cumprimento"));
  assert(rendered.includes("Não há profecia messiânica explícita"));
  assertEquals(rendered.includes("Profecia / cumprimento\n\n"), false);
});


Deno.test("canonical entity extraction ignores narrative sentence starters", async () => {
  const { extractCanonicalEntities } = await import("./canonical-bible.ts");
  const entities = extractCanonicalEntities("Por isso o povo saiu. Pois havemos de ver. Moisés levantou a serpente. E Moisés orou.");
  assertEquals(entities.includes("por"), false);
  assertEquals(entities.includes("pois"), false);
  assertEquals(entities.includes("havemos"), false);
  assert(entities.includes("moises"));
});

Deno.test("canonical validator rejects unsupported references hidden inside explanations", () => {
  const evidence = [{
    reference: "Marcos 5:31-38",
    text: "Jesus fala de fé e cura.",
    score: 10,
    testament: "NT" as const,
    matchedEntities: [],
    matchedTerms: ["fé", "cura"],
  }];
  const validated = validateCanonicalConnectionsPayload({
    new_testament: [{
      reference: "Marcos 5:31-38",
      explanation: "Isto se cumpre diretamente em João 3:14-15.",
    }],
    prophecy_fulfillment: {
      status: "typology",
      explanation: "João 3:14-15 identifica o cumprimento.",
      references: [],
    },
  }, evidence, "Números 21:4-9");
  assertEquals(validated.new_testament[0]?.explanation.includes("João 3:14-15"), false);
  assertEquals(validated.prophecy_fulfillment.status, "none");
  assertEquals(validated.prophecy_fulfillment.explanation.includes("João 3:14-15"), false);
});

Deno.test("canonical validator accepts a subrange only when a recovered ARC chunk covers it", () => {
  const evidence = [{
    reference: "João 3:13-20",
    text: "Como Moisés levantou a serpente no deserto, assim importa que o Filho do Homem seja levantado.",
    score: 25,
    testament: "NT" as const,
    matchedEntities: [],
    matchedTerms: ["conceptual", "serpente", "moises"],
  }];
  const validated = validateCanonicalConnectionsPayload({
    new_testament: [{
      reference: "João 3:14-15",
      explanation: "João 3:14-15 retoma explicitamente Moisés e a serpente levantada no deserto.",
    }],
    prophecy_fulfillment: {
      status: "typology",
      explanation: "João 3:14-15 estabelece a tipologia entre a serpente levantada e o Filho do Homem levantado.",
      references: ["João 3:14-15"],
    },
  }, evidence, "Números 21:4-9");
  assertEquals(validated.new_testament[0]?.reference, "João 3:14-15");
  assertEquals(validated.prophecy_fulfillment.status, "typology");
  assert(validated.prophecy_fulfillment.references.includes("João 3:14-15"));
});


Deno.test("hybrid fusion reserves semantic evidence even when lexical scores dominate", () => {
  const lexical = Array.from({ length: 20 }, (_, index) => ({
    reference: `Livro Lexical ${index + 1}:1`,
    text: `Candidato lexical ${index + 1}`,
    score: 100 - index,
    testament: "OT" as const,
    matchedEntities: [`entidade-${index}`],
    matchedTerms: [],
  }));
  const semantic = [
    {
      reference: "João 3:13-20",
      text: "Como Moisés levantou a serpente no deserto, assim importa que o Filho do Homem seja levantado.",
      score: 8,
      testament: "NT" as const,
      matchedEntities: [],
      matchedTerms: ["conceptual", "moises", "serpente"],
    },
    ...Array.from({ length: 9 }, (_, index) => ({
      reference: `Livro Semântico ${index + 1}:1`,
      text: `Candidato semântico ${index + 1}`,
      score: 7 - index / 10,
      testament: "NT" as const,
      matchedEntities: [],
      matchedTerms: ["conceptual"],
    })),
  ];

  const merged = mergeHybridCanonicalEvidence(lexical, semantic, 8, 10);
  assert(merged.some((item) => item.reference === "João 3:13-20"));
  assertEquals(merged.filter((item) => item.reference.startsWith("Livro Lexical")).length, 8);
  assertEquals(merged.filter((item) => item.reference.startsWith("Livro Semântico") || item.reference === "João 3:13-20").length, 10);
});
