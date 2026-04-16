
-- Create culto_reminders table for multiple reminders per schedule
CREATE TABLE public.culto_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.culto_schedules(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL DEFAULT 180,
  message TEXT NOT NULL DEFAULT '',
  last_sent TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.culto_reminders ENABLE ROW LEVEL SECURITY;

-- Anyone can view reminders of active schedules
CREATE POLICY "Anyone can view reminders"
  ON public.culto_reminders
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.culto_schedules
    WHERE culto_schedules.id = culto_reminders.schedule_id
    AND culto_schedules.is_active = true
  ));

-- Admins can manage reminders
CREATE POLICY "Admins can manage reminders"
  ON public.culto_reminders
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for lookups
CREATE INDEX idx_culto_reminders_schedule ON public.culto_reminders(schedule_id);
