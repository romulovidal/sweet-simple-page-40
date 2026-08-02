import { supabase } from "@/integrations/supabase/client";

// Domínio público do app (o mesmo usado no compartilhamento de versículos).
const APP_ORIGIN =
  (import.meta.env.VITE_APP_URL as string | undefined) ||
  "https://biblia.atalaias.online";

/**
 * Cria (ou reusa) um link curto `<domínio>/c/:slug` para uma seleção de
 * hinos de culto. O link serve preview personalizado (Open Graph com
 * imagem gerada) para crawlers e redireciona humanos para o app.
 * Em caso de falha, devolve o fallback longo.
 */
export async function createShortCultoLink(
  cultoId: string,
  fallbackLong: string,
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("create-culto-share", {
      body: { culto_id: cultoId },
    });
    if (error || !data?.slug) return fallbackLong;
    return `${APP_ORIGIN}/c/${data.slug}`;
  } catch {
    return fallbackLong;
  }
}
