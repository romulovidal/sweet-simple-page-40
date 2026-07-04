
-- 1) device_streaks: bloqueio explícito de SELECT para authenticated (dados nunca são lidos direto pelo cliente; leitura acontece via edge function).
CREATE POLICY "Block authenticated reads on device_streaks"
  ON public.device_streaks FOR SELECT
  TO authenticated
  USING (false);

-- 2) profiles: remover a política que expõe display_name/avatar_url de autores públicos de orações.
DROP POLICY IF EXISTS "View profiles of public prayer authors" ON public.profiles;

-- Função security-definer devolve APENAS display_name (sem avatar/email/etc.)
-- e só para usuários que têm ao menos 1 pedido de oração público.
CREATE OR REPLACE FUNCTION public.get_prayer_author_names(_user_ids uuid[])
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND EXISTS (
      SELECT 1 FROM public.prayer_requests pr
      WHERE pr.user_id = p.user_id AND pr.is_public = true
    );
$$;

REVOKE ALL ON FUNCTION public.get_prayer_author_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_prayer_author_names(uuid[]) TO authenticated;
