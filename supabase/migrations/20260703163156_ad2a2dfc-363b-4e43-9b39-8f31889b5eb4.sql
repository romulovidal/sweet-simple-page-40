
-- Fix WITH CHECK on user_plan_progress UPDATE policy
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_plan_progress;
CREATE POLICY "Users can update own progress" ON public.user_plan_progress
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix WITH CHECK on user_streaks UPDATE policy
DROP POLICY IF EXISTS "Users can update own streak" ON public.user_streaks;
CREATE POLICY "Users can update own streak" ON public.user_streaks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix public.has_role: remove misleading `_user_id = auth.uid()` restriction so
-- admin tooling can look up other users' roles. Delegate directly to the
-- SECURITY DEFINER private.has_role which safely reads public.user_roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT private.has_role(_user_id, _role)
$function$;
