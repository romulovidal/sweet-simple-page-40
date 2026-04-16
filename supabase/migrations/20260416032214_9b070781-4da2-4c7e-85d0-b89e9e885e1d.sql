
-- ============================================================
-- 1. USER NOTES (Anotações Pessoais)
-- ============================================================
CREATE TABLE public.user_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  book_abbrev text NOT NULL,
  chapter integer NOT NULL,
  verse integer,
  content text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes" ON public.user_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON public.user_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.user_notes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.user_notes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all notes" ON public.user_notes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_notes_updated_at BEFORE UPDATE ON public.user_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_notes_user ON public.user_notes (user_id);
CREATE INDEX idx_user_notes_ref ON public.user_notes (user_id, book_abbrev, chapter);

-- ============================================================
-- 2. PRAYER REQUESTS (Pedidos de Oração)
-- ============================================================
CREATE TABLE public.prayer_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  is_answered boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public requests" ON public.prayer_requests FOR SELECT USING (is_public = true);
CREATE POLICY "Users can view own requests" ON public.prayer_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own requests" ON public.prayer_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own requests" ON public.prayer_requests FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own requests" ON public.prayer_requests FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all requests" ON public.prayer_requests FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_prayer_requests_updated_at BEFORE UPDATE ON public.prayer_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_prayer_requests_user ON public.prayer_requests (user_id);
CREATE INDEX idx_prayer_requests_public ON public.prayer_requests (is_public, created_at DESC);

-- ============================================================
-- 3. PRAYER REACTIONS (Orei por você)
-- ============================================================
CREATE TABLE public.prayer_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.prayer_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);

ALTER TABLE public.prayer_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions" ON public.prayer_reactions FOR SELECT USING (true);
CREATE POLICY "Auth users can insert reactions" ON public.prayer_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.prayer_reactions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all reactions" ON public.prayer_reactions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_prayer_reactions_request ON public.prayer_reactions (request_id);

-- ============================================================
-- 4. READING GOALS (Metas de Leitura Anual)
-- ============================================================
CREATE TABLE public.reading_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  target_chapters integer NOT NULL DEFAULT 1189,
  completed_chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, year)
);

ALTER TABLE public.reading_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals" ON public.reading_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.reading_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.reading_goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.reading_goals FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all goals" ON public.reading_goals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_reading_goals_updated_at BEFORE UPDATE ON public.reading_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reading_goals_user ON public.reading_goals (user_id, year);
