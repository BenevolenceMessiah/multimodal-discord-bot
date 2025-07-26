############################################
# 1️⃣ build stage – compile the TypeScript bot
############################################
FROM node:23-alpine AS build
WORKDIR /app

# Shared config + root manifests (for types)
COPY ../tsconfig.base.json ./
COPY ../package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm install                          # dev + prod deps for tsc

# ✅ Add this line to include bot sources
COPY ../bot ./bot

# Compile
WORKDIR /app/bot
RUN npm run build                        # → /app/bot/dist

############################################
# 2️⃣ runtime stage – tiny Alpine + FFmpeg
############################################
FROM jrottenberg/ffmpeg:6.1-alpine AS ffmpeg

FROM node:23-alpine AS runtime
WORKDIR /app

# Runtime deps only
COPY ../package*.json ./
RUN npm install --omit=dev

# FFmpeg + shim
COPY --from=ffmpeg /usr/local/ /usr/local/
RUN printf '#!/bin/sh\\nexec ffmpeg -v quiet -print_format json -show_format -show_streams \"$@\"\\n' \
      > /usr/local/bin/ffprobe && chmod +x /usr/local/bin/ffprobe

# ✅ Fix this: copy compiled JS from the correct path
COPY --from=build /app/bot/dist ./bot/dist

WORKDIR /app/bot
CMD ["node", "dist/src/index.js"]
