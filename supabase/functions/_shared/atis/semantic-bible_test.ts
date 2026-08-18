import { assert, assertEquals } from "jsr:@std/assert";
import { conceptRowsToEvidence, sanitizeConceptTerms } from "./semantic-bible.ts";

Deno.test("concept bridge rejects anything that looks like a Bible citation", () => {
  const terms = sanitizeConceptTerms({
    concepts: [
      "serpente levantada",
      "vida eterna",
      "João 3:16",
      "Hebreus 12:24",
      "salvação",
      "https://example.com",
      "vida eterna",
    ],
  });

  assertEquals(terms, ["serpente levantada", "vida eterna", "salvação"]);
});

Deno.test("concept bridge can rank a cross-testament relation without hardcoded references", () => {
  const evidence = conceptRowsToEvidence({
    sourceLabel: "Números 21:4-9",
    terms: ["serpente", "levantado", "vida", "crer", "salvação", "cura"],
    matchCount: 10,
    rows: [
      {
        reference: "1 Reis 19:1-8",
        book_name: "1 Reis",
        rank: 0.7,
        content: "Elias se levantou para escapar com vida e pediu ao Senhor que tomasse a sua vida.",
      },
      {
        reference: "João 3:13-20",
        book_name: "João",
        rank: 0.5,
        content: "Como Moisés levantou a serpente no deserto, assim importa que o Filho do Homem seja levantado, para que todo aquele que nele crê tenha a vida eterna e seja salvo.",
      },
      {
        reference: "Números 21:7-14",
        book_name: "Números",
        rank: 0.5,
        content: "Moisés fez uma serpente e a pôs sobre uma haste; quem olhava para ela ficava vivo.",
      },
    ],
  });

  assertEquals(evidence[0]?.reference, "João 3:13-20");
  assert(!evidence.some((item) => item.reference === "Números 21:7-14"));
  assert(evidence[0]?.matchedTerms.includes("conceptual"));
});

Deno.test("concept bridge does not invent a reference that was not returned by the app corpus", () => {
  const evidence = conceptRowsToEvidence({
    sourceLabel: "Salmos 110:1-4",
    terms: ["sacerdote", "rei", "ordem", "eterno"],
    rows: [
      {
        reference: "Hebreus 7:1-8",
        book_name: "Hebreus",
        rank: 0.8,
        content: "Melquisedeque, rei de Salém e sacerdote do Deus Altíssimo, permanece sacerdote continuamente.",
      },
    ],
  });

  assertEquals(evidence.map((item) => item.reference), ["Hebreus 7:1-8"]);
  assertEquals(evidence.some((item) => item.reference === "Mateus 22:44"), false);
});
