
CREATE TABLE public.harpa_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hino_number integer NOT NULL,
  hino_title text NOT NULL,
  message text NOT NULL CHECK (char_length(message) BETWEEN 3 AND 1000),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  admin_notes text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.harpa_reports TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.harpa_reports TO authenticated;
GRANT ALL ON public.harpa_reports TO service_role;

ALTER TABLE public.harpa_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can submit a report
CREATE POLICY "anyone_can_insert_report"
ON public.harpa_reports FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read
CREATE POLICY "admin_can_select_reports"
ON public.harpa_reports FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update (mark resolved / add notes)
CREATE POLICY "admin_can_update_reports"
ON public.harpa_reports FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "admin_can_delete_reports"
ON public.harpa_reports FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX harpa_reports_status_created_idx
  ON public.harpa_reports (status, created_at DESC);

CREATE TRIGGER harpa_reports_updated_at
  BEFORE UPDATE ON public.harpa_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
