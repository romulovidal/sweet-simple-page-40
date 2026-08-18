alter table public.atis_bible_semantic_chunks
  add column if not exists search_document_ascii tsvector
  generated always as (
    to_tsvector(
      'portuguese',
      translate(
        lower(coalesce(book_name, '') || ' ' || coalesce(reference, '') || ' ' || coalesce(content, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçýÿ',
        'aaaaaeeeeiiiiooooouuuucyy'
      )
    )
  ) stored;

create index if not exists atis_bible_semantic_chunks_search_ascii_idx
  on public.atis_bible_semantic_chunks using gin (search_document_ascii);

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
    select ord,
           translate(
             lower(trim(regexp_replace(term, '[^[:alnum:]À-ÿ ''-]+', ' ', 'g'))),
             'áàâãäéèêëíìîïóòôõöúùûüçýÿ',
             'aaaaaeeeeiiiiooooouuuucyy'
           ) as term
    from unnest(coalesce(_terms, array[]::text[])) with ordinality as t(term, ord)
    where length(trim(term)) between 2 and 80
      and term !~ '[0-9:]'
    limit 16
  ), term_queries as (
    select ord, term, plainto_tsquery('portuguese', term) as q
    from cleaned
    where term <> ''
  ), term_stats as (
    select tq.ord,
           tq.term,
           tq.q,
           greatest(1, count(c.*))::double precision as document_frequency
    from term_queries tq
    left join public.atis_bible_semantic_chunks c
      on c.bible_version = coalesce(nullif(trim(_bible_version), ''), 'ARC')
     and c.search_document_ascii @@ tq.q
    group by tq.ord, tq.term, tq.q
  ), distinctive_terms as (
    select *
    from term_stats
    order by document_frequency asc, length(term) desc, ord asc
    limit 7
  ), scored as (
    select c.id,
           c.reference,
           c.content,
           c.book_name,
           c.chapter,
           c.verse_start,
           count(*) filter (where c.search_document_ascii @@ dt.q)::double precision as matched_terms,
           sum(
             case when c.search_document_ascii @@ dt.q
               then 1.0 / ln(2.0 + dt.document_frequency)
               else 0.0
             end
           ) as idf_score
    from public.atis_bible_semantic_chunks c
    cross join distinctive_terms dt
    where c.bible_version = coalesce(nullif(trim(_bible_version), ''), 'ARC')
    group by c.id, c.reference, c.content, c.book_name, c.chapter, c.verse_start
    having count(*) filter (where c.search_document_ascii @@ dt.q) > 0
  )
  select s.reference,
         s.content,
         s.book_name,
         ((s.matched_terms + s.idf_score) / 8.0)::real as rank
  from scored s
  order by ((s.matched_terms + s.idf_score) / 8.0) desc,
           s.book_name,
           s.chapter,
           s.verse_start
  limit greatest(1, least(coalesce(_match_count, 32), 64));
$$;

revoke all on function public.atis_bible_concept_search(text[], text, integer) from public, anon, authenticated;
grant execute on function public.atis_bible_concept_search(text[], text, integer) to service_role;
