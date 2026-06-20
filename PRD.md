# Tempo — Phase 1 PRD

---

## Goal

Build a mobile app (iOS, Expo) that takes a YouTube URL or TikTok video file, extracts individual exercise movements with timestamps, produces a looping clip per movement, and lets users work through them one at a time in a focus mode.

---

## What Phase 1 is and isn't

**In scope**
- YouTube URL → pipeline → focus mode player
- TikTok: save to camera roll → file picker → same pipeline
- Google Sign In via Supabase Auth
- Focus mode: one exercise at a time, looping clip, countdown timer (timed) or rep/set display (reps), Next button on both modes, prev/next navigation
- Library screen: list of past processed workouts
- Supabase cache: same URL never processed twice

**Out of scope**
- Instagram (Phase 2 — needs share extension + $99)
- iOS Share Extension (Phase 2)
- "Build your own workout" UI (data model supports it, UI deferred)
- AI-generated form cue descriptions (Phase 2)
- Social features, following creators
- Android

---

## Technical decisions

| Layer | Decision | Why |
|---|---|---|
| Mobile | React Native + Expo | iOS-first, avoids CORS, works in Expo Go free |
| Language | TypeScript throughout | catches errors early, one language |
| Server | Node.js + Fastify on Railway | runs yt-dlp + ffmpeg + Tesseract binaries, no timeout limits |
| Database | Supabase (Postgres) | auth + DB + storage + realtime in one service |
| File storage | Supabase Storage | sufficient for MVP, swap to R2 in Phase 2 |
| Auth | Supabase Auth + Google OAuth | one less service to manage |
| Video download (primary) | yt-dlp pinned version | most reliable YouTube downloader |
| Video download (fallback 1) | Cobalt (self-hosted on Railway) | different reverse-engineering, works when yt-dlp breaks |
| Video download (fallback 2) | Pass URL directly to Twelve Labs | Twelve Labs handles download natively, skips OCR but still processes |
| Frame extraction | ffmpeg (binary in Docker) | extracts 1fps frames for OCR, cuts clips at timestamps |
| Text detection | Tesseract OCR (binary in Docker) | free, reads exercise text overlays from frames |
| AI understanding | Twelve Labs Marengo 3.0 | last resort — videos with no text overlays |
| Chapter markers | YouTube Data API v3 | free first-pass before OCR or Twelve Labs |
| Realtime job status | Supabase Realtime | drives live processing screen |

---

## API keys to collect

| Service | Values |
|---|---|
| Supabase | Project URL, anon key, service role key |
| Twelve Labs | API key |
| Google Cloud | YouTube Data API key, OAuth Web client ID + secret, OAuth iOS client ID |
| Railway | GitHub connection only, no separate key |

---

## Database schema

```sql
users
  id uuid PK
  email text
  created_at timestamp

source_videos                        -- this is the cache
  id uuid PK
  user_id uuid FK → users
  original_url text UNIQUE INDEXED   -- cache key
  platform enum (youtube | tiktok | uploaded)
  title text
  duration_sec integer
  thumbnail_url text
  chapter_markers jsonb              -- [{label, start_sec, end_sec}] or null
  processing_status enum (pending | processing | complete | failed)
  processed_at timestamp
  created_at timestamp

movements                            -- one row per exercise segment
  id uuid PK
  source_video_id uuid FK → source_videos
  position integer
  name text
  mode enum (timed | reps)          -- drives focus mode UI behavior
  start_sec integer
  end_sec integer
  duration_sec integer nullable      -- set when mode = timed
  reps integer nullable              -- set when mode = reps
  sets integer nullable              -- set when mode = reps
  clip_url text                      -- Supabase Storage MP4 URL
  detection_method enum (chapter_marker | ocr | twelve_labs)
  confidence float
  created_at timestamp

workouts
  id uuid PK
  user_id uuid FK → users
  title text
  source_video_id uuid FK → source_videos
  total_duration_sec integer nullable
  created_at timestamp

workout_movements                    -- ordered join table
  id uuid PK
  workout_id uuid FK → workouts
  movement_id uuid FK → movements
  position integer
  override_duration_sec integer nullable
  rest_after_sec integer nullable

processing_jobs                      -- drives the realtime status screen
  id uuid PK
  user_id uuid FK → users
  source_video_id uuid FK → source_videos nullable
  status enum (pending | downloading | checking_chapters | running_ocr | analyzing | cutting_clips | uploading | complete | failed)
  segments_found integer nullable
  detection_method_used enum (chapter_marker | ocr | twelve_labs) nullable
  error text nullable
  created_at timestamp
  updated_at timestamp
```

---

## Processing pipeline

