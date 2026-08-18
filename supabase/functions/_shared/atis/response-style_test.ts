import { assertEquals } from "jsr:@std/assert";
import { automaticBibleBlockLimit, cleanGeneratedBibleScaffolding } from "./assistant.ts";

Deno.test("ATIS removes empty Bible/share scaffolding produced by AI", () => {
  const input = `O sogro de Jacó era **Lábân**, pai de Lia e Raquel.

📖 *Gênesis 29:6 (ARC)* –

📖 Leia aqui:`;
  assertEquals(
    cleanGeneratedBibleScaffolding(input),
    "O sogro de Jacó era **Lábân**, pai de Lia e Raquel.",
  );
});

Deno.test("ATIS removes dangling reference list items but preserves natural prose", () => {
  const input = `A Bíblia apresenta Deus e o Cordeiro recebendo honra e glória. Veja Apocalipse 5:12-13.

- **1 Timóteo 1:17** –
- **Apocalipse 4:11** –`;
  assertEquals(
    cleanGeneratedBibleScaffolding(input),
    "A Bíblia apresenta Deus e o Cordeiro recebendo honra e glória. Veja Apocalipse 5:12-13.",
  );
});


Deno.test("ATIS common Bible conversation does not dump supporting verse blocks", () => {
  assertEquals(automaticBibleBlockLimit("ask_bible", "normal", false, "Como seria o dragão do livro de Apocalipse?"), 0);
  assertEquals(automaticBibleBlockLimit("ask_bible", "normal", false, "Quem é o sogro de Jacó?"), 0);
});

Deno.test("ATIS adds one trusted Bible block when the user actually asks for the passage", () => {
  assertEquals(automaticBibleBlockLimit("ask_bible", "normal", false, "Onde está escrito que Jesus é o autor e consumador da fé?"), 1);
  assertEquals(automaticBibleBlockLimit("ask_bible", "normal", true, "Explique João 3:17"), 1);
});

Deno.test("ATIS study routes may keep limited multi-reference depth", () => {
  assertEquals(automaticBibleBlockLimit("exegetai", "study", false, "Faça um estudo"), 2);
});
