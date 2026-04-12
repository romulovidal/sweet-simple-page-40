-- Fix: Prevent non-admin users from inserting into user_roles
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix: Add UPDATE policy for user_saved_verses
CREATE POLICY "Users can update own verses"
  ON public.user_saved_verses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);