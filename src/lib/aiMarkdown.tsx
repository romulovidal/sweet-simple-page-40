import type { Components } from "react-markdown";

// Componentes compartilhados do renderizador de markdown das IAs.
// Resolvem os dois defeitos vistos no app ao vivo (24/11):
//
// 1) Parágrafos grudados: a IA emite itens em linhas consecutivas
//    ("Autor: ... / Destinatário: ..."), que o markdown vira em <br>
//    dentro de um único parágrafo — sem margem nenhuma entre as linhas.
//    Cada <br> vira um respiro de 8px.
// 2) Tabela estourando no celular: tabela larga sem rolagem esmaga as
//    colunas ou vaza da tela. O wrapper dá rolagem horizontal só na tabela.
export const aiMarkdownComponents: Components = {
  br: () => <span className="block h-2" aria-hidden="true" />,
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto -mx-1 px-1">
      <table {...props} />
    </div>
  ),
};
