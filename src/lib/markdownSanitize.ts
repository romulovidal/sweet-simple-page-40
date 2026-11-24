import { defaultSchema } from "rehype-sanitize";

// Esquema de HTML permitido nas respostas das IAs: o padrão do GitHub
// (rehype-sanitize) + style inline em span/mark/div, para a IA destacar
// trechos com cor (ex.: <span style="color:#fbbf24">termo-chave</span>).
// Scripts, iframes, formulários e handlers de evento continuam bloqueados
// pelo schema padrão — só estilo visual passa.
const attributes = {
  ...defaultSchema.attributes,
  span: [...(defaultSchema.attributes?.span ?? []), "style"],
  mark: [...(defaultSchema.attributes?.mark ?? []), "style"],
  div: [...(defaultSchema.attributes?.div ?? []), "style"],
};

export const aiSanitizeSchema = {
  ...defaultSchema,
  tagNames: Array.from(new Set([...(defaultSchema.tagNames ?? []), "mark"])),
  attributes,
};
