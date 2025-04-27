# ---------- build stage ----------
    FROM node:18-alpine AS build
    WORKDIR /app
    
    # 1. Copy manifests and install *all* deps (dev included)
    COPY package*.json ./
    RUN npm install
    
    # 2. Compile TS → JS
    COPY . .
    RUN npm run build            # outputs to /app/dist
    
    # 3. Remove dev deps to shrink size
    RUN npm prune --omit=dev     # keeps prod deps only :contentReference[oaicite:6]{index=6}
    
    # ---------- runtime stage ----------
    FROM node:18-alpine
    WORKDIR /app
    
    # Copy only pruned node_modules and compiled JS
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/dist ./dist
    COPY --from=build /app/config.yaml ./config.yaml
    ENV NODE_ENV=production
    CMD ["node","dist/index.js"]
    