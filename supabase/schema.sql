-- Run this in the Supabase SQL editor to bootstrap the schema.

create extension if not exists "uuid-ossp";

-- source_videos: one row per unique video URL (cache key)
-- user_id is an app-level owner tag, not a Supabase Auth foreign key — Tempo
-- has no sign-in flow, so it's just the fixed UUID from EXPO_PUBLIC_USER_ID /
-- OWNER_USER_ID, kept for schema shape only (multi-user is not supported).
create table source_videos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  original_url text unique,
  platform text not null check (platform in ('youtube', 'tiktok', 'uploaded', 'instagram', 'facebook', 'pdf', 'text')),
  title text not null default '',
  duration_sec integer,
  thumbnail_url text,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'complete', 'failed')),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index on source_videos (original_url);
create index on source_videos (user_id);

-- movements: one row per exercise clip
create table movements (
  id uuid primary key default uuid_generate_v4(),
  source_video_id uuid not null references source_videos(id) on delete cascade,
  position integer not null,
  name text not null,
  mode text not null check (mode in ('timed', 'reps')),
  -- null for text-derived movements, which have no video timestamp range
  start_sec integer,
  end_sec integer,
  duration_sec integer,
  reps integer,
  sets integer,
  -- null for text-derived movements, which have no video clip
  clip_url text,
  thumbnail_url text,
  -- 'manual' is a row created directly in the review screen (e.g. a rest
  -- inserted by hand), not detected from any source
  detection_method text not null check (detection_method in ('ocr', 'twelve_labs', 'llm_text', 'manual')),
  confidence float not null default 0,
  -- true for a rest interval row rather than an exercise
  is_rest boolean not null default false,
  -- true if this rest was inserted by the "rest between moves" toggle rather
  -- than by hand — the toggle only ever removes rows marked true here
  auto_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create index on movements (source_video_id, position);

-- workouts: user-owned collection of movements
create table workouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  title text not null,
  source_video_id uuid not null references source_videos(id),
  total_duration_sec integer,
  created_at timestamptz not null default now()
);

create index on workouts (user_id, created_at desc);

-- workout_movements: ordered join between workout and movements
create table workout_movements (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references workouts(id) on delete cascade,
  movement_id uuid not null references movements(id) on delete cascade,
  position integer not null,
  unique (workout_id, position)
);

create index on workout_movements (workout_id, position);

-- processing_jobs: drives the realtime status screen
create table processing_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  source_video_id uuid references source_videos(id),
  status text not null default 'pending' check (status in (
    'pending', 'downloading', 'analyzing', 'cutting_clips', 'uploading', 'complete', 'failed'
  )),
  segments_found integer,
  detection_method_used text check (detection_method_used in ('ocr', 'twelve_labs', 'llm_text')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on processing_jobs (user_id, created_at desc);

-- Drop the auth.users foreign keys if this is running against an existing
-- database created before Google sign-in was removed (default Postgres FK
-- constraint names — harmless no-ops on a fresh install).
alter table source_videos drop constraint if exists source_videos_user_id_fkey;
alter table workouts drop constraint if exists workouts_user_id_fkey;
alter table processing_jobs drop constraint if exists processing_jobs_user_id_fkey;

-- Tempo has no sign-in flow, so there is never a Supabase Auth session and
-- auth.uid() is always null — a user_id-scoped RLS policy would deny every
-- request from the app (iOS and web alike). With exactly one user and no
-- login, that per-row auth boundary is meaningless, so RLS stays off: the
-- anon key can read/write these tables directly, same as the app does.
drop policy if exists "users own their source_videos" on source_videos;
drop policy if exists "users own their workouts" on workouts;
drop policy if exists "users see movements for their source_videos" on movements;
drop policy if exists "users manage movements for their source_videos" on movements;
drop policy if exists "users see their workout_movements" on workout_movements;
drop policy if exists "users manage their workout_movements" on workout_movements;
drop policy if exists "users own their processing_jobs" on processing_jobs;
drop policy if exists "authenticated users can upload clips" on storage.objects;

alter table source_videos disable row level security;
alter table movements disable row level security;
alter table workouts disable row level security;
alter table workout_movements disable row level security;
alter table processing_jobs disable row level security;

-- Storage bucket for clips. Uploads go through the server's service-role
-- key (see server/src/pipeline/upload.ts), which bypasses RLS regardless —
-- only the public read policy matters for the app.
insert into storage.buckets (id, name, public) values ('clips', 'clips', true)
  on conflict do nothing;

create policy "anyone can read clips" on storage.objects
  for select using (bucket_id = 'clips');
