
-- Remove permissive policies. All writes now go through the `track-device` edge
-- function which uses the service role (bypasses RLS) and validates ownership
-- / merges history server-side. Reads are restricted to admins only.
DROP POLICY IF EXISTS "Anyone can read device streaks" ON public.device_streaks;
DROP POLICY IF EXISTS "Anyone can insert device streaks" ON public.device_streaks;
DROP POLICY IF EXISTS "Anyone can update device streaks" ON public.device_streaks;
DROP POLICY IF EXISTS "Admins can delete device streaks" ON public.device_streaks;

-- Revoke direct table privileges from anon/authenticated. Only service_role
-- (used by the edge function) can touch the data.
REVOKE ALL ON public.device_streaks FROM anon;
REVOKE ALL ON public.device_streaks FROM authenticated;
GRANT SELECT ON public.device_streaks TO authenticated;
GRANT ALL ON public.device_streaks TO service_role;

-- Admin-only read policy for the admin dashboard.
CREATE POLICY "Admins can view device streaks"
  ON public.device_streaks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin-only delete (for cleanup from the admin panel).
CREATE POLICY "Admins can delete device streaks"
  ON public.device_streaks FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
