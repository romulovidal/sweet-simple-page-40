import { supabase } from "@/integrations/supabase/client";

const APP_URL =
  typeof window !== "undefined" ? window.location.origin : "https://biblia.atalaias.online";

/**
 * Cria (ou reusa) um link curto para um conjunto de versículos.
 * Retorna a URL curta pronta para compartilhar. Em caso de falha,
 * retorna o fallback (URL longa) para não bloquear o compartilhamento.
 */
export async function createShortVerseLink(params: {
  bookAbbrev: string;
  chapter: number;
  verses: number[];
  fallbackLong: string;
}): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("create-verse-share", {
      body: {
        book_abbrev: params.bookAbbrev,
        chapter: params.chapter,
        verses: params.verses,
      },
    });
    if (error || !data?.slug) return params.fallbackLong;
    return `${APP_URL}/v/${data.slug}`;
  } catch {
    return params.fallbackLong;
  }
}