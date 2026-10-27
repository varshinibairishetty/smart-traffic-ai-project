# backend/Dockerfile
# Multi-stage Dockerfile: Builds React frontend and serves full-stack application from Express

# ── Stage 1: Build React Frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production Node.js Backend & Static Server ────────────────────────
FROM node:20-alpine AS backend

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies for Express server
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend application source
COPY backend/ ./backend/

# Copy compiled frontend assets from Stage 1 into frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose backend HTTP & WebSocket port
EXPOSE 5000

WORKDIR /app/backend

# Verify health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["npm", "start"]
