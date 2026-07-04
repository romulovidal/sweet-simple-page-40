
CREATE TABLE public.verse_shares (
  slug text PRIMARY KEY,
  book_abbrev text NOT NULL,
  chapter integer NOT NULL,
  verses integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Reads público (para resolver o link ao abrir); escrita só pela edge function (service role).
GRANT SELECT ON public.verse_shares TO anon, authenticated;
GRANT ALL ON public.verse_shares TO service_role;

ALTER TABLE public.verse_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read verse shares"
  ON public.verse_shares FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Block direct inserts (use edge function)"
  ON public.verse_shares FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE INDEX idx_verse_shares_created_at ON public.verse_shares(created_at DESC);
