# ─── Stage 1: Build frontend ────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files for layer caching
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build — tsc + vite build (VITE_API_URL unset for relative /api/... URLs)
RUN npm run build

# ─── Stage 2: Production backend ────────────────────────────────────────────
FROM node:22-alpine AS production

# curl needed for health check
RUN apk add --no-cache curl

# Install backend dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Install database package dependencies
WORKDIR /app/packages/database
COPY packages/database/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy application source
WORKDIR /app
COPY backend/ ./backend/
COPY packages/ ./packages/

# Generate Prisma client (must run after source copy)
WORKDIR /app/packages/database
RUN npx prisma generate

# Embed the frontend build into the backend's public folder
# Express will serve these as static assets in production
COPY --from=frontend-builder /app/frontend/dist /app/backend/public

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

WORKDIR /app/backend

EXPOSE 3000

# Allow extra start time for DB connection on cold boot
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.mjs"]
