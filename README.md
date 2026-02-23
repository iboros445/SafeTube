# 🛡️ SafeTube Local

**Secure · Offline · Kid-safe**

SafeTube is a self-hosted web application designed for parents who want absolute control over the content their children watch. It allows you to download YouTube videos or upload local files, serving them in a distraction-free, algorithm-free environment with ironclad screen time limits.

---

### 🚀 Key Features

- **🔒 Complete Control**: No recommendations, no ads, no "infinite scroll". Only parent-approved videos.
- **⏱️ Anti-Cheat Time Tracking**: Heartbeat-based tracking ensures screen time is only deducted during active playback.
- **📥 Local Storage**: High-speed local playback with no external streaming required.
- **💬 Subtitle Support**: Automatic conversion of `.srt` to `.vtt` for seamless accessibility.
- **🐳 One-Click Deploy**: Fully dockerized. Node.js, Python, and FFmpeg ready out of the box.

---

### 📸 Visual Walkthrough

<details>
<summary><b>1. Simple Profile Selection</b></summary>
<br>
<img src="public/screenshots/home.png" alt="Profile Selection" width="800" />
<p><i>Symmetric, easy-to-use profile selection for up to 4 children (expandable).</i></p>
</details>

<details>
<summary><b>2. Parent Dashboard (Children & Limits)</b></summary>
<br>
<img src="public/screenshots/admin-children.png" alt="Admin Children Management" width="800" />
<p><i>Manage daily screen time, avatars, and active sessions for each child.</i></p>
</details>

<details>
<summary><b>3. Content Discovery & Uploads</b></summary>
<br>
<img src="public/screenshots/admin-videos.png" alt="Admin Video Management" width="800" />
<p><i>Download directly from YouTube or upload local MP4/MKV files with metadata extraction.</i></p>
</details>

<details>
<summary><b>4. Child's Safe Library</b></summary>
<br>
<img src="public/screenshots/child-view.png" alt="Child Video Library" width="800" />
<p><i>A clean grid of parent-approved content. Once time expires, playback stops immediately.</i></p>
</details>

---

## 🛠️ Quick Start (Docker)

1.  **Clone & Launch**
    ```bash
    git clone https://github.com/your-username/safetube.git
    cd safetube
    docker compose up --build -d
    ```
2.  **Access App**: Open `http://localhost:3000`.
3.  **Parent Login**: Click **Parent Dashboard** at the bottom. Default PIN: `1234`.

---

## 🔐 Security Architecture

### The Beacon (Heartbeat Tracking)

SafeTube uses a "Beacon" mechanism. The player sends a heartbeat every 5 seconds. If the child hasn't reached their limit, the heartbeat is accepted and usage is incremented. If the limit is hit, the server rejects the request, and the UI immediately locks the player. This is significantly more robust than client-side-only timers.

### PIN Hashing

Admin PINs are secured using **scrypt** hashing with per-user salts. Brute-force protection is built-in with automatic IP rate-limiting.

---

## ⚙️ Configuration & Cookies

If you encounter **"Sign in to confirm you're not a bot"** or want to download **age-restricted content**, paste your `cookies.txt` (Netscape format) into **Admin Dashboard → Settings → YouTube Configuration**. SafeTube will use your session to authenticate downloads.

---

## 🗂️ Project Structure

```bash
SafeTube/
├── src/app/          # Next.js App Router (Pages & API)
├── src/components/   # Reusable React components
├── src/db/           # Drizzle ORM Schema & SQLite
├── src/lib/          # Server actions, Auth, & Video Downloader
├── public/           # Static assets & screenshots
├── scripts/          # Cleanup & maintenance scripts
└── Dockerfile        # Production container definition
```

---

## 📜 License

MIT — Fork it, build on it, share it.