```
Client sends POST /process-video { url? | file? }

1.  Write processing_jobs row → status: pending
    Client subscribes to this row via Supabase Realtime

2.  Cache check
    SELECT * FROM source_videos WHERE original_url = ?
    → Hit: return existing workout_id immediately, done

3.  status: downloading  (YouTube)
    Try yt-dlp (pinned version) → download to /tmp
      yt-dlp breaks → try Cobalt (second Railway service)
      Cobalt fails  → skip to step 5b (Twelve Labs URL path)
      Both fail     → status: failed, show error

    TikTok: already received as multipart upload from client

4.  status: checking_chapters  (YouTube only, if download succeeded)
    YouTube Data API v3: GET videos?id={id}&part=snippet
    Parse description for "0:00 Exercise name" pattern
    → Chapters found: use as segments, set mode based on text
      ("30 sec" → timed, "3 sets of 8" → reps)
      skip to step 6

5a. status: running_ocr  (if no chapters, download succeeded)
    ffmpeg: extract 1 frame per second → /tmp/frames/
    Tesseract: run OCR on each frame
    Parser: detect exercise text + segment boundaries
      text changes between frames → new segment at that second
      "30 sec" / "0:45" in text → mode: timed
      "3 sets of 8" / "x12" in text → mode: reps
    → usable segments found: use them, skip to step 6

5b. status: analyzing  (Twelve Labs — last resort)
    YouTube URL path: pass URL directly to Twelve Labs (handles download internally)
    TikTok or yt-dlp succeeded: upload /tmp file to Twelve Labs
    Poll until complete
    Returns: [{ label, start_sec, end_sec }] → all segments mode: timed
    Update segments_found as results stream in

6.  status: cutting_clips
    ffmpeg: for each segment, cut /tmp/clip_{i}.mp4

7.  status: uploading
    Upload each clip to Supabase Storage
    Write source_videos row
    Write movements rows (with mode, reps/sets or duration_sec)
    Write workout + workout_movements rows

8.  status: complete
    Return workout_id → client navigates to focus mode
```

---

## Focus mode behavior by movement mode

**Timed movement**
- Shows looping clip
- Countdown timer (duration_sec → 0)
- Timer reaches 0: auto-advance or user hits Next
- Next button always visible

**Reps-based movement**
- Shows looping clip
- Shows "3 × 8" (sets × reps) instead of timer
- No auto-advance — user hits Next when done
- Next button always visible
- Same prev/next navigation as timed

Both modes look identical except the center display — timer digits vs rep count. Next button is present and works the same way in both.

---

## Directory structure

```
tempo/                              Expo app
├── app/
│   ├── (auth)/
│   │   └── sign-in.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx              Add workout screen
│   │   └── library.tsx            Saved workouts
│   └── workout/
│       ├── [id].tsx               Focus mode player
│       └── processing/[id].tsx    Live processing status screen
├── components/
│   ├── FocusMode/
│   │   ├── FocusModePlayer.tsx
│   │   ├── CountdownTimer.tsx     renders when mode = timed
│   │   ├── RepsDisplay.tsx        renders when mode = reps
│   │   ├── MovementControls.tsx   Prev / Next (both modes)
│   │   └── UpNextStrip.tsx
│   ├── ProcessingStatus.tsx
│   ├── WorkoutCard.tsx
│   └── VideoInput.tsx
├── hooks/
│   ├── useProcessingJob.ts        Supabase Realtime subscription
│   └── useWorkout.ts
├── lib/
│   ├── supabase.ts
│   └── api.ts
├── mocks/
│   └── workout.ts                 fixture data — timed + reps movements
├── types/
│   └── index.ts
└── constants/
    └── colors.ts                  Night theme tokens

tempo-server/                      Railway (main server)
├── src/
│   ├── routes/
│   │   ├── processVideo.ts        POST /process-video
│   │   └── health.ts              GET /health
│   ├── pipeline/
│   │   ├── download.ts            yt-dlp → Cobalt fallback logic
│   │   ├── chapters.ts            YouTube Data API chapter check
│   │   ├── ocr.ts                 ffmpeg frame extraction + Tesseract
│   │   ├── twelvelabs.ts          Twelve Labs API + polling
│   │   ├── ffmpeg.ts              clip cutting
│   │   ├── parser.ts              text → segments + mode inference
│   │   └── upload.ts              Supabase Storage upload
│   ├── jobs/
│   │   └── processJob.ts          orchestrates pipeline, writes job status
│   ├── db/
│   │   └── client.ts
│   └── index.ts
├── tests/
│   ├── pipeline/
│   │   ├── chapters.test.ts
│   │   ├── ocr.test.ts            mock Tesseract output, test parser
│   │   ├── parser.test.ts         "3 sets of 8" → reps mode, "30 sec" → timed
│   │   ├── twelvelabs.test.ts     mocked HTTP responses
│   │   └── ffmpeg.test.ts
│   └── routes/
│       └── processVideo.test.ts
├── scripts/
│   └── seed.ts
├── Dockerfile
├── .env.example
└── package.json

tempo-cobalt/                      Railway (Cobalt service — separate deploy)
└── docker-compose.yml             pulls ghcr.io/imputnet/cobalt image
```

