create table if not exists public.atis_harpa_youtube_cache (
  hymn_number integer primary key check (hymn_number > 0),
  hymn_title text not null,
  youtube_video_id text not null,
  youtube_title text,
  youtube_channel text,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.atis_harpa_youtube_cache enable row level security;

create index if not exists atis_harpa_youtube_cache_expires_idx
  on public.atis_harpa_youtube_cache (expires_at);

comment on table public.atis_harpa_youtube_cache is
  'Server-only cache of YouTube API results for Harpa Crista hymns used by ATIS/app.';
