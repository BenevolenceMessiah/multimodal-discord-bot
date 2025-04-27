FROM node:18-alpine AS deps
WORKDIR /app
COPY bot/package.json bot/package-lock.json ./
RUN npm ci --production

FROM node:18-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY bot/. .
CMD ["node", "dist/index.js"]
