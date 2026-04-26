INSERT INTO public.admin_settings (key, value)
VALUES 
  ('motivational_push_enabled', 'true'),
  ('motivational_push_time', '"10:00"'),
  ('last_motivational_push_date', '""')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
