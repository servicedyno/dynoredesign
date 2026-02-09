##############################################
# Stage 1: Builder — install all deps & compile TS
##############################################
FROM node:20-alpine AS builder

WORKDIR /app

# Set production-safe env early
ENV NODE_ENV=production
ENV NO_UPDATE_NOTIFIER=true

# Copy dependency manifests first (cache layer)
COPY backend/package.json backend/yarn.lock* ./

# Install ALL deps (dev included for tsc build)
RUN yarn install --ignore-engines --production=false --frozen-lockfile || yarn install --ignore-engines --production=false

# Copy source code
COPY backend/ .

# Build TypeScript → dist/
RUN yarn build

# Prune to production-only deps (removes typescript, jest, ts-node, etc.)
RUN yarn install --ignore-engines --production=true && yarn cache clean

##############################################
# Stage 2: Runner — lean production image
##############################################
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV NO_UPDATE_NOTIFIER=true
ENV NODE_OPTIONS="--no-warnings"
ENV PYTHONUNBUFFERED=1
ENV SKIP_MERCHANT_POOL_VALIDATION=true

# Copy only what's needed from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy static assets & runtime resources
COPY --from=builder /app/public ./public
COPY --from=builder /app/swagger ./swagger
COPY --from=builder /app/views ./views
COPY --from=builder /app/templates ./templates

# Create logs directory
RUN mkdir -p logs

EXPOSE 3300

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3300}/health || exit 1

# Start the server
CMD ["node", "dist/server.js"]
