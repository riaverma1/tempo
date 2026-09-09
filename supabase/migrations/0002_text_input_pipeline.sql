-- Run this in the Supabase SQL editor against an existing database to add
-- support for the text-input pipeline (webpage / PDF / plain-text workouts).
-- schema.sql has been updated to match, for fresh installs.

-- A text-derived movement has no video clip or timestamp range.
alter table movements alter column clip_url drop not null;
alter table movements alter column start_sec drop not null;
alter table movements alter column end_sec drop not null;

-- Rest intervals are their own movement rows, distinguished from exercises by
-- is_rest. auto_generated marks the ones the "rest between moves" toggle
-- created, so turning it off only removes those and leaves hand-inserted
-- rests alone.
alter table movements add column is_rest boolean not null default false;
alter table movements add column auto_generated boolean not null default false;

-- New source types and a new detection method for content interpreted by the
-- LLM (as opposed to read off a video with Twelve Labs, or OCR'd).
alter table source_videos drop constraint source_videos_platform_check;
alter table source_videos add constraint source_videos_platform_check
  check (platform in ('youtube', 'tiktok', 'uploaded', 'instagram', 'facebook', 'webpage', 'pdf', 'text'));

-- 'manual' is a row created directly in the review screen (e.g. a rest
-- inserted by hand), not detected from any source
alter table movements drop constraint movements_detection_method_check;
alter table movements add constraint movements_detection_method_check
  check (detection_method in ('ocr', 'twelve_labs', 'llm_text', 'manual'));

-- Adding a stricter check validates every existing row — null out anything
-- already outside the old ('ocr', 'twelve_labs') set (e.g. a stray value
-- from earlier testing) so the new constraint can actually be added. This
-- column is a diagnostic label, not something read back for logic, so
-- clearing an already-invalid value loses nothing real.
update processing_jobs
set detection_method_used = null
where detection_method_used is not null
  and detection_method_used not in ('ocr', 'twelve_labs', 'llm_text');

alter table processing_jobs drop constraint processing_jobs_detection_method_used_check;
alter table processing_jobs add constraint processing_jobs_detection_method_used_check
  check (detection_method_used in ('ocr', 'twelve_labs', 'llm_text'));
