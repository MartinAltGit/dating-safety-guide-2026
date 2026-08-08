-- CrakRevenue funnel click/conversion store.
-- Run once in Supabase SQL Editor (https://supabase.com/dashboard/project/duncigipcjmvxwgmboxg/sql)
-- Tables live in `public`; service_role key bypasses RLS, but we disable it anyway
-- since the only writer is the serverless backend holding the service key.

create table if not exists public.clicks (
  click_id   uuid primary key,
  src        text not null,
  ts         timestamptz not null,
  ip         text,
  country    text,
  device     text,
  ua         text,
  referrer   text,
  dest_url   text,
  site       text
);
create index if not exists clicks_ts_idx  on public.clicks (ts desc);
create index if not exists clicks_src_idx on public.clicks (src);

-- Idempotent conversion record. PRIMARY KEY on conversion_id makes a replayed
-- postback a no-op when inserted with Prefer: resolution=ignore-duplicates.
create table if not exists public.conversions (
  conversion_id text primary key,
  click_id      uuid references public.clicks(click_id),
  ts            timestamptz not null,
  raw_body      text
);
create index if not exists conversions_click_idx on public.conversions (click_id);

-- Append-only audit trail of every postback hit (including duplicates/junk).
create table if not exists public.postback_log (
  id            bigint generated always as identity primary key,
  conversion_id text,
  click_id      uuid,
  ts            timestamptz not null,
  ip            text,
  ua            text,
  raw_body      text
);
create index if not exists postback_log_ts_idx on public.postback_log (ts desc);

alter table public.clicks       disable row level security;
alter table public.conversions  disable row level security;
alter table public.postback_log disable row level security;

-- GDPR: click rows carry IP-derived data. 90-day retention per rebuild plan §8.
-- Run manually or via pg_cron if enabled:
--   delete from public.clicks where ts < now() - interval '90 days';
--   delete from public.postback_log where ts < now() - interval '90 days';
