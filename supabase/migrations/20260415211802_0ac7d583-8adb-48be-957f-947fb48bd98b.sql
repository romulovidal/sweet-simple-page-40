-- Add UPDATE policy so upsert works for anonymous users
CREATE POLICY "Anon can update own subscription by endpoint"
ON public.push_subscriptions
FOR UPDATE
TO public
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);

-- Add UPDATE policy for authenticated users
CREATE POLICY "Users can update own subscription"
ON public.push_subscriptions
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);