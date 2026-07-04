// Estrutura de dados do hinário Harpa Cristã Atalaia.
// O JSON real será carregado pelo usuário — este arquivo define o schema
// e um array vazio inicial. Basta substituir HARPA_HINOS pelo conteúdo do JSON
// (ou fazer fetch dinâmico) quando o hinário estiver disponível.

export interface HarpaStrophe {
  /** true quando esta estrofe é o refrão/coro do hino */
  chorus?: boolean;
  /** linhas da estrofe */
  lines: string[];
}

export interface HarpaHino {
  /** número do hino no hinário (ex.: 1, 25, 320) */
  number: number;
  /** título do hino */
  title: string;
  /** autor / letrista, opcional */
  author?: string;
  /** compositor da melodia, opcional */
  composer?: string;
  /** tonalidade sugerida, opcional (ex.: "Dó Maior") */
  key?: string;
  /** referência bíblica associada, opcional */
  reference?: string;
  /** estrofes na ordem de execução */
  strophes: HarpaStrophe[];
}

// Preencher com o JSON completo do hinário.
export const HARPA_HINOS: HarpaHino[] = [];