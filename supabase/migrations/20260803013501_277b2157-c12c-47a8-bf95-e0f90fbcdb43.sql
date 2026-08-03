CREATE TABLE IF NOT EXISTS public.revista_aulas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    revista_id uuid REFERENCES public.admin_revistas(id) ON DELETE CASCADE NOT NULL,
    lesson_number integer NOT NULL,
    title text NOT NULL,
    date text,
    golden_text text,
    practical_truth text,
    daily_readings jsonb,
    bible_reading_in_class text,
    introduction text,
    topics jsonb,
    conclusion text,
    questions jsonb,
    hinos_sugeridos text,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revista_aulas TO authenticated;
GRANT ALL ON public.revista_aulas TO service_role;

ALTER TABLE public.revista_aulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage aulas" ON public.revista_aulas
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active aulas" ON public.revista_aulas
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_revistas r WHERE r.id = revista_id AND r.is_active = true));