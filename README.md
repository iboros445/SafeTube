# 🛡️ SafeTube Local

**Secure, offline video player for kids — no algorithms, no distractions, no cheating.**

SafeTube is a self-hosted web app that lets parents download YouTube videos and serve them locally to their children in a completely controlled, distraction-free environment with strict, cheat-proof screen time limits.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔒 **Ironclad Sessions** | Children select their profile and are cryptographically locked in via HttpOnly cookies. No logout button — only parents can end a session. |
| ⏱️ **Beacon Time Tracking** | Screen time is tracked via a 5-second server heartbeat. Only *active playback* counts — pausing or sitting in menus does **not** deduct time. |
| 🚫 **No Algorithms** | No recommendations, no autoplay, no ads. Just a clean grid of parent-approved videos. |
| 📥 **Local Downloads** | Videos are downloaded via `yt-dlp` and stored locally. No streaming from YouTube — ever. |
| 📤 **Local Video Upload** | Upload MP4/MKV files directly from the Admin Dashboard for offline viewing. Thumbnails are auto-generated. |
| 🎨 **Personalization** | Per-child themes (Light/Dark), custom avatars (Emoji/Photo/Color), and a fullscreen immersive player. |
| 🗑️ **Auto-Cleanup** | Videos are automatically deleted after a configurable retention period (default: 7 days). |
| 🐳 **Dockerized** | One command to deploy. Node.js + Python + FFmpeg in a single container. |

---

## 🚀 Quick Start (Docker)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 1. Clone & Launch

```bash
git clone https://github.com/your-username/safetube.git
cd safetube
docker compose up --build -d
```

### 2. Open SafeTube

Navigate to **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. First-Time Setup

1. Click **"Parent Dashboard"** at the bottom of the home screen.
2. Enter the default PIN: **`1234`** (change this immediately in Settings!).
3. **Add a child** — give them a name, choose an avatar color, and set a daily screen time limit.
4. **Download a video** — go to the Videos tab, paste a YouTube URL, and click Download.
5. Go back to the home screen — your child can now select their profile and start watching!

---

## 🖥️ Development (Without Docker)

### Prerequisites
- Node.js 18+ 
- Python 3 with `yt-dlp` installed (`pip install yt-dlp`)
- FFmpeg installed and on your PATH

### Setup

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

---

## 🔐 How It Works

### The Beacon (Anti-Cheat Time Tracking)

```
Child plays video
    │
    ▼ every 5 seconds
POST /api/heartbeat  ──►  Server validates session
                          Server checks: usage < limit?
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
                  ✅ 200 OK           ❌ 403 Forbidden
                Add 5s to usage     Pause video
                                    Show "Time's Up!" modal
```

- **Only fires while video is playing.** Pausing = no heartbeat = no time deducted.
- The server is the single source of truth. The child cannot manipulate their time.

### The Ironclad Session

```
Child clicks avatar  →  Server sets HttpOnly cookie
                         │
                         ├── Child refreshes page? → Cookie persists → Same session
                         ├── Child clears localStorage? → Cookie is HttpOnly → Unaffected
                         └── Child restarts browser? → Cookie persists → Same session
                         
Only a parent (PIN) can "End Session" from the Admin Dashboard.
```

---

## 🗂️ Project Structure

```
SafeTube/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── heartbeat/route.ts    ← Anti-cheat heartbeat endpoint
│   │   │   └── media/[filename]/     ← Serves video & thumbnail files
│   │   ├── admin/page.tsx            ← Parent dashboard (PIN protected)
│   │   ├── child/page.tsx            ← Child video library & player
│   │   ├── layout.tsx                ← Root layout
│   │   ├── page.tsx                  ← Profile selector (home)
│   │   └── globals.css               ← Theme & animations
│   ├── components/
│   │   ├── AdminDashboard.tsx        ← Admin UI (children, videos, settings)
│   │   ├── ChildView.tsx             ← Child video grid + player + Time's Up
│   │   └── HomeClient.tsx            ← Profile selector UI
│   ├── db/
│   │   ├── index.ts                  ← SQLite connection + auto-create tables
│   │   └── schema.ts                 ← Drizzle ORM schema
│   ├── hooks/
│   │   └── useBeacon.ts              ← 5-second heartbeat hook
│   └── lib/
│       ├── actions.ts                ← All server actions
│       ├── auth.ts                   ← Session management
│       └── video-downloader.ts       ← yt-dlp wrapper
├── scripts/
│   └── cleanup.py                    ← Auto-delete old videos (cron)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## ⚙️ Configuration

| Setting | Default | Where to Change |
|---|---|---|
| Admin PIN | `1234` | Admin Dashboard → Settings |
| Video Retention | 7 days | Admin Dashboard → Settings |
| Daily Time Limit | Per child | Admin Dashboard → Children |

---

## 🛟 Troubleshooting

| Problem | Solution |
|---|---|
| Video won't download | Make sure `yt-dlp` and `ffmpeg` are installed. In Docker, these are included automatically. |
| "Time's Up" appears immediately | Go to Admin Dashboard → find the child → click the refresh icon to reset their daily time. |
| Child stuck on a session | Go to Admin Dashboard → find the child → click "End Session" (door icon). |
| Forgot admin PIN | Stop the container, delete `data/safetube.db`, and restart. The default PIN `1234` will be restored. |

---

## 📜 License

MIT — Use it, fork it, make it your own.
