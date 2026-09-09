// The one place that defines how a Platform value splits into "goes through
// the video pipeline" vs "goes through the text pipeline" — previously
// duplicated as a hand-rolled array in processJob.ts, a hand-rolled map in
// processVideo.ts, and this VideoPlatform type in chapters.ts, with no link
// between them. Adding a new platform meant remembering to update all three;
// missing one didn't fail to compile, it just silently misrouted at runtime.

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'facebook';
export type TextPlatform = 'pdf' | 'text' | 'image';
export type Platform = VideoPlatform | 'uploaded' | TextPlatform;

export const TEXT_PLATFORMS: readonly TextPlatform[] = ['pdf', 'text', 'image'];

export function isTextPlatform(platform: Platform): platform is TextPlatform {
  return (TEXT_PLATFORMS as readonly Platform[]).includes(platform);
}

// Maps a detected upload file kind straight to its Platform value — the file
// picker's three content types (video / pdf / image) plus 'uploaded' being
// the video pipeline's name for a directly-uploaded file rather than a URL.
export function platformForFileKind(kind: 'video' | 'pdf' | 'image'): Platform {
  return kind === 'video' ? 'uploaded' : kind;
}
