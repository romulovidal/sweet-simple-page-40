import { supabase } from "@/integrations/supabase/client";

// URL da Edge Function pública que renderiza a prévia (OG) + redireciona
// humanos para o app. É o alvo dos crawlers do WhatsApp, Facebook, Twitter etc.
const FUNCTIONS_ORIGIN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * Cria (ou reusa) um link curto para um conjunto de versículos.
 * O link resultante aponta para uma edge function que:
 *   - Devolve HTML com meta tags Open Graph dinâmicas (título + trecho) para bots
 *   - Redireciona o usuário humano para a leitura no app
 *
 * Em caso de falha, retorna o fallback (URL longa) para não bloquear o compartilhamento.
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
    return `${FUNCTIONS_ORIGIN}/s/${data.slug}`;
  } catch {
    return params.fallbackLong;
  }
}