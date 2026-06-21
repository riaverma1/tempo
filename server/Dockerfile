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

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npx tsc

CMD ["node", "dist/index.js"]
