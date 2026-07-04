
-- 1. Favorites
CREATE TABLE public.historia_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ref_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, ref_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historia_favorites TO authenticated;
GRANT ALL ON public.historia_favorites TO service_role;
ALTER TABLE public.historia_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites read" ON public.historia_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own favorites insert" ON public.historia_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own favorites delete" ON public.historia_favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Quiz attempts
CREATE TABLE public.historia_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id text NOT NULL,
  score int NOT NULL,
  total int NOT NULL,
  duration_ms int NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historia_quiz_attempts TO authenticated;
GRANT ALL ON public.historia_quiz_attempts TO service_role;
ALTER TABLE public.historia_quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts read" ON public.historia_quiz_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own attempts insert" ON public.historia_quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX historia_quiz_attempts_user_quiz_idx ON public.historia_quiz_attempts (user_id, quiz_id, created_at DESC);

-- 3. Plan progress
CREATE TABLE public.historia_plan_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  day_index int NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_id, day_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historia_plan_progress TO authenticated;
GRANT ALL ON public.historia_plan_progress TO service_role;
ALTER TABLE public.historia_plan_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan read" ON public.historia_plan_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own plan insert" ON public.historia_plan_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own plan delete" ON public.historia_plan_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX historia_plan_progress_user_plan_idx ON public.historia_plan_progress (user_id, plan_id);
