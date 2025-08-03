############################################
# 1️⃣ build stage – compile the TypeScript bot
############################################
# Pin to a stable Alpine branch (avoids edge-repo outages)
FROM --platform=$BUILDPLATFORM node:23-alpine3.20 AS build
WORKDIR /app

# Shared config + root manifests
COPY ../tsconfig.base.json ./
COPY ../package*.json ./

# -------- robust mirror + RETRY on BOTH update AND add --------
RUN set -eux; \
  # 1 Replace repo list with two highly-available HTTPS mirrors
  printf '%s\n' \
    "https://dl-cdn.alpinelinux.org/alpine/v3.20/main" \
    "https://dl-cdn.alpinelinux.org/alpine/v3.20/community" \
    "https://mirror.yandex.ru/mirrors/alpine/v3.20/main" \
    "https://mirror.yandex.ru/mirrors/alpine/v3.20/community" \
    > /etc/apk/repositories; \
  \
  # 2 Retry apk update up to 5×
  for i in 1 2 3 4 5; do \
    apk update && break || { echo "apk update fail ($i) — retry"; sleep $((i*2)); }; \
  done; \
  \
  # 3 Retry apk add up to 5×  (key to fixing your latest error)
  for i in 1 2 3 4 5; do \
    apk add --no-cache --virtual .build-deps python3 make g++ && break || { \
      echo "apk add fail ($i) — retry"; \
      apk fix --no-cache;            /* clean half-installed pkgs */ \
      sleep $((i*3)); \
    }; \
  done; \
  \
  npm install --legacy-peer-deps           # dev + prod deps for tsc

# ✅ include bot sources
COPY ../bot ./bot

# Compile
WORKDIR /app/bot
RUN npm run build                         # → /app/bot/dist

############################################
# 2️⃣ runtime stage – tiny Alpine + FFmpeg
############################################
FROM jrottenberg/ffmpeg:6.1-alpine AS ffmpeg

# Use same Alpine minor for consistency
FROM node:23-alpine3.20 AS runtime
WORKDIR /app

# Runtime deps only
COPY ../package*.json ./
RUN npm install --omit=dev

# FFmpeg binaries + ffprobe shim
COPY --from=ffmpeg /usr/local/ /usr/local/
RUN printf '#!/bin/sh\nexec ffmpeg -v quiet -print_format json -show_format -show_streams "$@"\n' \
      > /usr/local/bin/ffprobe && chmod +x /usr/local/bin/ffprobe

# ✅ copy compiled JS
COPY --from=build /app/bot/dist ./bot/dist

WORKDIR /app/bot
CMD ["node", "dist/src/index.js"]
