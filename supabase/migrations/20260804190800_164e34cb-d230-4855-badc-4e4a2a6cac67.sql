
CREATE TABLE IF NOT EXISTS public.atis_optouts (
  phone text PRIMARY KEY,
  reason text,
  source text DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_optouts TO authenticated;
GRANT ALL ON public.atis_optouts TO service_role;
ALTER TABLE public.atis_optouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage optouts" ON public.atis_optouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.atis_send_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  recipient text NOT NULL,
  kind text NOT NULL DEFAULT 'bulk',
  is_group boolean NOT NULL DEFAULT false,
  body_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS atis_send_ledger_day_idx ON public.atis_send_ledger (day);
CREATE INDEX IF NOT EXISTS atis_send_ledger_recipient_idx ON public.atis_send_ledger (recipient, day);
CREATE INDEX IF NOT EXISTS atis_send_ledger_hash_idx ON public.atis_send_ledger (recipient, body_hash, created_at DESC);
GRANT SELECT ON public.atis_send_ledger TO authenticated;
GRANT ALL ON public.atis_send_ledger TO service_role;
ALTER TABLE public.atis_send_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read ledger" ON public.atis_send_ledger FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.atis_guard_check(
  _recipient text,
  _is_group boolean,
  _kind text,
  _body_hash text,
  _daily_global_cap integer,
  _daily_recipient_cap integer,
  _dedupe_hours integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'America/Fortaleza')::date;
  _global int;
  _per int;
  _dupe int;
BEGIN
  IF _kind <> 'reply' AND EXISTS (SELECT 1 FROM public.atis_optouts o WHERE o.phone = _recipient) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'opted_out');
  END IF;

  SELECT count(*) INTO _global FROM public.atis_send_ledger
   WHERE day = _today AND kind <> 'reply';
  SELECT count(*) INTO _per FROM public.atis_send_ledger
   WHERE day = _today AND recipient = _recipient AND kind <> 'reply';
  SELECT count(*) INTO _dupe FROM public.atis_send_ledger
   WHERE recipient = _recipient AND body_hash = _body_hash
     AND created_at > now() - make_interval(hours => GREATEST(_dedupe_hours, 0));

  IF _kind <> 'reply' THEN
    IF _global >= _daily_global_cap THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'global_cap', 'current', _global);
    END IF;
    IF NOT _is_group AND _per >= _daily_recipient_cap THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'recipient_cap', 'current', _per);
    END IF;
    IF _dupe > 0 AND _body_hash IS NOT NULL THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'duplicate');
    END IF;
  END IF;

  INSERT INTO public.atis_send_ledger (day, recipient, kind, is_group, body_hash)
  VALUES (_today, _recipient, _kind, _is_group, _body_hash);

  DELETE FROM public.atis_send_ledger WHERE created_at < now() - interval '30 days';

  RETURN jsonb_build_object('allowed', true, 'global', _global + 1, 'recipient', _per + 1);
END;
$$;
