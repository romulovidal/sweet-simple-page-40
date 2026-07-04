import { supabase } from "@/integrations/supabase/client";

// Domínio público do app. Preferimos SEMPRE compartilhar via este domínio,
// não via URL do backend. Fallback: origin atual (útil em preview).
const APP_ORIGIN =
  (import.meta.env.VITE_APP_URL as string | undefined) ||
  "https://biblia.atalaias.online";

/**
 * Cria (ou reusa) um link curto para um conjunto de versículos.
 * O link fica no formato `<seu-domínio>/v/:slug` e resolve para a
 * rota `VerseShareRedirect`, que redireciona para a leitura do capítulo
 * com os versículos destacados. Meta tags dinâmicas são aplicadas no
 * cliente via Helmet (funcionam para Google e crawlers que executam JS).
 *
 * Em caso de falha, retorna o fallback (URL longa) para não bloquear
 * o compartilhamento.
 */
export async function createShortVerseLink(params: {
  bookAbbrev: string;
  chapter: number;
  verses: number[];
  fallbackLong: string;
  textSnippet?: string;
  bookName?: string;
  version?: string;
}): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("create-verse-share", {
      body: {
        book_abbrev: params.bookAbbrev,
        chapter: params.chapter,
        verses: params.verses,
        text_snippet: params.textSnippet,
        book_name: params.bookName,
        version: params.version,
      },
    });
    if (error || !data?.slug) return params.fallbackLong;
    return `${APP_ORIGIN}/v/${data.slug}`;
  } catch {
    return params.fallbackLong;
  }
}