DROP POLICY IF EXISTS "Public can read settings" ON public.admin_settings;

CREATE POLICY "Public can read feature flags only"
ON public.admin_settings
FOR SELECT
TO public
USING (key IN ('ai_features', 'app_features'));