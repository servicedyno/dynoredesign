FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Set production environment
ENV NODE_ENV=production
# Disable npm/yarn update checks
ENV NO_UPDATE_NOTIFIER=true
# Force unbuffered output for logs
ENV NODE_OPTIONS="--no-warnings"
ENV PYTHONUNBUFFERED=1
# Skip merchant pool validation by default for Railway
ENV SKIP_MERCHANT_POOL_VALIDATION=true

# Copy all backend source code
COPY backend/ .

# Install dependencies (without frozen lockfile since it might not exist)
RUN yarn install --ignore-engines --production=false

# Build TypeScript
RUN yarn build

# Create logs directory (even though we don't use file logs on Railway)
RUN mkdir -p logs

# Expose the port Railway will use (PORT env var is set by Railway)
EXPOSE 3300

# Health check using curl instead of wget
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3300}/health || exit 1

# Start the server - Railway will set PORT env var
CMD ["node", "dist/server.js"]
