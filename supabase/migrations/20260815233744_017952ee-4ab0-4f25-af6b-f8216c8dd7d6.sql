DO $$ 
BEGIN
    -- user_roles
    GRANT SELECT ON public.user_roles TO authenticated;
    GRANT SELECT ON public.user_roles TO anon;
    GRANT ALL ON public.user_roles TO service_role;

    -- profiles
    GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
    GRANT SELECT ON public.profiles TO anon;
    GRANT ALL ON public.profiles TO service_role;

    -- push_log
    GRANT SELECT, INSERT ON public.push_log TO authenticated;
    GRANT ALL ON public.push_log TO service_role;

    -- push_subscriptions
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
    GRANT ALL ON public.push_subscriptions TO service_role;

    -- atis_groups
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_groups TO authenticated;
    GRANT ALL ON public.atis_groups TO service_role;

    -- admin_settings
    GRANT SELECT, INSERT, UPDATE ON public.admin_settings TO authenticated;
    GRANT SELECT ON public.admin_settings TO anon;
    GRANT ALL ON public.admin_settings TO service_role;

    -- daily_verse_queue
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_verse_queue TO authenticated;
    GRANT SELECT ON public.daily_verse_queue TO anon;
    GRANT ALL ON public.daily_verse_queue TO service_role;

    -- atis_messages_log (usada pela send-push)
    GRANT INSERT ON public.atis_messages_log TO authenticated;
    GRANT ALL ON public.atis_messages_log TO service_role;
END $$;