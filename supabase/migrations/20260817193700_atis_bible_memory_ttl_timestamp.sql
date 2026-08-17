-- Timestamp the structured Bible context independently from generic conversation updates.
-- This lets the webhook enforce a bounded memory window without unrelated
-- messages keeping an old Bible reference alive forever.

create or replace function public.atis_preserve_conversation_bible_memory()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  merged_memory jsonb;
  candidate_reference text;
  route_name text;
begin
  merged_memory := coalesce(old.memory, '{}'::jsonb) || coalesce(new.memory, '{}'::jsonb);
  candidate_reference := nullif(btrim(coalesce(new.memory->>'last_reference', '')), '');
  route_name := coalesce(new.last_route, new.memory->>'last_route', '');

  if candidate_reference is not null
     and route_name = any (array[
       'bible_lookup', 'ask_bible', 'exegetai', 'chapter_summary',
       'word_meaning', 'connections', 'timeline', 'devotional', 'daily_verse'
     ]) then
    merged_memory := jsonb_set(
      merged_memory,
      '{last_bible_reference}',
      to_jsonb(candidate_reference),
      true
    );
    merged_memory := jsonb_set(
      merged_memory,
      '{last_bible_reference_at}',
      to_jsonb(now()::text),
      true
    );
  end if;

  new.memory := merged_memory;
  return new;
end;
$$;

revoke execute on function public.atis_preserve_conversation_bible_memory() from public, anon, authenticated;
grant execute on function public.atis_preserve_conversation_bible_memory() to service_role;

update public.atis_conversation_state
set memory = jsonb_set(
  memory,
  '{last_bible_reference_at}',
  to_jsonb(coalesce(memory->>'updated_at', updated_at::text)),
  true
)
where nullif(btrim(coalesce(memory->>'last_bible_reference', '')), '') is not null
  and nullif(btrim(coalesce(memory->>'last_bible_reference_at', '')), '') is null;
