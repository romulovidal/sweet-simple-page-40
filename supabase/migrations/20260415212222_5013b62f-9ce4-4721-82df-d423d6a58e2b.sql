DROP POLICY IF EXISTS "Anon can update own subscription by endpoint" ON public.push_subscriptions;

CREATE POLICY "Anon can update anonymous subscription"
ON public.push_subscriptions
FOR UPDATE
TO anon
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);