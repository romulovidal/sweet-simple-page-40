
GRANT ALL ON public.culto_schedules TO authenticated, service_role;
GRANT ALL ON public.culto_reminders TO authenticated, service_role;
GRANT SELECT ON public.culto_schedules TO anon;
GRANT SELECT ON public.culto_reminders TO anon;
