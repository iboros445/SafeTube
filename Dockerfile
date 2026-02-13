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

# ── Install Python3 + pip + FFmpeg + yt-dlp + su-exec ────────────
RUN apk add --no-cache \
  python3 \
  py3-pip \
  ffmpeg \
  su-exec \
  && pip3 install --no-cache-dir --break-system-packages yt-dlp

# ── Copy built app ────────────────────────────────────────────────
# Ensure public exists in builder to avoid failure
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Copy public if it exists
COPY --from=builder /app/public* ./public/

# ── Copy cleanup script ──────────────────────────────────────────
COPY scripts/ ./scripts/

# ── Create data & media directories ───────────────────────────────
RUN mkdir -p /app/data /app/media && chown -R node:node /app/data /app/media

# ── Add cron job for video cleanup (for the node user) ────────────
RUN echo "0 3 * * * python3 /app/scripts/cleanup.py" | crontab -u node -

EXPOSE 3000

# Start crond as root, then run the app as the node user
CMD ["sh", "-c", "crond && su-exec node node server.js"]
