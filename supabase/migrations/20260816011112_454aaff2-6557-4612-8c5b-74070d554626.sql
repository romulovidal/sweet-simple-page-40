ALTER TABLE public.atis_config ADD COLUMN IF NOT EXISTS last_connection_state TEXT;

-- Garantir que a service_role tenha acesso total
GRANT ALL ON public.atis_config TO service_role;
GRANT SELECT, UPDATE ON public.atis_config TO authenticated;

-- Habilitar Realtime para a tabela atis_config
ALTER PUBLICATION supabase_realtime ADD TABLE public.atis_config;
