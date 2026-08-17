-- Preserve short-lived ministry context (culto -> songs -> selected item)
-- independently from generic last_reference changes. Bible context continues to
-- use its own timestamp and longer TTL in the webhook runtime.

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

  if candidate_reference is not null
     and candidate_reference like 'ctx:%'
     and route_name = any (array['culto_info', 'canticos_info', 'harpa_lookup']) then
    merged_memory := jsonb_set(
      merged_memory,
      '{last_ministry_reference}',
      to_jsonb(candidate_reference),
      true
    );
    merged_memory := jsonb_set(
      merged_memory,
      '{last_ministry_reference_at}',
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
