ALTER TABLE public.admin_plans ADD COLUMN IF NOT EXISTS devotional text DEFAULT '';

ALTER TABLE public.admin_plan_readings ADD COLUMN IF NOT EXISTS title text DEFAULT '';
ALTER TABLE public.admin_plan_readings ADD COLUMN IF NOT EXISTS verse_start integer;
ALTER TABLE public.admin_plan_readings ADD COLUMN IF NOT EXISTS verse_end integer;