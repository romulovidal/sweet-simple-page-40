
-- Create table to store push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscription"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view own subscriptions
CREATE POLICY "Users can view own subscription"
ON public.push_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can delete own subscriptions
CREATE POLICY "Users can delete own subscription"
ON public.push_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage subscriptions"
ON public.push_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow anonymous subscriptions (for non-logged-in users)
CREATE POLICY "Anon can insert subscription"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (user_id IS NULL);
