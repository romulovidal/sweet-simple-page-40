alter table public.atis_bible_semantic_chunks
  add column if not exists search_document tsvector
  generated always as (
    to_tsvector(
      'portuguese',
      coalesce(book_name, '') || ' ' || coalesce(reference, '') || ' ' || coalesce(content, '')
    )
  ) stored;

create index if not exists atis_bible_semantic_chunks_search_document_idx
  on public.atis_bible_semantic_chunks using gin (search_document);

create or replace function public.atis_bible_concept_search(
  _terms text[],
  _bible_version text default 'ARC',
  _match_count integer default 32
)
returns table (
  reference text,
  content text,
  book_name text,
  rank real
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with cleaned as (
    select array_agg(term order by ord) as terms
    from (
      select ord,
             trim(regexp_replace(term, '[^[:alnum:]À-ÿ ''-]+', ' ', 'g')) as term
      from unnest(coalesce(_terms, array[]::text[])) with ordinality as t(term, ord)
      where length(trim(term)) between 2 and 80
        and term !~ '[0-9:]'
      limit 16
    ) s
    where term <> ''
  ), query_data as (
    select websearch_to_tsquery(
      'portuguese',
      array_to_string(terms, ' OR ')
    ) as q
    from cleaned
    where coalesce(array_length(terms, 1), 0) > 0
  )
  select c.reference,
         c.content,
         c.book_name,
         ts_rank_cd(c.search_document, q.q)::real as rank
  from public.atis_bible_semantic_chunks c
  cross join query_data q
  where c.bible_version = coalesce(nullif(trim(_bible_version), ''), 'ARC')
    and c.search_document @@ q.q
  order by rank desc, c.book_name, c.chapter, c.verse_start
  limit greatest(1, least(coalesce(_match_count, 32), 64));
$$;

revoke all on function public.atis_bible_concept_search(text[], text, integer) from public, anon, authenticated;
grant execute on function public.atis_bible_concept_search(text[], text, integer) to service_role;
