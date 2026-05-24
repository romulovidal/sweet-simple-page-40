-- 1. Prayer requests: require auth to read public requests
DROP POLICY IF EXISTS "Anyone can view public requests" ON public.prayer_requests;
CREATE POLICY "Authenticated users can view public requests"
ON public.prayer_requests
FOR SELECT
TO authenticated
USING (is_public = true);

-- 2. Prayer reactions: require auth to view
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.prayer_reactions;
CREATE POLICY "Authenticated users can view reactions"
ON public.prayer_reactions
FOR SELECT
TO authenticated
USING (true);

-- 3. Profiles: restrict reads to authenticated users
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 4. Prevent users from self-awarding badges
DROP POLICY IF EXISTS "Users can insert their own earned badges" ON public.user_badges;
-- Admins can still manage via the existing admin pattern; add admin-only insert
CREATE POLICY "Admins can manage user badges"
ON public.user_badges
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
