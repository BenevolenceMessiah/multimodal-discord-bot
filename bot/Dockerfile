# ---------- build stage ----------
    FROM node:23-alpine AS build
    WORKDIR /app
    
    # 1. Copy manifests and install *all* deps (dev included)
    COPY package*.json ./
    RUN npm install
    
    # 2. Compile TS → JS
    COPY . .
    RUN npm run build            # outputs to /app/dist
    
    # 3. Remove dev deps to shrink size
    RUN npm prune --omit=dev     # keeps prod deps only
    
    # ---------- runtime stage ----------
    FROM node:23-alpine
    WORKDIR /app
    
    # Copy only pruned node_modules and compiled JS
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/dist ./dist
    ENV NODE_ENV=production
    CMD ["node","/app/dist/src/index.js"]
    