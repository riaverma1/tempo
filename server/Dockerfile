# Build stage: install all deps (including devDependencies) and compile TypeScript
FROM node:20-slim AS builder

WORKDIR /app
COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npx tsc

# Production stage: lean image with only runtime deps and compiled output
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && pip3 install yt-dlp==2026.06.09 --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
