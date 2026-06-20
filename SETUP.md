# Tempo — Setup

## System Requirements

Install these before anything else. On Mac:

```bash
brew install yt-dlp ffmpeg tesseract node
```

| Tool | Used for |
|---|---|
| `yt-dlp` | Downloading YouTube videos for processing |
| `ffmpeg` | Extracting frames (OCR) and cutting movement clips |
| `tesseract` | OCR — reading on-screen text from video frames |
| `node` | Running the server and Expo CLI |

Verify all four are on your PATH **in a new terminal tab after installing**:
```bash
yt-dlp --version && ffmpeg -version && tesseract --version && node --version
```

> **Note:** The Node server process inherits PATH from the shell that launched it. If you install a tool while the server is already running, restart the server terminal so the new PATH is picked up.

---

## External Services

You need accounts and keys for:

| Service | What it does | Where to get keys |
|---|---|---|
| **Supabase** | Database, auth, file storage | supabase.com → project → Settings → API |
| **Twelve Labs** | AI video segmentation (fallback) | platform.twelvelabs.io → API Keys |
| **Google Cloud** | OAuth + YouTube Data API v3 | console.cloud.google.com → APIs & Services → Credentials |

### Supabase setup
1. Create a project at supabase.com
2. Run `supabase/schema.sql` in the SQL editor (Database → SQL Editor)
3. Enable Google as an auth provider: Authentication → Providers → Google
4. Add `https://<your-project>.supabase.co/auth/v1/callback` to your Google OAuth redirect URIs

### Google Cloud setup
1. Enable **YouTube Data API v3** and **Google+ API**
2. Create an OAuth 2.0 client ID (type: Web application)
3. Add `https://<your-project>.supabase.co/auth/v1/callback` as an authorized redirect URI
4. Create an API key for YouTube Data API v3

### Twelve Labs setup
1. Create an account at twelvelabs.io
2. Generate an API key from the dashboard

---

## App (.env)

Copy `.env.example` to `.env` in the repo root and fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_API_URL=           # leave blank for local dev (hits localhost:3000)
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_BYPASS_AUTH=false
```

---

## Server (server/.env)

Create `server/.env`:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
TWELVE_LABS_API_KEY=<your key>
YOUTUBE_DATA_API_KEY=<your key>
COBALT_URL=                    # optional: internal Railway URL of Cobalt service
PORT=3000
NODE_ENV=development

# Dev bypass — skip auth for local pipeline testing
DEV_BYPASS_AUTH=true
DEV_USER_ID=<uuid of a user in your Supabase auth.users table>
```

---

## Running Locally

### Server
```bash
cd server
npm install
npm run dev        # starts on http://localhost:3000
```

### App
```bash
npm install
npx expo start     # Expo Go for JS-only; expo run:ios for native modules
```

For a **development build** (required for native auth, camera, etc.):
```bash
npx expo run:ios
```

---

## Dev Flags

| Flag | Where | Effect |
|---|---|---|
| `EXPO_PUBLIC_USE_MOCK=true` | app `.env` | Skip auth + server; use fixture data |
| `EXPO_PUBLIC_BYPASS_AUTH=true` | app `.env` | Skip auth; hit real server |
| `DEV_BYPASS_AUTH=true` | `server/.env` | Server accepts requests without a Bearer token |
| `DEV_USER_ID=<uuid>` | `server/.env` | Server uses this user ID when bypass is on |

---

## Deployment

Server deploys to **Railway**. The `server/Dockerfile` installs yt-dlp, ffmpeg, and tesseract automatically — the brew installs above are only needed for local development.

App builds and submits via **EAS**:
```bash
npm install -g eas-cli
eas build --platform ios
eas submit --platform ios
```
