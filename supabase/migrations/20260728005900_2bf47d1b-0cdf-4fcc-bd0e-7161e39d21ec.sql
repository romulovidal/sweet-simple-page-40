
-- ============ MINISTROS ============
CREATE TABLE public.canticos_ministros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  foto_url text,
  ativo boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.canticos_ministros TO anon, authenticated;
GRANT ALL ON public.canticos_ministros TO service_role;

ALTER TABLE public.canticos_ministros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ministros visíveis para todos"
  ON public.canticos_ministros FOR SELECT
  USING (true);

CREATE POLICY "Admins gerenciam ministros"
  ON public.canticos_ministros FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_canticos_ministros_updated_at
  BEFORE UPDATE ON public.canticos_ministros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CANTICOS ============
CREATE TABLE public.canticos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero integer NOT NULL UNIQUE,
  titulo text NOT NULL,
  letra_raw text NOT NULL,
  letra_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  categoria text,
  tom text,
  capotraste integer,
  playbacks jsonb NOT NULL DEFAULT '[]'::jsonb,
  momentos_sugeridos text[] NOT NULL DEFAULT ARRAY[]::text[],
  referencia_biblica text,
  historico_execucao jsonb NOT NULL DEFAULT '[]'::jsonb,
  publicado boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX canticos_numero_idx ON public.canticos (numero);
CREATE INDEX canticos_categoria_idx ON public.canticos (categoria);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX canticos_titulo_trgm_idx ON public.canticos USING gin (titulo gin_trgm_ops);

GRANT SELECT ON public.canticos TO anon, authenticated;
GRANT ALL ON public.canticos TO service_role;

ALTER TABLE public.canticos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cânticos publicados visíveis para todos"
  ON public.canticos FOR SELECT
  USING (publicado = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam cânticos"
  ON public.canticos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_canticos_updated_at
  BEFORE UPDATE ON public.canticos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LINK CANTICO <-> MINISTRO ============
CREATE TABLE public.canticos_ministros_link (
  cantico_id uuid NOT NULL REFERENCES public.canticos(id) ON DELETE CASCADE,
  ministro_id uuid NOT NULL REFERENCES public.canticos_ministros(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (cantico_id, ministro_id)
);

CREATE INDEX canticos_ministros_link_ministro_idx ON public.canticos_ministros_link (ministro_id);

GRANT SELECT ON public.canticos_ministros_link TO anon, authenticated;
GRANT ALL ON public.canticos_ministros_link TO service_role;

ALTER TABLE public.canticos_ministros_link ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vínculos visíveis para todos"
  ON public.canticos_ministros_link FOR SELECT
  USING (true);

CREATE POLICY "Admins gerenciam vínculos"
  ON public.canticos_ministros_link FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Helper: próximo número disponível ============
CREATE OR REPLACE FUNCTION public.next_cantico_numero()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(MAX(numero), 0) + 1 FROM public.canticos;
$$;

GRANT EXECUTE ON FUNCTION public.next_cantico_numero() TO authenticated, service_role;