---

## Dockerfile (main server)

```dockerfile
FROM node:20-slim

# ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Tesseract OCR
RUN apt-get install -y tesseract-ocr

# yt-dlp — pinned version
RUN pip install yt-dlp==2024.12.06

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
```

When yt-dlp breaks due to a YouTube update, redeploy Railway with an updated pin. That's a 2-minute fix.

---

## Testing strategy

**Seed script** (`scripts/seed.ts`)
Run once against a known-good YouTube video with text overlays (e.g., a Pamela Reif video). Exercises the OCR path. Populates source_videos, movements (mix of timed + reps), workouts in Supabase. After this, the Expo app renders real content without needing the server running.

**Mock mode in Expo**
`EXPO_PUBLIC_USE_MOCK=true` in `.env`. Returns fixtures from `mocks/workout.ts` — include at least one timed movement and one reps movement so both focus mode UI paths are testable without a server.

**Parser unit tests** (most valuable)
The OCR parser is the hardest logic to get right. Test exhaustively in isolation:
- "Circuit 1 - 3 sets of 8" → `{ mode: reps, sets: 3, reps: 8 }`
- "30 sec" → `{ mode: timed, duration_sec: 30 }`
- "SQUATS | 0:45" → `{ mode: timed, duration_sec: 45 }`
- Text unchanged between frames → same segment, no boundary

**Pipeline unit tests**
- `chapters.test.ts` — description string → timestamp array
- `ocr.test.ts` — mock Tesseract output → segments
- `twelvelabs.test.ts` — mocked HTTP → segments
- `ffmpeg.test.ts` — segments → correct ffmpeg commands

**Realtime test**
Manually flip a processing_jobs row status in Supabase table editor. Watch the processing screen update live. No server required.

**Integration test** (marked `@integration`, skipped in CI)
Full pipeline end-to-end against one real YouTube URL. Run manually before shipping.

---

## Risks and fallbacks

**yt-dlp breaks**
- Likelihood: medium. YouTube changes URL signing periodically.
- Impact: yt-dlp download fails.
- Fallback: auto-retry with Cobalt. If both fail, pass URL to Twelve Labs directly (loses OCR but still processes). Redeploy with updated yt-dlp pin when a fix is released.

**OCR finds no usable text**
- Likelihood: medium. Not all videos have structured text overlays.
- Impact: OCR produces no segments.
- Fallback: automatic. Pipeline falls through to Twelve Labs. No user-visible failure.

**OCR parser misreads text**
- Likelihood: medium. Tesseract accuracy varies with font, background, video compression.
- Impact: wrong segment names or mode inference.
- Fallback: show segments as-is, let user correct in Phase 2. Don't fail the job.

**Twelve Labs doesn't detect movements accurately**
- Likelihood: medium for fast or cluttered videos.
- Impact: wrong segment names or timings.
- Fallback: show what you got. Let user rename in Phase 2.

**Twelve Labs 10hr/month free tier exhausted**
- Likelihood: low at MVP volume. OCR reduces Twelve Labs calls significantly.
- Impact: API returns 402.
- Fallback: catch 402, set job to failed with clear message. Upgrade to paid when needed.

**TikTok file too large**
- Likelihood: medium. TikTok videos can be 100-200MB.
- Impact: upload times out.
- Fallback: cap at 200MB with error before upload begins.

**Google OAuth redirect misconfigured**
- Likelihood: high on first setup.
- Impact: sign in never completes.
- Fallback: test auth before building anything else.

**Supabase Storage 1GB free tier**
- Likelihood: low at MVP scale (~50MB/video = ~20 videos in 1GB).
- Impact: uploads fail.
- Fallback: switch to R2 in Phase 2.

---

## Definition of done

- [ ] Google Sign In works end to end
- [ ] Paste a YouTube URL → live processing screen → focus mode with looping clips
- [ ] TikTok file from camera roll → same flow
- [ ] OCR path correctly identifies timed and reps-based movements from text overlays
- [ ] Reps-based movements show rep/set count with Next button (no timer)
- [ ] Timed movements show countdown with Next button
- [ ] Same URL pasted twice → instant load from cache
- [ ] yt-dlp failure falls through to Cobalt, then Twelve Labs URL, then error
- [ ] Library screen shows past workouts
- [ ] Works on iOS Simulator and Expo Go on real device
