drop policy if exists "Active culto events are viewable by everyone" on public.culto_events;

comment on table public.culto_events is
  'Admin-managed dated culto organization. Read by ATIS server-side; base table is not public because notes may contain internal context.';
