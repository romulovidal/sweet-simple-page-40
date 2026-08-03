CREATE TABLE IF NOT EXISTS public.admin_revistas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    image_url text,
    pdf_url text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_revistas TO authenticated;
GRANT ALL ON public.admin_revistas TO service_role;

ALTER TABLE public.admin_revistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage revistas" ON public.admin_revistas
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active revistas" ON public.admin_revistas
    FOR SELECT TO authenticated
    USING (is_active = true);