-- Ensure badges cannot be self-awarded by regular users
DROP POLICY IF EXISTS "Users can insert their own earned badges" ON public.user_badges;

-- Fix push subscription issues
-- Remove anonymous policies for push subscriptions to ensure data integrity
DROP POLICY IF EXISTS "Anon can insert subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anon can update anonymous subscription" ON public.push_subscriptions;

-- The unique constraint "push_subscriptions_endpoint_key" already exists, so we don't need to add it again.
-- If for some reason the policy for authenticated users was dropped or needs updating:
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.push_subscriptions;
CREATE POLICY "Users can insert their own subscription" 
ON public.push_subscriptions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
