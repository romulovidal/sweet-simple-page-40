-- Preserve structured ATIS conversation memory across unrelated replies.
-- Generic last_reference may change (for example, to a Harpa reference), while
-- last_bible_reference keeps the most recent verified Bible context available.

create or replace function public.atis_preserve_conversation_bible_memory()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  merged_memory jsonb;
  candidate_reference text;
begin
  merged_memory := coalesce(old.memory, '{}'::jsonb) || coalesce(new.memory, '{}'::jsonb);
  candidate_reference := nullif(btrim(coalesce(new.memory->>'last_reference', '')), '');

  if candidate_reference is not null
     and coalesce(new.last_route, new.memory->>'last_route', '') = any (array[
       'bible_lookup', 'ask_bible', 'exegetai', 'chapter_summary',
       'word_meaning', 'connections', 'timeline', 'devotional', 'daily_verse'
     ]) then
    merged_memory := jsonb_set(
      merged_memory,
      '{last_bible_reference}',
      to_jsonb(candidate_reference),
      true
    );
  end if;

  new.memory := merged_memory;
  return new;
end;
$$;

revoke execute on function public.atis_preserve_conversation_bible_memory() from public, anon, authenticated;
grant execute on function public.atis_preserve_conversation_bible_memory() to service_role;

drop trigger if exists atis_preserve_conversation_bible_memory_trg on public.atis_conversation_state;
create trigger atis_preserve_conversation_bible_memory_trg
before update of memory, last_route on public.atis_conversation_state
for each row
execute function public.atis_preserve_conversation_bible_memory();

update public.atis_conversation_state
set memory = jsonb_set(
  memory,
  '{last_bible_reference}',
  to_jsonb(memory->>'last_reference'),
  true
)
where nullif(btrim(coalesce(memory->>'last_reference', '')), '') is not null
  and coalesce(last_route, memory->>'last_route', '') = any (array[
    'bible_lookup', 'ask_bible', 'exegetai', 'chapter_summary',
    'word_meaning', 'connections', 'timeline', 'devotional', 'daily_verse'
  ]);
