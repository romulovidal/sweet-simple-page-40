
-- prayer_requests
DROP POLICY IF EXISTS "Users can delete own requests" ON public.prayer_requests;
DROP POLICY IF EXISTS "Users can insert own requests" ON public.prayer_requests;
DROP POLICY IF EXISTS "Users can update own requests" ON public.prayer_requests;
DROP POLICY IF EXISTS "Users can view own requests" ON public.prayer_requests;
CREATE POLICY "Users can delete own requests" ON public.prayer_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own requests" ON public.prayer_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own requests" ON public.prayer_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own requests" ON public.prayer_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- prayer_reactions
DROP POLICY IF EXISTS "Auth users can insert reactions" ON public.prayer_reactions;
DROP POLICY IF EXISTS "Users can delete own reactions" ON public.prayer_reactions;
CREATE POLICY "Auth users can insert reactions" ON public.prayer_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.prayer_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- push_subscriptions (drop duplicate insert)
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.push_subscriptions;
CREATE POLICY "Users can delete own subscription" ON public.push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.push_subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own subscription" ON public.push_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_notes
DROP POLICY IF EXISTS "Users can delete own notes" ON public.user_notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON public.user_notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.user_notes;
DROP POLICY IF EXISTS "Users can view own notes" ON public.user_notes;
CREATE POLICY "Users can delete own notes" ON public.user_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON public.user_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.user_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own notes" ON public.user_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_saved_verses
DROP POLICY IF EXISTS "Users can delete own verses" ON public.user_saved_verses;
DROP POLICY IF EXISTS "Users can insert own verses" ON public.user_saved_verses;
DROP POLICY IF EXISTS "Users can update own verses" ON public.user_saved_verses;
DROP POLICY IF EXISTS "Users can view own verses" ON public.user_saved_verses;
CREATE POLICY "Users can delete own verses" ON public.user_saved_verses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own verses" ON public.user_saved_verses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own verses" ON public.user_saved_verses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own verses" ON public.user_saved_verses FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_plan_progress
DROP POLICY IF EXISTS "Users can delete own progress" ON public.user_plan_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_plan_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_plan_progress;
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_plan_progress;
CREATE POLICY "Users can delete own progress" ON public.user_plan_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.user_plan_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.user_plan_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own progress" ON public.user_plan_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_streaks
DROP POLICY IF EXISTS "Users can insert own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can update own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can view own streak" ON public.user_streaks;
CREATE POLICY "Users can insert own streak" ON public.user_streaks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streak" ON public.user_streaks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own streak" ON public.user_streaks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- reading_goals
DROP POLICY IF EXISTS "Users can delete own goals" ON public.reading_goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON public.reading_goals;
DROP POLICY IF EXISTS "Users can update own goals" ON public.reading_goals;
DROP POLICY IF EXISTS "Users can view own goals" ON public.reading_goals;
CREATE POLICY "Users can delete own goals" ON public.reading_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.reading_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.reading_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own goals" ON public.reading_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- device_streaks: explicit restrictive policies to block any direct client writes.
-- Writes go through the track-device edge function using service_role, which bypasses RLS.
CREATE POLICY "Block client inserts on device_streaks"
  ON public.device_streaks AS RESTRICTIVE FOR INSERT
  TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Block client updates on device_streaks"
  ON public.device_streaks AS RESTRICTIVE FOR UPDATE
  TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Block client reads on device_streaks"
  ON public.device_streaks AS RESTRICTIVE FOR SELECT
  TO anon USING (false);
