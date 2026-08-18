import { assertEquals } from "jsr:@std/assert";
import { cleanGeneratedBibleScaffolding } from "./assistant.ts";

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
