
-- Restrict profiles SELECT
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "View profiles of public prayer authors"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prayer_requests pr
    WHERE pr.user_id = profiles.user_id AND pr.is_public = true
  )
);

-- Restrict prayer_reactions SELECT
DROP POLICY IF EXISTS "Authenticated users can view reactions" ON public.prayer_reactions;

CREATE POLICY "View reactions on visible requests"
ON public.prayer_reactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prayer_requests pr
    WHERE pr.id = prayer_reactions.request_id
      AND (pr.is_public = true OR pr.user_id = auth.uid())
  )
);
