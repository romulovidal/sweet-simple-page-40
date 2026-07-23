
ALTER TABLE public.atis_groups
  ADD COLUMN IF NOT EXISTS forward_notifications boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_atis_groups_forward
  ON public.atis_groups(forward_notifications) WHERE forward_notifications = true;
