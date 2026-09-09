# Tempo — Setup

## System Requirements

Install these before anything else. On Mac:

```bash
brew install yt-dlp ffmpeg poppler node
```

| Tool | Used for |
|---|---|
| `yt-dlp` | Downloading YouTube, TikTok, Instagram, and Facebook videos |
| `ffmpeg` | Cutting movement clips and extracting thumbnails |
| `poppler` (`pdftoppm`, `pdfimages`) | Reading scanned PDF pages and extracting per-exercise photos from PDF workout sheets |
| `node` | Running the server and Expo CLI |

Verify all four are on your PATH **in a new terminal tab after installing**:
```bash
yt-dlp --version && ffmpeg -version && pdftoppm -v && node --version
```

> **Note:** The Node server process inherits PATH from the shell that launched it. If you install a tool while the server is already running, restart the server terminal so the new PATH is picked up.

---

## External Services

You need accounts and keys for:

| Service | What it does | Where to get keys |
|---|---|---|
| **Supabase** | Database, file storage | supabase.com → project → Settings → API |
| **Twelve Labs** | AI video segmentation (video links/uploads) | platform.twelvelabs.io → API Keys |
| **Anthropic** | Content interpretation (PDF/plain-text workouts) | console.anthropic.com → API Keys |
| **Google Cloud** | YouTube Data API v3 (optional — yt-dlp fetches titles as fallback) | console.cloud.google.com → APIs & Services → Credentials |

### Supabase setup
1. Create a project at supabase.com
2. **New project:** run `supabase/schema.sql` in the SQL editor (Database → SQL Editor) — it leaves Row Level Security off. Tempo has no sign-in flow, so there's no `auth.uid()` to scope policies to, and `user_id` isn't a Supabase Auth foreign key either; see the comment in that file.
   **Existing project** (created before the PDF/plain-text pipeline existed): instead run the files in `supabase/migrations/` in order — `0002_text_input_pipeline.sql`, then `0003_remove_webpage_platform.sql` — against your existing database.
3. Generate any UUID (e.g. `uuidgen` in a terminal) — that becomes `EXPO_PUBLIC_USER_ID` / `OWNER_USER_ID` below. It's just an owner tag on every row, not a real account.

### Google Cloud setup (optional)
1. Enable **YouTube Data API v3** and create an API key — used for faster title fetching on YouTube URLs, falls back to yt-dlp if absent

### Twelve Labs setup
1. Create an account at twelvelabs.io
2. Generate an API key from the dashboard
3. Free tier includes 600 minutes/month of video indexing

### Anthropic setup
1. Create an account at console.anthropic.com
2. Generate an API key from API Keys — used only by the server, for interpreting PDF and plain-text workout instructions into structured movements

---

## App (.env)

Copy `.env.example` to `.env` in the repo root and fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_API_URL=           # see "Running Locally" below — this differs for web vs. a physical iPhone
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_USER_ID=<the uuid from Supabase setup step 3>
```

---

## Server (server/.env)

Create `server/.env`:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
TWELVE_LABS_API_KEY=<your key>
ANTHROPIC_API_KEY=<your key>
YOUTUBE_DATA_API_KEY=<your key>   # optional
PORT=3000
NODE_ENV=development

OWNER_USER_ID=<the same uuid as EXPO_PUBLIC_USER_ID above>
```

---

## Running Locally

Two terminals — the server has to be running before the app can process anything (unless `EXPO_PUBLIC_USE_MOCK=true`).

### Terminal 1 — server
```bash
cd server
npm install
npm run dev        # starts on http://localhost:3000
```

### Terminal 2 — app, in a browser (fastest way to test changes)
```bash
npm install
npx expo start --web     # opens http://localhost:8081
```
With `EXPO_PUBLIC_API_URL` left blank, the app talks to `http://localhost:3000` automatically (see `lib/api.ts`) — this works as-is for the web build, since the browser and the server are on the same machine.

### Terminal 2 (alternative) — Expo Go, JS-only
```bash
npx expo start     # scan the QR code with Expo Go
```
No native modules (file picker, video playback) — fine for browsing the UI, not for testing an actual workout end-to-end.

---

## Installing on your iPhone (no App Store, no paid developer account)

This is a **development build**, not Expo Go — it needs Xcode and a physical device connection.

**First time:**
1. Install Xcode from the Mac App Store
2. Xcode → Settings → Accounts → add your Apple ID
3. Connect iPhone via USB, trust the computer on the phone when prompted
4. **Point the app at a server your phone can actually reach.** `localhost` on a physical iPhone means the phone itself, not your Mac — set `EXPO_PUBLIC_API_URL` in `.env` to either your Mac's LAN IP (`http://<your-mac-ip>:3000`, phone and Mac on the same Wi-Fi) or your deployed server's URL (e.g. the Railway URL). Leaving it blank only works for the web build above and the iOS Simulator.
5. Run:
   ```bash
   npm install
   npx expo run:ios --device
   ```
6. If Xcode throws a signing error: open `ios/Tempo.xcworkspace` in Xcode → click the project in the sidebar → Signing & Capabilities → set Team to your personal Apple ID and check "Automatically manage signing." Then re-run step 5.

**To update after making app code changes:**
```bash
npx expo run:ios --device
```
Phone needs to be plugged in. Takes about a minute once the initial build exists.

**What requires a device rebuild vs. what doesn't:**

| Change | What to do |
|---|---|
| `server/` changes | Deploy to Railway (or restart your local `npm run dev`) — the phone picks it up over the network, no rebuild needed |
| `app/`, `components/`, `hooks/`, `lib/`, `types/` changes | Plug in and run `npx expo run:ios --device` again |
| Adding/removing a native module (e.g. a new `expo-*` package) or editing `app.json`'s `plugins` | Same rebuild command — Metro's JS-only reload can't pick up native config changes |

> Free Apple ID profiles expire every 7 days. When the app stops launching, just plug in and re-run `npx expo run:ios --device`.

---

## Dev Flags

| Flag | Where | Effect |
|---|---|---|
| `EXPO_PUBLIC_USE_MOCK=true` | app `.env` | Skip the server; use fixture data instead |

---

## Deployment

Server deploys to **Railway**. `server/Dockerfile` installs yt-dlp, ffmpeg, and poppler-utils automatically — the brew installs above are only needed for local development.

App builds and submits via **EAS**:
```bash
npm install -g eas-cli
eas build --platform ios
eas submit --platform ios
```
