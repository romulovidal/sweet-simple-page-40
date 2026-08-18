import { assertEquals } from "jsr:@std/assert";
import { automaticBibleBlockLimit, cleanGeneratedBibleScaffolding, needsNaturalBibleAnswerRepair, normalizeCommonBibleAnswer, stripBrokenBibleGuardLines, stripDevotionalBibleEcho } from "./assistant.ts";

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


Deno.test("ATIS deterministically flattens a repaired common Bible mini-study", () => {
  const structured = `Na última ceia, Jesus reuniu os discípulos.\n\n### Pontos principais\n- **Serviço** – Jesus lavou os pés dos discípulos.\n- **Memória** – A ceia aponta para sua entrega.\n\nIsso revela amor e humildade.`;
  assertEquals(
    normalizeCommonBibleAnswer(structured, "ask_bible", "normal"),
    `Na última ceia, Jesus reuniu os discípulos.\n\nServiço: Jesus lavou os pés dos discípulos. Memória: A ceia aponta para sua entrega.\n\nIsso revela amor e humildade.`,
  );
});

Deno.test("ATIS devotional removes model-owned duplicate Bible block before backend rendering", () => {
  const context = {
    label: "Isaías 55:6-9",
    text: "6 Buscai o SENHOR enquanto se pode achar, invocai-o enquanto está perto. 7 Deixe o perverso o seu caminho e converta-se ao SENHOR.",
  };
  const generated = `📖 *Isaías 55:6-9*\n\n${context.text}\n\nDeus nos chama a buscá-lo com sinceridade.\n\n**Oração:** Senhor, guia-nos em teus caminhos. Amém.`;
  assertEquals(
    stripDevotionalBibleEcho(generated, context),
    `Deus nos chama a buscá-lo com sinceridade.\n\n**Oração:** Senhor, guia-nos em teus caminhos. Amém.`,
  );
});
