-- Run this after 0002_text_input_pipeline.sql. Generic webpage scraping
-- turned out to fail against Cloudflare-protected sites (hep2go included) —
-- a plain fetch can't solve a JS challenge. Removed in favor of "save the
-- page as a PDF and upload that" instead, which already works.

-- Defensive — should affect zero rows, since a failed webpage fetch never
-- got far enough to write a source_videos row. Needed only so the stricter
-- constraint below can be added without failing on stale data.
update source_videos set platform = 'pdf' where platform = 'webpage';

alter table source_videos drop constraint source_videos_platform_check;
alter table source_videos add constraint source_videos_platform_check
  check (platform in ('youtube', 'tiktok', 'uploaded', 'instagram', 'facebook', 'pdf', 'text'));
