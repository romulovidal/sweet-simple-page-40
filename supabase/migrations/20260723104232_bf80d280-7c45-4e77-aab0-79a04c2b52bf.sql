
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_whatsapp_optin_idx
  ON public.profiles (whatsapp_opt_in)
  WHERE whatsapp_opt_in = true AND whatsapp IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wa text;
  _opt boolean;
BEGIN
  _wa := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'whatsapp',''), '\D', '', 'g'), '');
  _opt := COALESCE((NEW.raw_user_meta_data->>'whatsapp_opt_in')::boolean, false);

  INSERT INTO public.profiles (user_id, display_name, avatar_url, whatsapp, whatsapp_opt_in)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    _wa,
    CASE WHEN _wa IS NOT NULL THEN _opt ELSE false END
  );
  RETURN NEW;
END;
$function$;
