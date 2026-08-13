-- 1) Revistas: allow anonymous read of active content
GRANT SELECT ON public.admin_revistas TO anon;
GRANT SELECT ON public.revista_aulas TO anon;

DROP POLICY IF EXISTS "Anyone can view active revistas" ON public.admin_revistas;
CREATE POLICY "Anyone can view active revistas"
ON public.admin_revistas FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can view active aulas" ON public.revista_aulas;
CREATE POLICY "Anyone can view active aulas"
ON public.revista_aulas FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.admin_revistas r
  WHERE r.id = revista_aulas.revista_id AND r.is_active = true
));

-- 2) Culto selections: public sees only active; admins see everything
DROP POLICY IF EXISTS "Culto selections are viewable by everyone" ON public.culto_selections;
CREATE POLICY "Active culto selections are viewable by everyone"
ON public.culto_selections FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Admins can view all culto selections"
ON public.culto_selections FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) Harpa reports: authenticated only, bound to own account
DROP POLICY IF EXISTS "anyone_can_insert_report" ON public.harpa_reports;
CREATE POLICY "authenticated_can_insert_own_report"
ON public.harpa_reports FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND char_length(message) >= 3
  AND char_length(message) <= 1000
  AND hino_number > 0
  AND char_length(hino_title) > 0
);

REVOKE INSERT ON public.harpa_reports FROM anon;