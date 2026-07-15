
DROP POLICY IF EXISTS "anyone_can_insert_report" ON public.harpa_reports;

CREATE POLICY "anyone_can_insert_report"
ON public.harpa_reports FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(message) BETWEEN 3 AND 1000
  AND hino_number > 0
  AND char_length(hino_title) > 0
);
