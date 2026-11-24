import type { Components } from "react-markdown";

// Componentes compartilhados do renderizador de markdown das IAs.
// Resolvem os defeitos vistos no app ao vivo (24/11):
//
// 1) Parágrafos grudados: a IA emite uma ideia por linha, com quebra
//    simples entre elas. O markdown colapsa a quebra simples (sem
//    remark-breaks) ou vira <br> indistinguível de quebra de linha
//    (com remark-breaks). A solução determinística é normalizar o
//    texto ANTES de renderizar: cada linha de ideia vira um parágrafo
//    próprio, com a margem real de parágrafo. Não depende do modelo
//    emitir linha em branco. Tabelas, listas, títulos e blocos de
//    código são preservados intactos.
// 2) Tabela estourando no celular: tabela larga sem rolagem esmaga as
//    colunas ou vaza da tela. O wrapper dá rolagem horizontal só na tabela.
// 3) Tabela sem bordas: as bordas vivem nas classes prose-* de cada
//    componente (tabela, th e td com border-white/15), estilo ChatGPT.

const TABLE_DELIMITER = /^\s*\|?[\s:|-]+\|[\s:|-]*\|?\s*$/;
const STRUCTURAL_LINE = /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?|---+$|\*\*\*+$|___+$|```)/;

function isTableRow(line: string): boolean {
  return line.includes("|");
}

/** Insere uma linha em branco entre linhas consecutivas de texto corrido,
 *  transformando cada ideia em um parágrafo próprio. Nunca mexe dentro de
 *  tabelas, listas, títulos, citações, divisórias ou blocos de código. */
export function normalizeAiMarkdown(content: string): string {
  const lines = content.split("\n");

  // Primeiro passo: marcar as linhas que pertencem a tabelas GFM.
  // Um bloco de tabela começa numa linha com | seguida da linha
  // delimitadora (|---|---|) e vai até a primeira linha sem | ou em branco.
  const inTable = new Array<boolean>(lines.length).fill(false);
  for (let i = 0; i < lines.length - 1; i++) {
    if (isTableRow(lines[i]) && TABLE_DELIMITER.test(lines[i + 1])) {
      let j = i;
      while (j < lines.length && lines[j].trim() !== "" && isTableRow(lines[j])) {
        inTable[j] = true;
        j++;
      }
    }
  }

  const out: string[] = [];
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) inCode = !inCode;
    out.push(line);
    if (inCode || inTable[i] || trimmed === "") continue;
    if (STRUCTURAL_LINE.test(trimmed)) continue;
    const next = lines[i + 1];
    if (next === undefined) continue;
    const nextTrim = next.trim();
    if (nextTrim === "" || inTable[i + 1]) continue;
    if (STRUCTURAL_LINE.test(nextTrim)) continue;
    out.push("");
  }
  return out.join("\n");
}

export const aiMarkdownComponents: Components = {
  br: () => <span className="block h-3" aria-hidden="true" />,
  table: ({ node, ...props }) => (
    <div className="ai-table-wrap overflow-x-auto -mx-1 px-1">
      <table {...props} />
    </div>
  ),
};
