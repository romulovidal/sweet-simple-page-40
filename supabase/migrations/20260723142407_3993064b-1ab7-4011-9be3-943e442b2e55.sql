ALTER TABLE public.atis_broadcasts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.atis_broadcasts;