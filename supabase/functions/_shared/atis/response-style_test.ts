import { assertEquals } from "jsr:@std/assert";
import { automaticBibleBlockLimit, cleanGeneratedBibleScaffolding, needsNaturalBibleAnswerRepair, stripBrokenBibleGuardLines } from "./assistant.ts";

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


Deno.test("ATIS repairs common answers when quote guard would mutilate prose", () => {
  const broken = `Jesus crescia em 📖 *(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app)* (Lucas 2:40).`;
  assertEquals(needsNaturalBibleAnswerRepair(broken, "ask_bible", "normal"), true);
});

Deno.test("ATIS repairs unsolicited mini-study formatting in normal Bible chat", () => {
  const structured = `### Como entender\n- Primeiro ponto\n- Segundo ponto`;
  assertEquals(needsNaturalBibleAnswerRepair(structured, "ask_bible", "normal"), true);
  assertEquals(needsNaturalBibleAnswerRepair(structured, "ask_bible", "study"), false);
});

Deno.test("ATIS strips mutilated guard lines and orphan Bible headers", () => {
  const broken = `Jesus foi um menino obediente e cheio de sabedoria.\n\n- Crescia em 📖 *(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app)*.\n\n📖 *Lucas 2:40 (ARC)*\n\nA Bíblia registra poucos detalhes da infância de Jesus.`;
  assertEquals(
    stripBrokenBibleGuardLines(broken),
    `Jesus foi um menino obediente e cheio de sabedoria.\n\nA Bíblia registra poucos detalhes da infância de Jesus.`,
  );
});

Deno.test("ATIS accepts a natural paragraph answer without repair", () => {
  const natural = `A Bíblia registra poucos detalhes da infância de Jesus. Lucas mostra que ele crescia em sabedoria e graça, e aos doze anos já demonstrava profunda consciência das coisas de seu Pai (Lucas 2:40-52).`;
  assertEquals(needsNaturalBibleAnswerRepair(natural, "ask_bible", "normal"), false);
});
