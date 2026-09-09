-- Run this in the Supabase SQL editor to bootstrap the schema.

create extension if not exists "uuid-ossp";

-- source_videos: one row per unique video URL (cache key)
create table source_videos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_url text unique,
  platform text not null check (platform in ('youtube', 'tiktok', 'uploaded', 'instagram', 'facebook')),
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
  start_sec integer not null,
  end_sec integer not null,
  duration_sec integer,
  reps integer,
  sets integer,
  clip_url text not null,
  thumbnail_url text,
  detection_method text not null check (detection_method in ('ocr', 'twelve_labs')),
  confidence float not null default 0,
  created_at timestamptz not null default now()
);

create index on movements (source_video_id, position);

-- workouts: user-owned collection of movements
create table workouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  source_video_id uuid references source_videos(id),
  status text not null default 'pending' check (status in (
    'pending', 'downloading', 'analyzing', 'cutting_clips', 'uploading', 'complete', 'failed'
  )),
  segments_found integer,
  detection_method_used text check (detection_method_used in ('ocr', 'twelve_labs')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on processing_jobs (user_id, created_at desc);

-- Enable Row Level Security
alter table source_videos enable row level security;
alter table movements enable row level security;
alter table workouts enable row level security;
alter table workout_movements enable row level security;
alter table processing_jobs enable row level security;

-- RLS policies: users see only their own data
create policy "users own their source_videos" on source_videos
  for all using (auth.uid() = user_id);

create policy "users own their workouts" on workouts
  for all using (auth.uid() = user_id);

create policy "users manage movements for their source_videos" on movements
  for all using (
    exists (select 1 from source_videos sv where sv.id = source_video_id and sv.user_id = auth.uid())
  );

create policy "users manage their workout_movements" on workout_movements
  for all using (
    exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

create policy "users own their processing_jobs" on processing_jobs
  for all using (auth.uid() = user_id);

-- Storage bucket for clips
insert into storage.buckets (id, name, public) values ('clips', 'clips', true)
  on conflict do nothing;

create policy "anyone can read clips" on storage.objects
  for select using (bucket_id = 'clips');

create policy "authenticated users can upload clips" on storage.objects
  for insert with check (bucket_id = 'clips' and auth.role() = 'authenticated');
