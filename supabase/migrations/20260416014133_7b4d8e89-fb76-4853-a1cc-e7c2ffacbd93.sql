-- Create culto_schedules table for worship service scheduling
CREATE TABLE public.culto_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  time TIME NOT NULL,
  reminder_minutes_before INTEGER NOT NULL DEFAULT 180,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_reminder_sent TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.culto_schedules ENABLE ROW LEVEL SECURITY;

-- Anyone can view active schedules
CREATE POLICY "Anyone can view active schedules"
ON public.culto_schedules
FOR SELECT
TO public
USING (is_active = true);

-- Admins can manage all schedules
CREATE POLICY "Admins can manage schedules"
ON public.culto_schedules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_culto_schedules_updated_at
BEFORE UPDATE ON public.culto_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();