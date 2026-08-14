import { supabase } from "@/integrations/supabase/client";
// Types for atis_* tables aren't in the generated Database type yet,
// so we cast through unknown here. This is the single point of coupling.
export const atisDb = supabase;
