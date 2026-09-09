-- Run this in the Supabase SQL editor against an existing database to add
-- support for uploading a photo/screenshot of a workout (same vision path
-- already used for scanned PDFs — no text extraction, straight to Claude).

alter table source_videos drop constraint source_videos_platform_check;
alter table source_videos add constraint source_videos_platform_check
  check (platform in ('youtube', 'tiktok', 'uploaded', 'instagram', 'facebook', 'pdf', 'text', 'image'));
