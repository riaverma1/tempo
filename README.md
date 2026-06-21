# Tempo

Tempo turns workout videos into interactive, movement-by-movement training sessions. Paste a YouTube, TikTok, or Instagram Reel link — or upload a video from your camera roll — and Tempo automatically identifies each exercise, cuts it into a clip, and walks you through the workout with a built-in timer or rep counter.

---

## What it does

1. **Add a video** — paste a link or import from camera roll
2. **AI analyzes it** — Twelve Labs identifies every distinct movement with timestamps
3. **Review your workout** — reorder or delete movements before you start
4. **Train** — each clip plays in sequence with a countdown timer (timed sets) or rep display (rep-based sets), with next-movement preview

---

## Running the app

See [SETUP.md](SETUP.md) for full environment setup (Supabase, Twelve Labs, env files).

### Prerequisites

```bash
brew install yt-dlp ffmpeg node
```

### Start the server

```bash
cd server
npm install
npm run dev        # http://localhost:3000
```

### Start the app

```bash
npm install
npx expo run:ios   # development build — required for native auth and camera roll
# or
npx expo start     # Expo Go via QR code (no native auth/camera)
```

---

## Running on your personal device (no App Store)

Installs directly to your iPhone via Xcode. No TestFlight, no paid developer account needed.

**First time:**
1. Install Xcode from the Mac App Store
2. Xcode → Settings → Accounts → add your Apple ID
3. Connect iPhone via USB, trust the computer on the phone when prompted
4. Run:
   ```bash
   npm install
   npx expo run:ios --device
   ```
5. If Xcode throws a signing error: open `ios/tempo.xcworkspace` in Xcode → click the project in the sidebar → Signing & Capabilities → set Team to your personal Apple ID and check "Automatically manage signing". Then re-run step 4.

**To update after making app code changes:**
```bash
npx expo run:ios --device
```
Phone needs to be plugged in. Takes about a minute once the initial build exists.

**What requires a device sync vs. what doesn't:**

| Change | What to do |
|---|---|
| `server/` changes | Deploy to Railway — phone picks it up automatically |
| `app/`, `components/`, `hooks/`, `lib/`, `types/` | Plug in and run `npx expo run:ios --device` |

> Free Apple ID profiles expire every 7 days. When the app stops launching, just plug in and re-run `npx expo run:ios --device`.

---

## How a video becomes a workout

### Phase 1 — Capture

| Source | How it's submitted |
|---|---|
| YouTube URL | Pasted into the URL input |
| TikTok URL | Pasted into the URL input |
| Instagram Reel URL | Pasted into the URL input |
| Local file | Imported from camera roll via the "Import video" button |

### Phase 2 — Process

All four paths converge at the same pipeline on the server:

```
URL input
  ├─ detectPlatform(url)         → tags source as youtube / tiktok / instagram
  │
  ├─ Download (in priority order)
  │   1. yt-dlp                  → primary; handles YouTube, TikTok, Instagram natively
  │   2. Cobalt                  → fallback if yt-dlp fails (non-auth errors only)
  │   ✗ private/login-gated      → surfaces error immediately, skips Cobalt
  │
  └─ Title fetch (in priority order)
      YouTube:           1. YouTube Data API  2. yt-dlp --dump-json
      TikTok/Instagram:  1. yt-dlp --dump-json

File upload
  └─ multipart POST              → written to /tmp directly, platform tagged as 'uploaded'
                                   (skips download step entirely)

↓ Both paths continue here:

  ├─ Twelve Labs                 → upload video → index (Marengo 3.0) → analyze (Pegasus 1.5)
  │    └─ returns segments: name, start_sec, end_sec per movement
  ├─ ffmpeg                      → cuts one clip + one thumbnail per movement
  └─ Supabase Storage            → uploads clips/thumbnails, writes source_videos + movements + workout rows
```

**Caching:** if the same URL was already processed, the pipeline skips re-indexing and reuses existing movements.

**Error handling:**
- Private or login-gated video → "Download it and upload from your camera roll"
- Download failure (yt-dlp + Cobalt both fail) → "Try saving it to your camera roll and uploading it directly"
- Twelve Labs or upload failure → error displayed on the processing screen

### Phase 3 — Present

```
Review screen
  └─ inspect, reorder, or delete movements before starting

Focus Mode (per movement)
  ├─ Timed sets    → looping video clip + countdown timer (beep at 3s)
  └─ Rep sets      → looping video clip + sets × reps display
  └─ Next movement → shown in a strip at the bottom; tap prev/next to navigate
```

---

## Tech stack

| Layer | Stack |
|---|---|
| App | React Native + Expo (TypeScript) |
| Server | Node.js + Fastify (TypeScript), hosted on Railway |
| Database / Auth / Storage | Supabase |
| AI segmentation | Twelve Labs — Marengo 3.0 indexing + Pegasus 1.5 analysis |
| Video download | yt-dlp (primary), Cobalt (fallback) |
| Clip cutting | ffmpeg |
