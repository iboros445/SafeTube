# ── Stage 1: Dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# ── Stage 2: Builder ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 3: Production Runner ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# ── Install Python3 + pip + FFmpeg + yt-dlp (critical) ────────────
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
  && pip3 install --no-cache-dir --break-system-packages yt-dlp

# ── Copy built app ────────────────────────────────────────────────
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json

# ── Copy cleanup script ──────────────────────────────────────────
COPY scripts/ ./scripts/

# ── Create data & media directories ───────────────────────────────
RUN mkdir -p /app/data /app/media

# ── Add cron job for video cleanup ────────────────────────────────
RUN echo "0 3 * * * python3 /app/scripts/cleanup.py" | crontab -

EXPOSE 3000

CMD ["node", "server.js"]
