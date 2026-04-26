INSERT INTO public.admin_settings (key, value)
VALUES ('last_daily_verse_push_date', '""')
ON CONFLICT (key) DO NOTHING;
