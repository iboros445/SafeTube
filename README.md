# 🛡️ SafeTube Local

**Secure, offline video player for kids — no algorithms, no distractions, no cheating.**

SafeTube is a self-hosted web app that lets parents download YouTube videos and serve them locally to their children in a completely controlled, distraction-free environment with strict, cheat-proof screen time limits.

---

## ✨ Features

| Feature                     | Description                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------- |
| 🔒 **Ironclad Sessions**    | Children select their profile and are cryptographically locked in via HttpOnly cookies. |
| 🛡️ **Hardened Auth**        | PINs are secured with **scrypt hashing** and brute-force protection (rate limiting).    |
| ⏱️ **Beacon Time Tracking** | Heartbeat-based tracking ensures only _active playback_ counts.                         |
| 🚫 **No Algorithms**        | No recommendations or ads. Only parent-approved local files.                            |
| 📥 **Local Downloads**      | Videos downloaded via `yt-dlp`. No external streaming.                                  |
| 📤 **Local Video Upload**   | Upload MP4/MKV files directly. Durations are accurately extracted via `ffprobe`.        |
| 💬 **Subtitle Support**     | Support for `.srt` and `.vtt`. SRTs are auto-converted to WebVTT for playback.          |
| 🎨 **Personalization**      | Per-child themes, custom avatars, and an immersive fullscreen player.                   |
| 🗑️ **Auto-Cleanup**         | Videos and metadata are automatically deleted after a configurable period.              |
| 🐳 **Dockerized**           | One command to deploy. Node.js + Python + FFmpeg in a single container.                 |

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
2. Enter the default PIN: **`1234`** (It will be hashed automatically upon first login).
3. **Add a child** — choose an avatar and set a daily limit.
4. **Download/Upload a video** — go to the Videos tab.
5. **Add Subtitles** — Click the **"CC"** button on any video to upload an `.srt` or `.vtt` file.
6. Go back to the home screen — your child can now select their profile and start watching!

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

## 🔐 Security & Anti-Cheat

### PIN Hashing & Rate Limiting

SafeTube uses `scrypt` to securely hash Admin PINs. If you have a plaintext PIN from an older version, it will be automatically upgraded to a hashed format when you next log in. To prevent brute-force attacks, the Admin login is rate-limited to 5 failures per minute.

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

Only a parent (PIN) can "End Session" from the Admin Dashboard. (Provided the child doesn't know how to clear cookies, or use incognito mode🙏)
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

| Setting          | Default   | Where to Change            |
| ---------------- | --------- | -------------------------- |
| Admin PIN        | `1234`    | Admin Dashboard → Settings |
| Video Retention  | 7 days    | Admin Dashboard → Settings |
| Daily Time Limit | Per child | Admin Dashboard → Children |

---

---

## 🍪 YouTube Cookies & Authentication

If you encounter **"Sign in to confirm you’re not a bot"** errors or need to download **age-restricted content**, you must provide YouTube cookies.

### How to get your cookies:

1.  **Install a browser extension** that exports cookies in Netscape format.
    - Chrome/Edge: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflccgomjciqhfv)
    - Firefox: [Get cookies.txt LOCALLY](https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/)
2.  **Log in to YouTube** in your browser.
3.  **Click the extension icon** and export your cookies for `youtube.com`.
4.  **Copy the content** of the exported file.
5.  **Go to SafeTube**: Admin Dashboard → Settings → **YouTube Configuration**.
6.  **Paste** the cookies into the text area and click **Save Cookies**.

SafeTube will now use your session to authenticate downloads, bypassing most restrictions.

---

## 🛟 Troubleshooting

| Problem                           | Solution                                                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video won't download              | Make sure `yt-dlp` and `ffmpeg` are installed. In Docker, these are included automatically.                                                                                   |
| **"Sign in to confirm..." error** | YouTube is blocking the download. Go to **Admin Dashboard → Settings → YouTube Configuration**. Paste your `cookies.txt` (Netscape format) to bypass this using your account. |
| "Time's Up" appears immediately   | Go to Admin Dashboard → find the child → click the refresh icon to reset their daily time.                                                                                    |
| Child stuck on a session          | Go to Admin Dashboard → find the child → click "End Session" (door icon).                                                                                                     |
| Forgot admin PIN                  | Stop the container, delete `data/safetube.db`, and restart. The default PIN `1234` will be restored.                                                                          |

---

## 📜 License

MIT — Use it, fork it, make it your own.
