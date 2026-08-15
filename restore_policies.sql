-- Restoration of policies dropped by CASCADE during function replacement
-- This is necessary because public.has_role was dropped and recreated

-- Profiles
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User Plans & Progress
CREATE POLICY "Admins can manage all progress" ON public.user_plan_progress FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User Saved Verses
CREATE POLICY "Admins can manage all verses" ON public.user_saved_verses FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User Streaks
CREATE POLICY "Admins can manage all streaks" ON public.user_streaks FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Admin Settings & Logs
CREATE POLICY "Admins manage settings" ON public.admin_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage verse queue" ON public.daily_verse_queue FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage push log" ON public.push_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage activity log" ON public.admin_activity_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Prayer & Goals
CREATE POLICY "Admins can manage all notes" ON public.user_notes FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can manage all requests" ON public.prayer_requests FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can manage all reactions" ON public.prayer_reactions FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can manage all goals" ON public.reading_goals FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ATIS Tables
CREATE POLICY "admins can view crisis mutes" ON public.atis_crisis_mutes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Automation Tables (V2)
CREATE POLICY "Admins can do everything on atis_automation_settings" ON public.atis_automation_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can do everything on atis_notification_configs" ON public.atis_notification_configs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can do everything on atis_notification_targets" ON public.atis_notification_targets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can select logs on atis_automation_logs" ON public.atis_automation_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can select logs on atis_automation_attempts" ON public.atis_automation_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Other specific tables mentioned in the CASCADE log
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Only admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Additional tables from CASCADE log that weren't in the grep but are critical
CREATE POLICY "Admins can manage readings" ON public.admin_plan_readings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can manage plans" ON public.admin_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can manage posts" ON public.admin_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can manage revistas" ON public.admin_revistas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Note: The original names might vary slightly, but these restore the core administrative functionality
-- using the new hierarchical has_role function.
