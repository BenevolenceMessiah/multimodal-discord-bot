############################################
# ⏳ build stage – compile TypeScript
############################################
FROM node:23-alpine AS build
WORKDIR /app

# 1️⃣ copy root manifests (they declare fluent-ffmpeg + sharp)
COPY package*.json ./

# 2️⃣ install *all* deps so TypeScript sees @types/* and sharp headers
ENV NODE_ENV=development
RUN apk update && \
    apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci

# 3️⃣ copy bot source and compile
COPY bot ./bot
WORKDIR /app/bot
RUN npm run build               # outputs to /app/bot/dist

############################################
# 🚀 runtime stage – slim, prod-only
############################################
FROM node:23-alpine
WORKDIR /app/bot
ENV NODE_ENV=production

# 4️⃣ install runtime deps
COPY package*.json ../
WORKDIR /app
RUN npm ci --omit=dev           # installs sharp because it's now a prod dep
WORKDIR /app/bot

# 5️⃣ add FFmpeg binary for fluent-ffmpeg
RUN apk add --no-cache ffmpeg

# 6️⃣ copy compiled JS bundle
COPY --from=build /app/bot/dist ./dist

CMD ["node", "dist/src/index.js"]
