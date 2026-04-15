
-- 1. Tabela admin_settings (configurações globais)
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settings" ON public.admin_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can read settings" ON public.admin_settings FOR SELECT TO public USING (true);

-- 2. Tabela daily_verse_queue (fila de versículos manuais)
CREATE TABLE public.daily_verse_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verse_text text NOT NULL,
  verse_ref text NOT NULL,
  scheduled_date date UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.daily_verse_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage verse queue" ON public.daily_verse_queue FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can read today verse" ON public.daily_verse_queue FOR SELECT TO public USING (scheduled_date = CURRENT_DATE);

-- 3. Tabela push_log (histórico de pushes)
CREATE TABLE public.push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total_sent int NOT NULL DEFAULT 0,
  total_failed int NOT NULL DEFAULT 0
);
ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage push log" ON public.push_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Tabela admin_activity_log (log de ações)
CREATE TABLE public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage activity log" ON public.admin_activity_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Inserir configuração padrão do versículo do dia
INSERT INTO public.admin_settings (key, value) VALUES ('daily_verse_mode', '"auto"');
