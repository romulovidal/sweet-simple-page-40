CREATE TABLE public.user_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync state"
  ON public.user_sync_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync state"
  ON public.user_sync_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync state"
  ON public.user_sync_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync state"
  ON public.user_sync_state FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all sync state"
  ON public.user_sync_state FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_sync_state_updated_at
  BEFORE UPDATE ON public.user_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
