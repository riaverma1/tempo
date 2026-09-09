# Build stage: install all deps (including devDependencies) and compile TypeScript
FROM node:22-slim AS builder

WORKDIR /app
COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npx tsc

# Production stage: lean image with only runtime deps and compiled output
FROM node:22-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    poppler-utils \
    curl \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/download/2026.06.09/yt-dlp \
       -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
